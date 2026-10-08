import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/ui/kit";
import { AgentLab } from "@/components/agents/AgentLab";

export const metadata: Metadata = { title: "Agent Security Lab" };

export default function AgentsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Lab · AI agents"
        title={
          <>
            Agent security <em className="text-cobalt">lab</em>
          </>
        }
        intro="An AI agent reads a repository and proposes a tool call. AgentSentry decides before anything runs. The agent and its tools are safe simulations; the deterministic risk engine, Gemma analysis and escalate-only verdict are real."
      />
      <Section>
        <AgentLab />
      </Section>
    </>
  );
}
