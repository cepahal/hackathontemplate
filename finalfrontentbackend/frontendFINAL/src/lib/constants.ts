import { Activity, FolderKanban, LayoutDashboard, Settings, ShieldCheck, Sparkles } from "lucide-react";
import type { NavItem } from "@/types";

export const APP_NAME = "Your Hackathon App";

export const APP_DESCRIPTION =
  "A clean, reusable starting point for building and demoing your hackathon idea.";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

export const API_TIMEOUT_MS = 15_000;

/** FastAPI backend prefix (finalfrontentbackend/backendFINAL). */
export const API_V1_PREFIX = "/api/v1";

export const API_HEALTH_PATH = `${API_V1_PREFIX}/health`;

export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  dashboard: "/dashboard",
  settings: "/settings",
  ai: "/ai",
  admin: "/admin",
  forbidden: "/forbidden",
  authCallback: "/auth/callback",
} as const;

/** Require a signed-in user. Enforced by `src/proxy.ts` and again inside each page. */
export const PROTECTED_ROUTES: readonly string[] = [ROUTES.dashboard, ROUTES.settings, ROUTES.ai, ROUTES.admin];

/** Signed-in users visiting these are sent to the dashboard. */
export const AUTH_ROUTES: readonly string[] = [ROUTES.login, ROUTES.signup];

export const PASSWORD_MIN_LENGTH = 8;

export const NAVBAR_LINKS: NavItem[] = [
  { label: "Dashboard", href: ROUTES.dashboard },
  { label: "Settings", href: ROUTES.settings },
];

export const AUTH_LINKS = {
  login: { label: "Log in", href: ROUTES.login },
  signup: { label: "Sign up", href: ROUTES.signup },
} as const satisfies Record<string, NavItem>;

// Projects and Activity point at dashboard sections until dedicated pages exist.
export const SIDEBAR_LINKS: NavItem[] = [
  { label: "Dashboard", href: ROUTES.dashboard, icon: LayoutDashboard },
  { label: "Projects", href: `${ROUTES.dashboard}#projects`, icon: FolderKanban },
  { label: "Activity", href: `${ROUTES.dashboard}#activity`, icon: Activity },
  { label: "AI", href: ROUTES.ai, icon: Sparkles },
  { label: "Settings", href: ROUTES.settings, icon: Settings },
  { label: "Admin", href: ROUTES.admin, icon: ShieldCheck, requiredRole: "admin" },
];
