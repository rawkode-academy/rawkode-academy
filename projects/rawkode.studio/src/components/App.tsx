import SidebarLayout from "@/components/layout/SidebarLayout";
import DocumentationPage from "@/components/pages/DocumentationPage";
import HomePage from "@/components/pages/HomePage";
import ProfilePage from "@/components/pages/ProfilePage";
import ActiveLivestreamPage from "@/components/pages/livestreams/ActiveLivestreamsPage";
import PastLivestreamDetailsPage from "@/components/pages/livestreams/PastLivestreamDetailsPage";
import PastLivestreamsPage from "@/components/pages/livestreams/PastLivestreamsPage";
import type { OidcStandardClaimsWithRoles } from "@/lib/security";
import { StrictMode } from "react";
import { BrowserRouter, Route, Routes } from "react-router";

interface Props {
	user: OidcStandardClaimsWithRoles;
	children: React.ReactNode;
}

export default function App({ user }: Props) {
	return (
		<StrictMode>
			<BrowserRouter>
				<Routes>
					<Route path="/">
						<Route
							index
							element={
								<SidebarLayout user={user} title="Home">
									<HomePage />
								</SidebarLayout>
							}
						/>
						<Route
							path="profile"
							element={
								<SidebarLayout user={user} title="Profile">
									<ProfilePage user={user} />
								</SidebarLayout>
							}
						/>
						<Route
							path="documentation"
							element={
								<SidebarLayout user={user} title="Studio Guide">
									<DocumentationPage />
								</SidebarLayout>
							}
						/>
						<Route path="livestreams">
							<Route
								path="active"
								element={
									<SidebarLayout user={user} title="Active Livestreams">
										<ActiveLivestreamPage />
									</SidebarLayout>
								}
							/>
							<Route
								path="past"
								element={
									<SidebarLayout user={user} title="Past Livestreams">
										<PastLivestreamsPage />
									</SidebarLayout>
								}
							/>
							<Route
								path="past/:roomId"
								element={
									<SidebarLayout user={user} title="Livestream Details">
										<PastLivestreamDetailsPage />
									</SidebarLayout>
								}
							/>
						</Route>
					</Route>
				</Routes>
			</BrowserRouter>
		</StrictMode>
	);
}
