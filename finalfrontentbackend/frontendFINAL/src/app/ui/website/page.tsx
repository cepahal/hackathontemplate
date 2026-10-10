import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check, Circle, FileText, MoreHorizontal } from "lucide-react";
import { WebsiteShell } from "@/components/layout/WebsiteShell";
import { TemplateNav } from "@/components/templates/TemplateNav";
import { buttonVariants } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Website template" };

export default function WebsitePreviewPage() {
  return (
    <WebsiteShell>
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8"><TemplateNav name="Website" /></div>
      <section className="border-b border-border bg-[#f4f2ed]">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8">
          <div><p className="mb-5 text-xs font-semibold tracking-[0.18em] text-slate-600">A LITTLE CLARITY GOES A LONG WAY</p><h1 className="max-w-xl text-4xl leading-[1.06] font-semibold tracking-[-0.045em] text-slate-900 sm:text-6xl">Good ideas deserve a clear starting point.</h1><p className="mt-6 max-w-lg text-base leading-8 text-slate-600">Give your work a home. Bring the scattered notes, the half-formed plans, and the thing you can’t stop thinking about.</p><Link href="/ui/workspace" className={buttonVariants({size:"lg",className:"mt-8"})}>Try the workspace <ArrowRight aria-hidden="true" className="size-4" /></Link><a href="#how-it-works" className="mt-5 flex min-h-11 w-fit items-center gap-2 rounded-md text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-ring">How it works <ArrowDown aria-hidden="true" className="size-4" /></a></div>
          <div className="relative min-w-0 py-4 sm:px-4">
            <div className="absolute inset-0 rounded-[2rem] border border-stone-300/60" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_20px_60px_-30px_#33415555]">
              <div className="flex items-center justify-between border-b border-stone-200 px-6 py-5"><span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileText aria-hidden="true" className="size-4 text-indigo-600" /> Fieldnotes</span><MoreHorizontal aria-hidden="true" className="size-5 text-slate-500" /></div>
              <div className="p-6 sm:p-8"><p className="text-[10px] font-semibold tracking-[0.18em] text-slate-500">PROJECT NOTE / 001</p><h2 className="mt-5 text-2xl leading-tight font-semibold tracking-tight text-slate-900">Less scattered.<br />More considered.</h2><p className="mt-4 text-sm leading-7 text-slate-600">One place for what you know, what you’re trying, and what comes next.</p><ul className="mt-6 divide-y divide-stone-200">{["Collect the useful pieces", "Find the thread between them", "Take the next small step"].map((step,index)=><li key={step} className="flex items-center gap-3 py-4 text-sm text-slate-700">{index < 2 ? <Check aria-hidden="true" className="size-4 shrink-0 text-emerald-700" /> : <Circle aria-hidden="true" className="size-4 shrink-0 text-slate-400" />}{step}</li>)}</ul><div className="mt-5 flex items-center justify-between border-t border-stone-200 pt-4 text-xs text-slate-500"><span>Made for a work in progress.</span><span className="font-mono">2 / 3</span></div></div>
            </div>
            <p className="relative mt-5 text-center text-xs text-slate-600">An example of the kind of thing you could make.</p>
          </div>
        </div>
      </section>
      <section id="how-it-works" aria-labelledby="process-heading" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mb-12 grid gap-6 md:grid-cols-2"><div><p className="mb-3 text-xs font-semibold tracking-[0.18em] text-primary">FROM A THOUGHT TO A THING</p><h2 id="process-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">Start small.<br />Make it yours.</h2></div><p className="max-w-lg self-end text-base leading-8 text-muted-foreground">There is no perfect first draft. A little structure helps you find the part worth building next.</p></div>
        <ol className="grid gap-8 md:grid-cols-3">{[{title:"Put it somewhere.",text:"Start a project and give the idea a name. You don’t need to know every detail yet."},{title:"Make a little progress.",text:"Keep the next action visible. Clear feedback makes it easier to see what changed."},{title:"Let it take shape.",text:"Adapt the layout, bring in your own content, and turn the first draft into something useful."}].map(({title,text},index)=><li key={title} className="border-t border-border pt-6"><span className="font-mono text-sm text-primary">0{index+1}</span><h3 className="mt-6 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{text}</p></li>)}</ol>
      </section>
      <section aria-labelledby="start-heading" className="border-t border-border bg-card px-4 py-16 text-center sm:px-6"><p className="text-xs font-semibold tracking-[0.18em] text-primary">YOUR NEXT CHAPTER</p><h2 id="start-heading" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Make a little room for your idea.</h2><p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-muted-foreground">Explore the working preview, or return to the library and choose the pieces that fit.</p><Link href="/ui/workspace" className={buttonVariants({size:"lg",className:"mt-7"})}>Open workspace <ArrowRight aria-hidden="true" className="size-4" /></Link></section>
    </WebsiteShell>
  );
}
