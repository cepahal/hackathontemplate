import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROUTES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Access denied",
  robots: { index: false },
};

export default function ForbiddenPage() {
  return (
    <main id="main-content" className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-16">
      <EmptyState
        className="w-full bg-card"
        icon={ShieldAlert}
        title="You don't have access to this page"
        description="Your account doesn't have the role this page requires. Ask an administrator if you think this is a mistake."
        action={
          <Link href={ROUTES.dashboard} className={buttonVariants()}>
            Back to dashboard
          </Link>
        }
      />
    </main>
  );
}
