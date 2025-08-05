import { createContext, useContext } from "react";
import type { OidcStandardClaimsWithRoles } from "@/lib/auth/auth-types";

interface AuthContextType {
	user: OidcStandardClaimsWithRoles | null;
	login: () => void;
	logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
	children: React.ReactNode;
	user: OidcStandardClaimsWithRoles | null;
}

export function AuthProvider({ children, user }: AuthProviderProps) {
	const login = () => {
		window.location.href = "/api/auth/login";
	};

	const logout = () => {
		window.location.href = "/api/auth/logout";
	};

	return (
		<AuthContext.Provider value={{ user, login, logout }}>
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
