import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/ui/kit";
import { MonitorBoard } from "@/components/monitor/MonitorBoard";

export const metadata: Metadata = { title: "Monitoring" };

export default function MonitorPage() {
  return (
    <>
      <PageHeader
        eyebrow="04 · Monitor"
        title={
          <>
            Watch the <em className="text-cobalt">drift</em>
          </>
        }
        intro="Every saved scan becomes history. Compare the latest scan of each site with the one before it: what is new, what was verifiably resolved, what keeps coming back."
      />
      <Section>
        <MonitorBoard />
      </Section>
    </>
  );
}
