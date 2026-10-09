"use client";

import { NavigationLinks } from "@/components/layout/NavigationLinks";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { SIDEBAR_LINKS } from "@/lib/constants";
import type { Role } from "@/types/auth";

export function Sidebar({ userRole }: { userRole?: Role }) {
  return (
    <SidebarPanel title="Section navigation">
      <NavigationLinks items={SIDEBAR_LINKS} userRole={userRole} />
    </SidebarPanel>
  );
}
