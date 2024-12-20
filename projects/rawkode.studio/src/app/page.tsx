import { SidebarInset, SidebarProvider } from "@/components/shadcn/sidebar";
import { AppSidebar } from "@/app/sidebar/app-siderbar";
import type { OidcStandardClaimsWithRoles } from "@/lib/security";

interface Props {
  user: OidcStandardClaimsWithRoles;
  children: React.ReactNode;
}

export default function Page(props: Props) {
  return (
    <SidebarProvider>
      <AppSidebar user={props.user} />
      <SidebarInset>{props.children}</SidebarInset>
    </SidebarProvider>
  );
}
