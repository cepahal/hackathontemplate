import type { Metadata } from "next";
import { UiLibrary } from "@/components/ui-library";

export const metadata: Metadata = {
  title: "UI library · Launchpad",
  description:
    "Reusable web and mobile layout shells, cards, and feedback states.",
};

export default function UiPage() {
  return <UiLibrary />;
}
