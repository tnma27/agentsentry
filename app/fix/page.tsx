import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/ui/kit";
import { FixStudio } from "@/components/fix/FixStudio";

export const metadata: Metadata = { title: "AI Fix Studio" };

export default function FixPage() {
  return (
    <>
      <PageHeader
        eyebrow="02 · Explain & fix"
        title={
          <>
            AI Fix <em className="text-cobalt">Studio</em>
          </>
        }
        intro="Gemma turns a deterministic finding into a plain-language explanation and a platform-specific fix grounded in the observed evidence. Then you record what you did, and a rescan proves whether it worked."
      />
      <Section>
        <FixStudio />
      </Section>
    </>
  );
}
