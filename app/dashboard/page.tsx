import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/ui/kit";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = { title: "Security Overview" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={
          <>
            Security <em className="text-cobalt">posture</em>
          </>
        }
        intro="Where you stand right now: the latest stored scan of every site, what is open, what was verifiably fixed, and the fastest way back into the workflow."
      />
      <Section>
        <Dashboard />
      </Section>
    </>
  );
}
