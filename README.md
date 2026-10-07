# AgentSentry

**Security for AI agents before they act.**

AI agents increasingly read untrusted external content (READMEs, web pages, issues, emails) and then call tools. A malicious instruction hidden in that content can be mistaken for a legitimate goal: this is **indirect prompt injection** (OWASP LLM01 / ASI01 Agent Goal Hijack).

AgentSentry is a security gateway that sits between an agent and its tools. Every **proposed** tool call is evaluated **before execution** and is either **ALLOWED**, **held for confirmation (WARN)**, or **BLOCKED**.

> **Honesty note:** In this hackathon demo, the AI agent, the repository files and the tools are **safe simulations** (in-memory only). The AgentSentry gateway, the deterministic risk engine and the decision logic are **real code**, evaluated live on every request. No real files, secrets or shell commands are ever touched.

## How it works

```
proposed tool call ──► Deterministic policy engine (authoritative) ──┐
                   └─► Gemma contextual analysis (advisory)  ────────┴─► escalate-only merge ──► ALLOW / WARN / BLOCK
```

1. **Deterministic engine** (`lib/security/engine.ts`, `lib/security/config.ts`): six explainable rules, each with evidence and OWASP mapping:

   | Rule | Weight |
   | --- | --- |
   | Sensitive resource access (`.env`, keys, credentials) | 40 |
   | Instruction from untrusted content (provenance) | 25 |
   | Action does not match user intent (least privilege) | 20 |
   | Prompt-injection indicators in content | 15 |
   | External data transmission | 30 |
   | Destructive action | 35 |

   Score ≥ 30 = WARN, ≥ 70 = BLOCK. **Hard rule:** untrusted content may never trigger sensitive, external or destructive actions; that is always BLOCK, whatever the score.

2. **Gemma** (`lib/gemma/`, model `gemma-4-26b-a4b-it` via the Gemini API): reads the untrusted content strictly as data and returns structured JSON with whether injection is present, the extracted malicious instruction, the likely attacker goal, intent alignment, a recommendation and an explanation. Output is schema-validated.

3. **Merge** (`lib/security/verdict.ts`): Gemma may **escalate** a verdict (only with ≥ 0.7 confidence and evidence of injection or misalignment). It can **never downgrade** one. A deterministic BLOCK plus a Gemma ALLOW is still a BLOCK.

If `GEMINI_API_KEY` is missing, or Gemma times out (8 s), errors or returns invalid output, the deterministic verdict stands and the UI shows that contextual analysis was unavailable.

## Demo scenarios

The user request is always: *"Analyze this repository and summarize what it does."*

| Scenario | Agent proposes | Origin | Score | Decision |
| --- | --- | --- | --- | --- |
| Safe | `read_file("package.json")` | User request | 0 | ALLOW |
| Suspicious setup | `run_command("npm install && npm run build")` | README.md | 45 | WARN |
| Indirect prompt injection | `read_file(".env")` | Hidden HTML comment in README.md | 100 | BLOCK |

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 (landing page) and http://localhost:3000/demo (live demo).

Optional, to enable Gemma analysis, create `.env.local`:

```
GEMINI_API_KEY=your-key-here
```

The key is read only on the server (`app/api/analyze/route.ts`) and is never sent to the browser.

## API

`POST /api/analyze` with `{ userRequest, files: [{ path, content, trust }], proposedAction: { tool, target, origin } }` returns `{ eventId, timestamp, verdict, engine, gemma }`. See `lib/types.ts` for the full contract.

## Project layout

```
app/page.tsx              Landing page
app/demo/page.tsx         Interactive demo (timeline, attack path, verdict, events)
app/api/analyze/route.ts  Security gateway endpoint
lib/security/             Deterministic engine, rule config, verdict merge
lib/gemma/                Gemma client, prompt and output schema
lib/scenarios/            Simulated SAFE / WARN / ATTACK scenarios
components/demo/          Demo UI components
```
