import { SimplePage } from "@/app/pages/SimplePage";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import type { OidcStandardClaimsWithRoles } from "@/lib/auth";

interface AppProps {
	initialUser?: OidcStandardClaimsWithRoles | null;
}

export function App({ initialUser }: AppProps) {
	return (
		<ThemeProvider>
			<AuthProvider initialUser={initialUser}>
				<SimplePage />
			</AuthProvider>
		</ThemeProvider>
	);
}
