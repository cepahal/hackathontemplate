"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { PASSWORD_MIN_LENGTH, ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/browser";
import { isValidEmail } from "@/lib/utils";

interface SignupErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function validate(email: string, password: string, confirmPassword: string): SignupErrors {
  const errors: SignupErrors = {};
  if (!isValidEmail(email)) {
    errors.email = "Enter a valid email address.";
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!confirmPassword) {
    errors.confirmPassword = "Confirm your password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords don't match.";
  }
  return errors;
}

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<SignupErrors>({});
  const [serverError, setServerError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(email, password, confirmPassword);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const normalizedEmail = email.trim();
    setServerError(undefined);
    setSubmitting(true);
    try {
      const supabase = createClient();
      const callbackUrl = new URL(ROUTES.authCallback, window.location.origin);
      callbackUrl.searchParams.set("next", ROUTES.dashboard);

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { emailRedirectTo: callbackUrl.toString() },
      });
      if (error) {
        setServerError(getAuthErrorMessage(error));
        setSubmitting(false);
        return;
      }

      if (data.session) {
        router.replace(ROUTES.dashboard);
        router.refresh();
        return;
      }

      setPendingConfirmationEmail(normalizedEmail);
      setPassword("");
      setConfirmPassword("");
      setSubmitting(false);
    } catch (error) {
      setServerError(getAuthErrorMessage(error));
      setSubmitting(false);
    }
  };

  if (pendingConfirmationEmail) {
    return (
      <Card className="w-full max-w-md">
        <div className="flex flex-col items-center py-4 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
            <MailCheck aria-hidden="true" className="size-6" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground" role="status">
            If <span className="font-medium text-foreground">{pendingConfirmationEmail}</span> can
            be registered, we&apos;ve sent a confirmation link to it. Open the link in this browser
            to finish creating your account.
          </p>
          <Link href={ROUTES.login} className={buttonVariants({ variant: "outline", className: "mt-6" })}>
            Back to log in
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="w-full max-w-md"
      title={<span className="text-xl">Create your account</span>}
      description="It only takes a minute to get started."
      footer={
        <p className="w-full text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href={ROUTES.login} className="font-medium text-primary hover:underline">
            Log in
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
          autoComplete="new-password"
          helperText={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          disabled={submitting}
          required
        />
        <PasswordInput
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={errors.confirmPassword}
          disabled={submitting}
          required
        />
        <Button type="submit" className="w-full" loading={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </Card>
  );
}
