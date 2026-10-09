import type { Metadata } from "next";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { PageContainer } from "@/components/layout/PageContainer";
import { SettingsPanels } from "@/components/settings/SettingsPanels";
import { ROUTES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <AuthGuard redirectTo={ROUTES.settings}>
      {(user) => (
        <PageContainer
          withSidebar
          userRole={user.role}
          title="Settings"
          description="Manage your profile, connection and account."
        >
          <SettingsPanels user={user} />
        </PageContainer>
      )}
    </AuthGuard>
  );
}
