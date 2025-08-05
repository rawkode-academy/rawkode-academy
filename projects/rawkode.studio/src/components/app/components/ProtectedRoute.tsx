import { Navigate } from "react-router";
import { useAuth } from "@/components/app/contexts/AuthContext";

interface ProtectedRouteProps {
	children: React.ReactNode;
	requireAuth?: boolean;
	redirectTo?: string;
}

export function ProtectedRoute({
	children,
	requireAuth = true,
	redirectTo = "/",
}: ProtectedRouteProps) {
	const { user } = useAuth();

	if (requireAuth && !user) {
		return <Navigate to={redirectTo} replace />;
	}

	return <>{children}</>;
}
