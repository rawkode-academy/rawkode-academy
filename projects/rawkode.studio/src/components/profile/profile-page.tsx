import type { OidcStandardClaimsWithRoles } from "@/lib/security";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/shadcn/avatar";
import { cn } from "@/lib/utils";

export interface Props {
  user: OidcStandardClaimsWithRoles;
}

export default function ProfilePage({ user }: Props) {
  const getInitials = (name: string | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const roleBadgeColors: Record<string, string> = {
    director: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    guest: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    rofl:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  };

  return (
    <div className="w-full p-4">
      <div className="p-2">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <Avatar className="size-24">
            <AvatarImage src={user.picture} alt={user.name || "User"} />
            <AvatarFallback className="text-lg">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-4 text-center sm:text-left">
            <div>
              <h1 className="text-2xl font-bold">
                {user.name || "Anonymous User"}
              </h1>
              <p className="text-muted-foreground">{user.email}</p>
              {user.preferred_username && (
                <p className="text-sm text-muted-foreground mt-1">
                  @{user.preferred_username}
                </p>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              {user.roles?.map((role) => (
                <span
                  key={role}
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    roleBadgeColors[role] || "bg-gray-100 text-gray-800",
                  )}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </span>
              ))}
            </div>

            {user.sub && (
              <div className="border-t pt-4 mt-4 text-xs">
                <p className="font-medium">User Info</p>
                <div className="mt-2 grid gap-y-2">
                  <div>
                    <span className="text-muted-foreground inline-block w-20">
                      Username:
                    </span>
                    <span>
                      {user.preferred_username || user.sub.split("@")[0]}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground inline-block w-20">
                      User ID:
                    </span>
                    <span className="break-all">{user.sub}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
