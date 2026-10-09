import type { LucideIcon } from "lucide-react";
import type { Role } from "@/types/auth";

export type UserRole = "owner" | "admin" | "member";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
}

export type ProjectStatus = "active" | "paused" | "completed" | "archived";

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = "todo" | "in_progress" | "done";

export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  dueDate?: string;
  createdAt: string;
}

export type ActivityType =
  | "project_created"
  | "task_completed"
  | "comment_added"
  | "member_joined"
  | "status_changed";

export interface Activity {
  id: string;
  type: ActivityType;
  actor: Pick<User, "id" | "name">;
  message: string;
  createdAt: string;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
}

export interface HealthResponse {
  status: "ok";
}

export interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  /** Hides the link for users below this role. UI hint only; pages must enforce access themselves. */
  requiredRole?: Role;
}

export type Trend = "up" | "down" | "neutral";

export interface Stat {
  id: string;
  label: string;
  value: number;
  change?: string;
  trend?: Trend;
  icon: LucideIcon;
}
