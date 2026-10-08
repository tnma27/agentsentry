// lib/scanner/target.ts
// SSRF guard for the passive scanner (server-only).
// 1. validateTarget(): syntactic checks on every URL we are about to request (initial and each redirect hop).
// 2. guardedLookup(): DNS resolution used at CONNECT time, so every resolved address is checked right before the
//    socket opens. This also defeats DNS-rebinding between validation and connection.

import dns from "dns";
import net from "net";

const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];
const BLOCKED_V6: [string, number][] = [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  // IPv4-mapped addresses (::ffff:a.b.c.d) are unwrapped and checked against the v4 list in isPublicIp().
  // Do NOT add ::ffff:0:0/96 here: net.BlockList matches every IPv4 address against that subnet.
  ["64:ff9b::", 96], // NAT64
  ["64:ff9b:1::", 48], // local-use NAT64
  ["100::", 64], // discard
  ["2001::", 23], // IETF protocol assignments (incl. Teredo)
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4 (can embed private v4)
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // site-local (deprecated)
  ["ff00::", 8], // multicast
];

const blockList = new net.BlockList();
for (const [a, p] of BLOCKED_V4) blockList.addSubnet(a, p, "ipv4");
for (const [a, p] of BLOCKED_V6) blockList.addSubnet(a, p, "ipv6");

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home.arpa", ".corp", ".localdomain"];
const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain", "metadata", "metadata.google.internal", "instance-data", "kubernetes.default"]);
const ALLOWED_PORTS = new Set(["", "80", "443"]);

export class TargetError extends Error {
  constructor(
    message: string,
    public code: "invalid_target" | "blocked_target",
  ) {
    super(message);
  }
}

export function isPublicIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return !blockList.check(ip, "ipv4");
  if (family === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mapped) return isPublicIp(mapped[1]);
    return !blockList.check(ip, "ipv6");
  }
  return false;
}

/** Parses and validates a user-supplied or redirect URL. Returns a normalized URL without credentials or fragment. */
export function validateTarget(input: string): URL {
  const raw = input.trim();
  if (!raw || raw.length > 2048) throw new TargetError("Enter a website URL (max 2048 characters).", "invalid_target");
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new TargetError("That does not look like a valid URL.", "invalid_target");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new TargetError("Only http:// and https:// websites can be scanned.", "invalid_target");
  if (url.username || url.password) throw new TargetError("URLs containing credentials are not accepted.", "invalid_target");
  if (!ALLOWED_PORTS.has(url.port)) throw new TargetError("Only the standard web ports (80 and 443) can be scanned.", "blocked_target");

  // WHATWG URL already normalizes decimal/octal/hex IPv4 forms (e.g. http://2130706433 -> 127.0.0.1).
  const host = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (!isPublicIp(host)) throw new TargetError("Private, loopback, link-local and reserved IP addresses cannot be scanned.", "blocked_target");
  } else {
    if (BLOCKED_HOSTS.has(host) || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s)))
      throw new TargetError("Local and internal hostnames cannot be scanned.", "blocked_target");
    if (!host.includes(".")) throw new TargetError("Enter a fully qualified public hostname (e.g. example.com).", "invalid_target");
  }
  url.hash = ""; // the query string is kept for the request; it is stripped before anything is stored
  return url;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

/** Drop-in replacement for dns.lookup used by http(s).request: refuses to connect to any non-public address. */
export function guardedLookup(hostname: string, options: dns.LookupOptions | number, callback: LookupCallback): void {
  const opts = typeof options === "number" ? { family: options } : options ?? {};
  dns.lookup(hostname, { ...opts, all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err, []);
    const list = addresses as dns.LookupAddress[];
    if (!list.length) return callback(Object.assign(new Error(`No addresses found for ${hostname}`), { code: "ENOTFOUND" }), []);
    const bad = list.find((a) => !isPublicIp(a.address));
    if (bad) {
      return callback(
        Object.assign(new Error(`${hostname} resolves to a non-public address; connection refused by AgentSentry`), { code: "EBLOCKED" }),
        [],
      );
    }
    if (opts.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}
