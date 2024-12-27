import type { OidcStandardClaimsWithRoles } from "@/lib/security";

export interface Props {
  user: OidcStandardClaimsWithRoles;
}

export default function ProfilePage({ user }: Props) {
  return <>{user.name}</>;
}
