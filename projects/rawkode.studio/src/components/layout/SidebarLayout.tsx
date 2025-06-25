import { QueryClientProvider } from "@tanstack/react-query";
import {
  Book,
  Camera,
  History,
  Home,
  LogOut,
  MoreVertical,
  User,
  Video,
} from "lucide-react";
import { Link } from "react-router";
import { ModeToggle } from "@/components/common/ModeToggle";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/shadcn/avatar";
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/shadcn/sidebar";
import type { OidcStandardClaimsWithRoles } from "@/lib/auth";
import { queryClient } from "@/store";

interface UserNavigationProps {
  user: OidcStandardClaimsWithRoles;
}

function UserNavigation({ user }: UserNavigationProps) {
  const { isMobile } = useSidebar();

  const getInitials = (name: string | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <Avatar className="size-8 mr-2">
            <AvatarImage src={user.picture} alt={user.name || "User"} />
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span>{user.preferred_username || user.name}</span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
          <MoreVertical className="ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={4}
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
  );
}

interface Props {
  title: string;
  user: OidcStandardClaimsWithRoles;
  children: React.ReactNode;
}

export default function SidebarLayout({ user, title, children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <Sidebar collapsible="icon" variant="inset">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild>
                  <Link to="/">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <Camera className="size-4" />
                    </div>
                    <div className="flex flex-col gap-0.5 leading-none">
                      <span className="font-semibold">RawkodeStudio</span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Studio</SidebarGroupLabel>
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
            {user.roles?.includes("director") && (
              <>
                <SidebarGroup>
                  <SidebarGroupLabel>Live Streams</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <Link to="/livestreams/active">
                            <Video />
                            <span>Active Streams</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <Link to="/livestreams/past">
                            <History />
                            <span>Past Streams</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                  <SidebarGroupLabel>Help & Resources</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <Link to="/documentation">
                            <Book />
                            <span>Studio Guide</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            )}
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <UserNavigation user={user} />
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

          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </QueryClientProvider>
  );
}
