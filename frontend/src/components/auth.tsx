"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Command, LockKeyhole } from "lucide-react";
import { api, errorMessage, type Identity } from "@/lib/client";
import { authConfigured, getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { ErrorNotice, Loading } from "@/components/ui/feedback";

const AuthContext = createContext<Identity | null>(null);
export function useIdentity() {
  const identity = useContext(AuthContext);
  if (!identity) throw new Error("This feature requires a verified session.");
  return identity;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const verifiedUser = useRef<string | null>(null);
  const verificationVersion = useRef(0);
  const invalidateVerification = useCallback(() => {
    verificationVersion.current++;
  }, []);
  const verify = useCallback(async () => {
    const version = ++verificationVersion.current;
    setLoading(true);
    setError("");
    try {
      const client = getSupabase();
      if (!client) {
        if (version === verificationVersion.current) setIdentity(null);
        return;
      }
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      const user = data.session ? await api<Identity>("/api/v1/auth/me") : null;
      if (version !== verificationVersion.current) return;
      verifiedUser.current = user?.id ?? null;
      setIdentity(user);
    } catch (err) {
      if (version === verificationVersion.current) {
        setIdentity(null);
        setError(errorMessage(err));
      }
    } finally {
      if (version === verificationVersion.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) void verify();
    }, 0);
    const client = getSupabase();
    // Keep network work outside Supabase's auth callback to avoid its auth lock.
    const listener = client?.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        verificationVersion.current++;
        verifiedUser.current = null;
        setIdentity(null);
        setError("");
        setLoading(false);
      } else if (
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED" ||
        (event === "SIGNED_IN" && session?.user.id !== verifiedUser.current)
      ) {
        const scheduledVersion = verificationVersion.current;
        setTimeout(() => {
          if (active && scheduledVersion === verificationVersion.current)
            void verify();
        }, 0);
      }
    });
    return () => {
      active = false;
      invalidateVerification();
      clearTimeout(timer);
      listener?.data.subscription.unsubscribe();
    };
  }, [verify, invalidateVerification]);
  if (loading)
    return (
      <div className="min-h-screen bg-background pt-24">
        <Loading label="Verifying your session…" />
      </div>
    );
  if (error)
    return (
      <div className="mx-auto max-w-xl px-5 py-24">
        <h1 className="mb-5 text-2xl font-semibold">
          Your workspace needs attention
        </h1>
        <ErrorNotice message={error} retry={() => void verify()} />
        <Button
          className="mt-5"
          variant="outline"
          onClick={async () => {
            await getSupabase()?.auth.signOut();
            setError("");
            setIdentity(null);
          }}
        >
          Return to sign in
        </Button>
      </div>
    );
  if (!identity) return <LoginForm onSignedIn={verify} />;
  return (
    <AuthContext.Provider value={identity}>{children}</AuthContext.Provider>
  );
}

export function LoginForm({
  onSignedIn,
}: {
  onSignedIn?: () => Promise<void>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const client = getSupabase();
      if (!client)
        throw new Error(
          "Configure the Supabase URL and public key before signing in.",
        );
      const credentials = {
        email: String(form.get("email")).trim(),
        password: String(form.get("password")),
      };
      const result =
        mode === "login"
          ? await client.auth.signInWithPassword(credentials)
          : await client.auth.signUp({
              ...credentials,
              options: { emailRedirectTo: `${window.location.origin}/` },
            });
      if (result.error) throw result.error;
      if (!result.data.session)
        setMessage(
          "Check your email to confirm your account, then return here to sign in.",
        );
      else if (onSignedIn) await onSignedIn();
      else router.push("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    setBusy(true);
    setError("");
    try {
      const client = getSupabase();
      if (!client) throw new Error("Supabase setup is required.");
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hero-grid hidden flex-col justify-between bg-[#e9efdf] p-12 lg:flex">
        <Link
          href="/welcome"
          className="flex items-center gap-3 text-2xl font-semibold"
        >
          <Command className="size-8" />
          launchpad.
        </Link>
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary">
            YOUR NEXT IDEA, TOGETHER.
          </p>
          <h1 className="mt-5 max-w-lg text-6xl leading-[1.06] font-semibold tracking-tight">
            Less setup.
            <br />
            More making.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">
            Projects, AI, documents, and the tools that move your idea forward.
            One workspace to make it real.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Your data belongs to your account.
        </p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-7 flex size-11 items-center justify-center rounded-xl bg-secondary">
            <LockKeyhole className="size-5 text-primary" />
          </div>
          <h2 className="text-3xl font-semibold tracking-tight">
            {mode === "login" ? "Welcome back." : "Make a fresh start."}
          </h2>
          <p className="mt-3 mb-7 text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in to your workspace."
              : "Create your account to get started."}
          </p>
          {!authConfigured && (
            <div className="mb-5">
              <ErrorNotice message="Setup required: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local, then rebuild or restart the frontend. Use the public anon key, never a service-role key." />
            </div>
          )}
          {error && (
            <div className="mb-5">
              <ErrorNotice message={error} />
            </div>
          )}
          {message && (
            <p
              role="status"
              className="mb-5 rounded-lg bg-secondary p-4 text-sm leading-6"
            >
              {message}
            </p>
          )}
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email address" htmlFor="email">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </Field>
            <Field
              label="Password"
              htmlFor="password"
              hint={
                mode === "signup" ? "Use at least 8 characters." : undefined
              }
            >
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={mode === "signup" ? 8 : 1}
              />
            </Field>
            <Button
              type="submit"
              className="w-full"
              disabled={busy || !authConfigured}
            >
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
              <ArrowRight />
            </Button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => void google()}
            disabled={busy || !authConfigured}
          >
            Continue with Google
          </Button>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button
              className="font-semibold text-primary underline-offset-4 hover:underline"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
                setMessage("");
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
          <Link
            href="/welcome"
            className="mt-8 block text-center text-xs text-muted-foreground hover:underline"
          >
            Explore the starter
          </Link>
        </div>
      </section>
    </main>
  );
}
