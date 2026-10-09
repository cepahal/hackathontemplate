import type { LucideIcon } from "lucide-react";
import { CircleCheck, FolderPlus, MessageSquare, RefreshCw, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime, getInitials } from "@/lib/utils";
import type { Activity, ActivityType } from "@/types";

const activityIcons: Record<ActivityType, LucideIcon> = {
  project_created: FolderPlus,
  task_completed: CircleCheck,
  comment_added: MessageSquare,
  member_joined: UserPlus,
  status_changed: RefreshCw,
};

export interface RecentActivityProps {
  activities: Activity[];
  id?: string;
  className?: string;
}

export function RecentActivity({ activities, id, className }: RecentActivityProps) {
  return (
    <Card
      id={id}
      title="Recent activity"
      description="Latest updates across your workspace."
      className={className}
    >
      {activities.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Updates from your team will show up here as work happens."
        />
      ) : (
        <ol className="-my-1 divide-y divide-border">
          {activities.map((activity) => {
            const Icon = activityIcons[activity.type];
            return (
              <li key={activity.id} className="flex items-start gap-3 py-3">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
                >
                  {getInitials(activity.actor.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{activity.actor.name}</span>{" "}
                    <span className="text-muted-foreground">{activity.message}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon aria-hidden="true" className="size-3.5" />
                    <time dateTime={activity.createdAt}>{formatDateTime(activity.createdAt)}</time>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
