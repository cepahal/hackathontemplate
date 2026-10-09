import { CalendarClock, FolderOpen } from "lucide-react";
import type { Metadata } from "next";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { StatCard } from "@/components/dashboard/StatCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireUser } from "@/lib/auth";
import { ROUTES } from "@/lib/constants";
import { getDashboardStats, mockActivity, mockProjects, mockTasks } from "@/lib/mock-data";
import type { ProjectStatus } from "@/types";

export const metadata: Metadata = {
  title: "Dashboard",
};

const projectStatusBadge: Record<ProjectStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: "Active", variant: "success" },
  paused: { label: "Paused", variant: "warning" },
  completed: { label: "Completed", variant: "info" },
  archived: { label: "Archived", variant: "default" },
};

export default async function DashboardPage() {
  const user = await requireUser(ROUTES.dashboard);
  const stats = getDashboardStats();
  const displayName = user.fullName ?? user.email ?? "there";
  const tasksDue = mockTasks.filter((task) => task.status !== "done" && task.dueDate);

  return (
    <PageContainer
      withSidebar
      userRole={user.role}
      title="Dashboard"
      description={`Welcome back, ${displayName}. Here's what's happening today.`}
      actions={
        <Badge variant={user.role === "admin" ? "info" : "default"}>
          {user.role === "admin" ? "Admin" : "User"}
        </Badge>
      }
    >
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ id, ...stat }) => (
          <StatCard key={id} {...stat} />
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card
          id="projects"
          title="Projects"
          description="Everything your team is working on."
          className="lg:col-span-2"
        >
          {mockProjects.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No projects yet"
              description="Create your first project from Quick actions to get started."
            />
          ) : (
            <ul className="-my-1 divide-y divide-border">
              {mockProjects.map((project) => {
                const status = projectStatusBadge[project.status];
                return (
                  <li key={project.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{project.description}</p>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <QuickActions />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <RecentActivity id="activity" activities={mockActivity} className="lg:col-span-2" />

        <Card title="Upcoming deadlines" description="Tasks due in the next 7 days.">
          {tasksDue.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nothing due this week"
              description="Add due dates to tasks and they'll appear here."
            />
          ) : (
            <ul className="space-y-2">
              {tasksDue.map((task) => (
                <li key={task.id} className="text-sm text-foreground">
                  {task.title}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
