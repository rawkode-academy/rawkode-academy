import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Route, Routes } from "react-router";
import { Layout } from "@/components/app/components/Layout";
import {
	AccessLevel,
	RouteGuard,
} from "@/components/app/components/RouteGuard";
import { AuthProvider } from "@/components/app/contexts/AuthContext";
import { Dashboard } from "@/components/app/pages/Dashboard";
import { Home } from "@/components/app/pages/Home";
import { MeetingDetails } from "@/components/app/pages/MeetingDetails";
import { MeetingRoom } from "@/components/app/pages/MeetingRoom";
import { Profile } from "@/components/app/pages/Profile";
import { MeetingJoin } from "@/components/meeting/MeetingJoin";
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
						{/* Public Routes */}
						<Route path="/" element={<Layout />}>
							<Route index element={<Home />} />

							{/* Guest-accessible meeting join */}
							<Route
								path="join/:meetingId"
								element={
									<RouteGuard accessLevel={AccessLevel.PUBLIC}>
										<MeetingJoin />
									</RouteGuard>
								}
							/>
						</Route>

						{/* Protected Routes */}
						<Route path="/" element={<Layout />}>
							<Route
								path="dashboard"
								element={
									<RouteGuard accessLevel={AccessLevel.AUTHENTICATED}>
										<Dashboard />
									</RouteGuard>
								}
							/>

							<Route
								path="meeting/:id"
								element={
									<RouteGuard accessLevel={AccessLevel.AUTHENTICATED}>
										<MeetingDetails />
									</RouteGuard>
								}
							/>

							<Route
								path="profile"
								element={
									<RouteGuard accessLevel={AccessLevel.AUTHENTICATED}>
										<Profile />
									</RouteGuard>
								}
							/>
						</Route>

						{/* Meeting Room - validates token, allows guests */}
						<Route
							path="room/:id"
							element={
								<RouteGuard accessLevel={AccessLevel.PUBLIC}>
									<MeetingRoom />
								</RouteGuard>
							}
						/>
					</Routes>
				</AuthProvider>
			</BrowserRouter>
			<ReactQueryDevtools initialIsOpen={false} />
		</QueryClientProvider>
	);
}
