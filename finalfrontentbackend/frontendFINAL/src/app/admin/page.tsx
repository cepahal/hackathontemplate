import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { PageContainer } from "@/components/layout/PageContainer";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ROUTES } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin",
};

export default function AdminPage() {
  return (
    <AuthGuard role="admin" redirectTo={ROUTES.admin}>
      {(user) => (
        <PageContainer
          withSidebar
          userRole={user.role}
          title="Admin"
          description="Only users with the admin role can open this page."
          actions={
            <Badge variant="info">
              <ShieldCheck aria-hidden="true" className="size-3.5" />
              Admin
            </Badge>
          }
        >
          <div className="space-y-6">
            <Alert variant="info" title="Server-side check passed">
              This page was rendered only after <code>requireRole(&quot;admin&quot;)</code> verified
              your session with Supabase. Any admin API you add must repeat the check in the backend
              and in database policies.
            </Alert>
            <Card title="Signed-in admin">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="font-medium break-all">{user.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">User ID</dt>
                  <dd className="font-mono text-xs break-all">{user.id}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Role source</dt>
                  <dd className="font-medium">app_metadata.role</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last sign-in</dt>
                  <dd className="font-medium">
                    {user.lastSignInAt ? formatDateTime(user.lastSignInAt) : "—"}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>
        </PageContainer>
      )}
    </AuthGuard>
  );
}
