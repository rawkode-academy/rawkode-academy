import type React from "react";
import { createContext, useContext, useState } from "react";
import type { OidcStandardClaimsWithRoles } from "@/lib/auth";

interface AuthContextType {
	user: OidcStandardClaimsWithRoles | null;
	isLoading: boolean;
	login: (returnTo?: string) => void;
	logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
	children: React.ReactNode;
	initialUser?: OidcStandardClaimsWithRoles | null;
}

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
	const [user, _setUser] = useState<OidcStandardClaimsWithRoles | null>(
		initialUser || null,
	);
	const [isLoading, _setIsLoading] = useState(false);

	const login = (returnTo?: string) => {
		const loginUrl = new URL("/api/auth/login", window.location.origin);
		if (returnTo) {
			loginUrl.searchParams.set("returnTo", returnTo);
		}
		window.location.href = loginUrl.toString();
	};

	const logout = () => {
		window.location.href = "/api/auth/logout";
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				isLoading,
				login,
				logout,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
