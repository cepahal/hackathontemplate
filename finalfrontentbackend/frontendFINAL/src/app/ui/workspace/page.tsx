import type { Metadata } from "next";
import { WorkspaceTemplate } from "@/components/templates/WorkspaceTemplate";

export const metadata: Metadata = { title: "Workspace template" };

export default function WorkspacePreviewPage() {
  return <WorkspaceTemplate />;
}
