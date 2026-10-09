import { PageContainer, type PageContainerProps } from "@/components/layout/PageContainer";

export type WebsiteShellProps = Omit<PageContainerProps, "withSidebar" | "sidebar" | "userRole">;

/** Landing-page body; the root layout supplies shared navigation and the site footer. */
export function WebsiteShell({ fullWidth = true, ...props }: WebsiteShellProps) {
  return <PageContainer {...props} fullWidth={fullWidth} />;
}
