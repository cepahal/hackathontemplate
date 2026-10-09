import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import type { Stat, Trend } from "@/types";

const trendStyles: Record<Trend, { className: string; icon: typeof TrendingUp; label?: string }> = {
  up: { className: "text-success", icon: TrendingUp, label: "Trending up" },
  down: { className: "text-danger", icon: TrendingDown, label: "Trending down" },
  neutral: { className: "text-muted-foreground", icon: Minus },
};

export type StatCardProps = Omit<Stat, "id"> & { className?: string };

export function StatCard({
  label,
  value,
  change,
  trend = "neutral",
  icon: Icon,
  className,
}: StatCardProps) {
  const trendStyle = trendStyles[trend];
  const TrendIcon = trendStyle.icon;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        {formatNumber(value)}
      </p>
      {change && (
        <p className={cn("mt-1 flex items-center gap-1 text-sm", trendStyle.className)}>
          <TrendIcon aria-hidden="true" className="size-4" />
          {trendStyle.label && <span className="sr-only">{trendStyle.label}: </span>}
          {change}
        </p>
      )}
    </div>
  );
}
