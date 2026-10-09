"use client";

import { useEffect, useState } from "react";

/** Release the modal focus trap and scroll lock when desktop navigation appears. */
export function useNavigationDrawer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return [open, setOpen] as const;
}
