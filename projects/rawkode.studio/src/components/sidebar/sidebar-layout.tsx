import { version } from "@/../package.json";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { Separator } from "@/components/shadcn/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/shadcn/sidebar";
import type { OidcStandardClaimsWithRoles } from "@/lib/security";
import { queryClient } from "@/store";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  Camera,
  ChevronUp,
  Home,
  LogOut,
  User,
  User2,
  Video,
} from "lucide-react";
import { Link } from "react-router";
import CreateLivestreamsDialog from "../livestreams/create-livestreams-dialog";
import LivestreamCounter from "./livestream-counter";
import { ModeToggle } from "../common/ModeToggle";

interface Props {
  title: string;
  user: OidcStandardClaimsWithRoles;
  children: React.ReactNode;
}

export default function SidebarLayout({ user, title, children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild>
                  <Link to="/">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <Camera className="size-4" />
                    </div>
                    <div className="flex flex-col gap-0.5 leading-none">
                      <span className="font-semibold">
                        RawkodeStudio
                      </span>
                      <span className="">{version}</span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>
                Studio
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link to="/">
                        <Home />
                        <span>Home</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>
                Live Streams
              </SidebarGroupLabel>
              <CreateLivestreamsDialog />
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link to="/livestreams/active">
                        <Video />
                        <span>Active Streams</span>
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuBadge>
                      <LivestreamCounter />
                    </SidebarMenuBadge>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton>
                      <User2 />
                      {user.name}
                      <ChevronUp className="ml-auto" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    side="top"
                    className="w-[--radix-popper-anchor-width]"
                  >
                    <DropdownMenuItem asChild>
                      <Link to="/profile">
                        <User />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href="/api/auth/logout">
                        <LogOut />
                        Logout
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex justify-between w-full pr-4">
              <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
                  {title}
                </h4>
              </div>

              <ModeToggle />
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </QueryClientProvider>
  );
}
