import type { Metadata } from "next";
import { AIPlayground } from "@/components/ai/AIPlayground";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { PageContainer } from "@/components/layout/PageContainer";
import { ROUTES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "AI",
};

export default function AIPage() {
  return (
    <AuthGuard redirectTo={ROUTES.ai}>
      {(user) => (
        <PageContainer
          withSidebar
          userRole={user.role}
          title="AI"
          description="Stream answers, generate structured plans and analyze files. Keys stay on the server."
        >
          <AIPlayground />
        </PageContainer>
      )}
    </AuthGuard>
  );
}
