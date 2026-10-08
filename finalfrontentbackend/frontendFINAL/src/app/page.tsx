import type { LucideIcon } from "lucide-react";
import { ArrowRight, LayoutDashboard, Rocket, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { APP_DESCRIPTION, APP_NAME, ROUTES } from "@/lib/constants";

const features: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "Ready-made UI kit",
    description: "Buttons, inputs, cards, modals, badges and loading states that share one look.",
    icon: Zap,
  },
  {
    title: "Dashboard layout",
    description: "Navbar, sidebar and page container wired up so new screens take minutes.",
    icon: LayoutDashboard,
  },
  {
    title: "Typed API client",
    description: "A small fetch wrapper with timeouts, auth headers and readable errors.",
    icon: ShieldCheck,
  },
];

export default function HomePage() {
  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
          <Rocket aria-hidden="true" className="size-3.5 text-primary" />
          Built for shipping fast
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          {APP_NAME}
        </h1>
        <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          {APP_DESCRIPTION}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href={ROUTES.dashboard} className={buttonVariants({ size: "lg" })}>
            Go to Dashboard
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link href={ROUTES.signup} className={buttonVariants({ variant: "outline", size: "lg" })}>
            Create an account
          </Link>
        </div>
      </section>

      <section
        aria-labelledby="features-heading"
        className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6"
      >
        <h2 id="features-heading" className="sr-only">
          Features
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {features.map(({ title, description, icon: Icon }) => (
            <li
              key={title}
              className="rounded-xl border border-border bg-card p-6 shadow-sm"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
