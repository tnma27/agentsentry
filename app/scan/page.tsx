import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/ui/kit";
import { ScanConsole } from "@/components/scan/ScanConsole";

export const metadata: Metadata = { title: "Website Scanner" };

export default async function ScanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        eyebrow="01 · Detect"
        title={
          <>
            Website <em className="text-cobalt">scanner</em>
          </>
        }
        intro="A passive look at what any visitor's browser can observe: transport security, security headers, cookie attributes and information disclosure. Every finding cites the evidence it was based on."
      />
      <Section>
        <ScanConsole initialMode={sp.fixture ? "fixture" : "url"} />
      </Section>
    </>
  );
}
