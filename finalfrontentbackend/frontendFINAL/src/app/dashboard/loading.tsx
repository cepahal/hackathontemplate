import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <main
      id="main-content"
      aria-busy="true"
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
    >
      <span className="sr-only" role="status">
        Loading dashboard
      </span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-72" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-8 w-16" />
            <Skeleton className="mt-2 h-4 w-28" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <Skeleton className="mb-5 h-5 w-32" />
          <SkeletonText lines={5} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <Skeleton className="mb-5 h-5 w-28" />
          <SkeletonText lines={4} />
        </div>
      </div>
    </main>
  );
}
