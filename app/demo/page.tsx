import { redirect } from "next/navigation";

// The original /demo moved: agent presets live at /agents, repository analysis at /repositories.
export default function DemoRedirect() {
  redirect("/agents");
}
