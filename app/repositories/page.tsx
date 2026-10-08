import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/ui/kit";
import { RepoLab } from "@/components/agents/RepoLab";

export const metadata: Metadata = { title: "Repository Security" };

export default function RepositoriesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Lab · Repositories"
        title={
          <>
            Repository <em className="text-cobalt">security</em>
          </>
        }
        intro="Agents increasingly read public repositories. AgentSentry fetches a small, fixed set of public files, treats them as untrusted, detects agent-directed instructions, and runs the action an obedient agent would attempt through the real gateway."
      />
      <Section>
        <RepoLab />
      </Section>
    </>
  );
}
