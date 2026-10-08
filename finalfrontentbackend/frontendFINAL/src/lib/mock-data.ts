import { CircleCheck, FolderKanban, ListTodo, Users } from "lucide-react";
import type { Activity, Project, Stat, Task } from "@/types";

export const mockProjects: Project[] = [
  {
    id: "proj_1",
    name: "Onboarding flow",
    description: "Sign-up, welcome screens and first-run checklist.",
    status: "active",
    ownerId: "user_1",
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-10-06T16:30:00.000Z",
  },
  {
    id: "proj_2",
    name: "Analytics dashboard",
    description: "Charts and KPIs for the demo account.",
    status: "active",
    ownerId: "user_1",
    createdAt: "2026-09-24T12:00:00.000Z",
    updatedAt: "2026-10-06T11:15:00.000Z",
  },
  {
    id: "proj_3",
    name: "Mobile layout",
    description: "Responsive pass across core screens.",
    status: "paused",
    ownerId: "user_2",
    createdAt: "2026-09-28T08:45:00.000Z",
    updatedAt: "2026-10-04T09:20:00.000Z",
  },
  {
    id: "proj_4",
    name: "Pitch deck assets",
    description: "Screenshots and diagrams for the final demo.",
    status: "completed",
    ownerId: "user_3",
    createdAt: "2026-09-15T14:00:00.000Z",
    updatedAt: "2026-10-02T18:00:00.000Z",
  },
];

export const mockTasks: Task[] = [
  {
    id: "task_1",
    projectId: "proj_1",
    title: "Write welcome copy",
    status: "done",
    priority: "medium",
    assigneeId: "user_1",
    createdAt: "2026-10-01T09:00:00.000Z",
  },
  {
    id: "task_2",
    projectId: "proj_1",
    title: "Add first-run checklist",
    status: "in_progress",
    priority: "high",
    assigneeId: "user_2",
    createdAt: "2026-10-02T09:00:00.000Z",
  },
  {
    id: "task_3",
    projectId: "proj_2",
    title: "Wire KPI cards to API",
    status: "todo",
    priority: "high",
    createdAt: "2026-10-03T09:00:00.000Z",
  },
  {
    id: "task_4",
    projectId: "proj_2",
    title: "Empty state for charts",
    status: "todo",
    priority: "low",
    createdAt: "2026-10-04T09:00:00.000Z",
  },
  {
    id: "task_5",
    projectId: "proj_4",
    title: "Export architecture diagram",
    status: "done",
    priority: "medium",
    assigneeId: "user_3",
    createdAt: "2026-10-01T15:00:00.000Z",
  },
];

export const mockActivity: Activity[] = [
  {
    id: "act_1",
    type: "task_completed",
    actor: { id: "user_1", name: "Alex Morgan" },
    message: "completed “Write welcome copy” in Onboarding flow",
    createdAt: "2026-10-06T16:30:00.000Z",
  },
  {
    id: "act_2",
    type: "comment_added",
    actor: { id: "user_2", name: "Sam Rivera" },
    message: "commented on “Add first-run checklist”",
    createdAt: "2026-10-06T14:05:00.000Z",
  },
  {
    id: "act_3",
    type: "status_changed",
    actor: { id: "user_2", name: "Sam Rivera" },
    message: "paused Mobile layout",
    createdAt: "2026-10-04T09:20:00.000Z",
  },
  {
    id: "act_4",
    type: "member_joined",
    actor: { id: "user_3", name: "Jordan Lee" },
    message: "joined the workspace",
    createdAt: "2026-10-03T11:00:00.000Z",
  },
  {
    id: "act_5",
    type: "project_created",
    actor: { id: "user_1", name: "Alex Morgan" },
    message: "created Analytics dashboard",
    createdAt: "2026-09-24T12:00:00.000Z",
  },
];

export const mockTeamSize = 3;

export function getDashboardStats(): Stat[] {
  const activeProjects = mockProjects.filter((p) => p.status === "active").length;
  const openTasks = mockTasks.filter((t) => t.status !== "done").length;
  const completedTasks = mockTasks.filter((t) => t.status === "done").length;

  return [
    {
      id: "projects",
      label: "Active projects",
      value: activeProjects,
      change: `${mockProjects.length} total`,
      trend: "neutral",
      icon: FolderKanban,
    },
    {
      id: "open-tasks",
      label: "Open tasks",
      value: openTasks,
      change: "+2 this week",
      trend: "up",
      icon: ListTodo,
    },
    {
      id: "completed",
      label: "Completed tasks",
      value: completedTasks,
      change: "+1 since yesterday",
      trend: "up",
      icon: CircleCheck,
    },
    {
      id: "team",
      label: "Team members",
      value: mockTeamSize,
      change: "No change",
      trend: "neutral",
      icon: Users,
    },
  ];
}
