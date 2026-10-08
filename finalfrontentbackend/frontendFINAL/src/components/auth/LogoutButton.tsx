"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

export interface LogoutButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  label?: string;
  className?: string;
}

export function LogoutButton({
  variant = "ghost",
  size = "sm",
  label = "Log out",
  className,
}: LogoutButtonProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    setError(null);
    setLoggingOut(true);
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError(getAuthErrorMessage(signOutError));
        setLoggingOut(false);
        return;
      }
      router.replace(ROUTES.login);
      router.refresh();
    } catch (caught) {
      setError(getAuthErrorMessage(caught));
      setLoggingOut(false);
    }
  };

  return (
    <span className={cn("inline-flex flex-col items-end gap-1", className)}>
      <Button variant={variant} size={size} onClick={handleLogout} loading={loggingOut}>
        {!loggingOut && <LogOut aria-hidden="true" className="size-4" />}
        {label}
      </Button>
      {error && (
        <span role="alert" className="max-w-56 text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
