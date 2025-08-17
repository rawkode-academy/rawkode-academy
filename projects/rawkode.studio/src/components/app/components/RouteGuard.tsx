import { useEffect } from "react";
import { useAuth } from "@/components/app/contexts/AuthContext";
import {
	hasDirectorRole,
	type OidcStandardClaimsWithRoles,
} from "@/lib/auth/auth-types";

export enum AccessLevel {
	PUBLIC = "public", // Anyone can access (guest/anonymous allowed)
	AUTHENTICATED = "authenticated", // Must be logged in
	DIRECTOR = "director", // Must have director role
	ADMIN = "admin", // Future: admin only
}

interface RouteGuardProps {
	children: React.ReactNode;
	accessLevel: AccessLevel;
	fallback?: React.ReactNode;
	redirectTo?: string;
}

function AccessDenied({ accessLevel }: { accessLevel: AccessLevel }) {
	const handleLogin = () => {
		window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
	};

	return (
		<div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
			<div className="bg-gray-800 border border-gray-700 rounded-lg p-8 max-w-md w-full text-center">
				<div className="mb-6">
					<div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
						<svg
							className="w-8 h-8 text-red-500"
							fill="none"
							strokeWidth="2"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-label="Warning icon"
						>
							<title>Warning</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
							/>
						</svg>
					</div>
					<h2 className="text-xl font-semibold text-white mb-2">
						Access Denied
					</h2>
					<p className="text-gray-400">
						{accessLevel === AccessLevel.AUTHENTICATED &&
							"You need to be logged in to access this page."}
						{accessLevel === AccessLevel.DIRECTOR &&
							"This page requires director privileges."}
						{accessLevel === AccessLevel.ADMIN &&
							"This page requires administrator access."}
					</p>
				</div>

				<div className="space-y-3">
					<button
						type="button"
						onClick={handleLogin}
						className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
					>
						Login
					</button>
					<button
						type="button"
						onClick={() => {
							window.location.href = "/";
						}}
						className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
					>
						Go Home
					</button>
				</div>
			</div>
		</div>
	);
}

/**
 * Secure route guard that validates access using the user from Astro context
 */
export function RouteGuard({
	children,
	accessLevel,
	fallback,
	redirectTo,
}: RouteGuardProps) {
	const { user } = useAuth(); // User comes from Astro.locals.user via App component

	useEffect(() => {
		// Check access and redirect if needed
		const hasAccess = checkClientAccess(user, accessLevel);

		if (!hasAccess && accessLevel !== AccessLevel.PUBLIC) {
			if (redirectTo) {
				window.location.href = redirectTo;
			} else {
				// Default redirect to login for authenticated routes
				const returnUrl = encodeURIComponent(window.location.pathname);
				window.location.href = `/api/auth/login?returnTo=${returnUrl}`;
			}
		}
	}, [accessLevel, user, redirectTo]);

	// Check access using the user from Astro context
	const hasAccess = checkClientAccess(user, accessLevel);

	if (!hasAccess) {
		return fallback || <AccessDenied accessLevel={accessLevel} />;
	}

	return <>{children}</>;
}

/**
 * Client-side access check for quick validation
 */
function checkClientAccess(
	user: OidcStandardClaimsWithRoles | null,
	accessLevel: AccessLevel,
): boolean {
	switch (accessLevel) {
		case AccessLevel.PUBLIC:
			return true;
		case AccessLevel.AUTHENTICATED:
			return !!user;
		case AccessLevel.DIRECTOR:
			return !!user && hasDirectorRole(user);
		case AccessLevel.ADMIN:
			// Future: implement admin role check
			return !!user && hasDirectorRole(user);
		default:
			return false;
	}
}
