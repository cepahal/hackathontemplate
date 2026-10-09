import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { getCurrentUser } from "@/lib/auth";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = {
  themeColor: "#f8fafc",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body className="flex min-h-dvh min-w-0 flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-[max(0.75rem,env(safe-area-inset-top))] focus:left-[max(0.75rem,env(safe-area-inset-left))] focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:shadow-md focus:outline-2 focus:outline-ring"
        >
          Skip to content
        </a>
        <Navbar user={user} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        <Footer links={<Link href="/ui" className="font-medium transition-colors hover:text-foreground">Explore the UI library</Link>}>
          © {new Date().getFullYear()} {APP_NAME}
        </Footer>
      </body>
    </html>
  );
}
