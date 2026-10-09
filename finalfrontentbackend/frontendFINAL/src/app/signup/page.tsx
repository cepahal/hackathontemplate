import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignupPage() {
  return (
    <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-16">
      <SignupForm />
    </main>
  );
}
