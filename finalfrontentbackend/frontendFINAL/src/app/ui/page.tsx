import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, LayoutGrid, Menu, PanelTop } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ComponentShowcase } from "@/components/templates/ComponentShowcase";

export const metadata: Metadata = { title: "UI library", description: "Polished mobile and desktop layouts ready to make your own." };

export default function UILibraryPage() {
  return (
    <PageContainer>
      <section className="grid gap-8 border-b border-border pt-4 pb-12 sm:pt-10 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
        <div><p className="mb-5 text-xs font-semibold tracking-[0.2em] text-primary">THE INTERFACE WORKSHOP</p><h1 className="max-w-2xl text-4xl leading-[1.08] font-semibold tracking-[-0.045em] sm:text-6xl">Make the first<br />screen count.</h1></div>
        <div><p className="max-w-md text-base leading-8 text-muted-foreground">The structure is here. The idea is yours. Start with a polished layout, then spend your time on what makes your project different.</p><p className="mt-5 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Check aria-hidden="true" className="size-4 text-success" /> Desktop, tablet, and phone</p></div>
      </section>
      <section aria-labelledby="templates-heading" className="py-12 sm:py-16">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold tracking-[0.18em] text-primary">01 / PICK YOUR STARTING POINT</p><h2 id="templates-heading" className="text-2xl font-semibold tracking-tight">Two ways into your next idea.</h2></div><p className="text-sm text-muted-foreground">Real components. Working interactions.</p></div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Link href="/ui/workspace" className="group overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            <div aria-hidden="true" className="border-b border-border bg-slate-100 p-6 sm:p-10">
              <div className="flex min-h-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="hidden w-28 shrink-0 border-r border-slate-200 bg-slate-50 p-4 sm:block"><LayoutGrid className="mb-7 size-5 text-primary" /><div className="space-y-3"><div className="h-2 w-16 rounded bg-primary/25" /><div className="h-2 w-12 rounded bg-slate-200" /><div className="h-2 w-14 rounded bg-slate-200" /></div></div>
                <div className="min-w-0 flex-1 p-5"><div className="flex justify-between gap-3"><span className="text-sm font-semibold">Projects</span><span className="rounded bg-primary px-2 py-1 text-[10px] text-white">+ New</span></div><div className="mt-5 flex gap-2"><span className="h-1.5 w-12 rounded bg-primary/30" /><span className="h-1.5 w-10 rounded bg-slate-200" /></div><div className="mt-5 space-y-2">{["Fieldnotes", "Signal", "Atlas"].map((name, index) => <div key={name} className="flex items-center gap-3 rounded border border-slate-200 px-3 py-2"><span className="size-5 rounded bg-primary-soft" /><span className="flex-1 text-[11px] font-medium">{name}</span><span className={`size-1.5 rounded-full ${index === 2 ? "bg-emerald-600" : "bg-indigo-500"}`} /></div>)}</div></div>
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 p-6 sm:p-7"><div><p className="mb-2 text-xs font-medium text-primary">WORKSPACE / 01</p><h3 className="text-xl font-semibold">A place to get things done.</h3><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Sidebar navigation, searchable projects, useful states, and a focused create flow.</p><span className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">Explore workspace <ArrowUpRight className="size-4" /></span></div></div>
          </Link>
          <Link href="/ui/website" className="group overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            <div aria-hidden="true" className="border-b border-border bg-[#edeae4] p-6 sm:p-10">
              <div className="min-h-56 overflow-hidden rounded-lg border border-stone-200 bg-[#faf9f6] shadow-sm"><div className="flex items-center justify-between border-b border-stone-200 px-5 py-3"><PanelTop className="size-4 text-slate-800" /><Menu className="size-3 text-slate-500" /></div><div className="grid grid-cols-[1.1fr_0.9fr] items-center gap-4 p-5"><div><span className="text-[8px] font-semibold tracking-widest text-slate-500">START SOMETHING GOOD</span><p className="mt-3 text-xl leading-tight font-semibold tracking-tight text-slate-900">A clear place<br />to begin.</p><div className="mt-4 h-5 w-20 rounded bg-slate-900" /></div><div className="rounded-xl border border-stone-200 bg-white p-3"><div className="mb-5 h-1.5 w-10 rounded bg-stone-200" /><div className="mb-2 h-2 w-full rounded bg-slate-700" /><div className="mb-4 h-2 w-2/3 rounded bg-slate-400" /><div className="space-y-2">{[0,1,2].map(n=><div key={n} className="h-5 rounded border border-stone-200" />)}</div></div></div></div>
            </div>
            <div className="p-6 sm:p-7"><p className="mb-2 text-xs font-medium text-primary">WEBSITE / 02</p><h3 className="text-xl font-semibold">Give your idea a proper introduction.</h3><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">An editorial hero, a product preview, and a simple path from curiosity to action.</p><span className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">Explore website <ArrowUpRight aria-hidden="true" className="size-4" /></span></div>
          </Link>
        </div>
      </section>
      <ComponentShowcase />
    </PageContainer>
  );
}
