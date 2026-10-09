import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

export function TemplateNav({ name }: { name: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
      <Link href="/ui" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
        <ArrowLeft aria-hidden="true" className="size-4" /> All templates
      </Link>
      <span className="text-xs font-medium tracking-wide text-muted-foreground">{name} / INTERACTIVE PREVIEW</span>
      <Link href={name === "Website" ? "/ui/workspace" : "/ui/website"} className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-primary focus-visible:outline-2 focus-visible:outline-ring">
        {name === "Website" ? "Workspace template" : "Website template"}
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}
