import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/ui/kit";
import { IntelligenceBoard } from "@/components/intelligence/IntelligenceBoard";

export const metadata: Metadata = { title: "Snowflake Intelligence" };

export default function IntelligencePage() {
  return (
    <>
      <PageHeader
        eyebrow="05 · Record"
        title={
          <>
            Snowflake <em className="text-cobalt">intelligence</em>
          </>
        }
        intro="Every scan finding, remediation claim, verification and agent decision is written to Snowflake with parameterized SQL. These views are computed live from those rows — nothing here is sample data."
      />
      <Section>
        <IntelligenceBoard />
      </Section>
    </>
  );
}
