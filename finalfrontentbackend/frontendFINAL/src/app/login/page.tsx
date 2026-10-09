import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { getRedirectErrorMessage } from "@/lib/auth-errors";
import { getSafeRedirectPath } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Log in",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const redirectTo = getSafeRedirectPath(firstValue(params.next));
  const initialError = getRedirectErrorMessage(firstValue(params.error));

  return (
    <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-16">
      <LoginForm redirectTo={redirectTo} initialError={initialError} />
    </main>
  );
}
