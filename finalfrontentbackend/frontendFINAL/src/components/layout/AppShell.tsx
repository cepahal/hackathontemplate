import { PageContainer, type PageContainerProps } from "@/components/layout/PageContainer";

export type AppShellProps = Omit<PageContainerProps, "withSidebar">;

/** Workspace body below the root's authenticated navigation; owns exactly one main landmark. */
export function AppShell(props: AppShellProps) {
  return <PageContainer {...props} withSidebar />;
}
