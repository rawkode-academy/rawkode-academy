import { createContext, type ReactNode, useContext, useState } from "react";

interface User {
	id: string;
	email: string;
	name: string;
	avatar?: string;
}

interface AuthContextType {
	user: User | null;
	setUser: (user: User | null) => void;
	isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
	children: ReactNode;
	initialUser?: User | null;
}

export function AuthProvider({
	children,
	initialUser = null,
}: AuthProviderProps) {
	const [user, setUser] = useState<User | null>(initialUser);

	const value: AuthContextType = {
		user,
		setUser,
		isAuthenticated: !!user,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
