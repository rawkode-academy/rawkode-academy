import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Route, Routes } from "react-router";
import { Layout } from "@/components/app/components/Layout";
import { ProtectedRoute } from "@/components/app/components/ProtectedRoute";
import { AuthProvider } from "@/components/app/contexts/AuthContext";
import { Dashboard } from "@/components/app/pages/Dashboard";
import { Home } from "@/components/app/pages/Home";
import { MeetingDetails } from "@/components/app/pages/MeetingDetails";
import { Profile } from "@/components/app/pages/Profile";
import type { OidcStandardClaimsWithRoles } from "@/lib/auth/auth-types";

interface AppProps {
	user: OidcStandardClaimsWithRoles | null;
}

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 60 * 1000, // 1 minute
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});

export function App({ user }: AppProps) {
	return (
		<QueryClientProvider client={queryClient}>
			<BrowserRouter>
				<AuthProvider user={user}>
					<Routes>
						<Route path="/" element={<Layout />}>
							<Route index element={<Home />} />
							<Route
								path="dashboard"
								element={
									<ProtectedRoute>
										<Dashboard />
									</ProtectedRoute>
								}
							/>
							<Route
								path="meeting/:id"
								element={
									<ProtectedRoute>
										<MeetingDetails />
									</ProtectedRoute>
								}
							/>
							<Route
								path="profile"
								element={
									<ProtectedRoute>
										<Profile />
									</ProtectedRoute>
								}
							/>
						</Route>
					</Routes>
				</AuthProvider>
			</BrowserRouter>
			<ReactQueryDevtools initialIsOpen={false} />
		</QueryClientProvider>
	);
}
