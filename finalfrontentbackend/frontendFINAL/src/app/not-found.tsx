import { SearchX } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROUTES } from "@/lib/constants";

export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-16">
      <EmptyState
        className="w-full bg-card"
        icon={SearchX}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={
          <Link href={ROUTES.dashboard} className={buttonVariants()}>
            Back to dashboard
          </Link>
        }
      />
    </main>
  );
}
