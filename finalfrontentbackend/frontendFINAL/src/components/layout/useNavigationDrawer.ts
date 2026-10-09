"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Navigation releases its modal state on a route change or desktop breakpoint. */
export function useNavigationDrawer() {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpenPath(null);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return {
    open: openPath !== null && openPath === pathname,
    openDrawer: () => setOpenPath(pathname),
    closeDrawer: () => setOpenPath(null),
  };
}
