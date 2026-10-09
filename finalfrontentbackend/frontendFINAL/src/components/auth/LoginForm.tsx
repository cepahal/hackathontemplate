"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/browser";
import { isValidEmail } from "@/lib/utils";

interface LoginErrors {
  email?: string;
  password?: string;
}

export interface LoginFormProps {
  /** Already-validated same-origin path to open after login. */
  redirectTo: string;
  initialError?: string;
}

export function LoginForm({ redirectTo, initialError }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [serverError, setServerError] = useState<string | undefined>(initialError);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: LoginErrors = {};
    if (!isValidEmail(email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Enter your password.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setServerError(undefined);
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setServerError(getAuthErrorMessage(error));
        setSubmitting(false);
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    } catch (error) {
      setServerError(getAuthErrorMessage(error));
      setSubmitting(false);
    }
  };

  return (
    <Card
      className="w-full max-w-md"
      title={<span className="text-xl">Welcome back</span>}
      description="Log in to continue to your dashboard."
      footer={
        <p className="w-full text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href={ROUTES.signup} className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {serverError && <Alert variant="error">{serverError}</Alert>}
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          disabled={submitting}
          required
        />
        <PasswordInput
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          disabled={submitting}
          required
        />
        <Button type="submit" className="w-full" loading={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </Card>
  );
}
