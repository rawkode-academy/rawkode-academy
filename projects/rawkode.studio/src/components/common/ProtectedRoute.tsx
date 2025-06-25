import { Navigate } from "react-router";
import type { OidcStandardClaimsWithRoles } from "@/lib/auth";

interface Props {
  user: OidcStandardClaimsWithRoles;
  requiredRole?: "director" | "guest" | "contributor";
  children: React.ReactNode;
}

export default function ProtectedRoute({
  user,
  requiredRole = "director",
  children,
}: Props) {
  if (!user.roles?.includes(requiredRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
