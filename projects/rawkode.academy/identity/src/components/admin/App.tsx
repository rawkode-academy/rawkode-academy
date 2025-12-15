import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/react-router";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { dataProvider } from "../../lib/refine/data-provider";
import { authProvider } from "../../lib/refine/auth-provider";
import { Layout } from "./Layout";
import { OrganizationList, OrganizationCreate, OrganizationEdit, OrganizationShow } from "./organizations";
import { MemberList, MemberCreate } from "./members";
import { TeamList, TeamCreate } from "./teams";

export function AdminApp() {
	return (
		<BrowserRouter basename="/admin">
			<Refine
				dataProvider={dataProvider}
				authProvider={authProvider}
				routerProvider={routerProvider}
				resources={[
					{
						name: "organizations",
						list: "/organizations",
						create: "/organizations/create",
						edit: "/organizations/:id/edit",
						show: "/organizations/:id",
						meta: {
							label: "Organizations",
						},
					},
					{
						name: "members",
						list: "/members",
						create: "/members/create",
						meta: {
							label: "Members",
						},
					},
					{
						name: "teams",
						list: "/teams",
						create: "/teams/create",
						meta: {
							label: "Teams",
						},
					},
					{
						name: "users",
						list: "/users",
						meta: {
							label: "Users",
							hide: true, // Don't show in navigation, just use for data fetching
						},
					},
				]}
				options={{
					syncWithLocation: true,
					warnWhenUnsavedChanges: true,
				}}
			>
				<Routes>
					<Route element={<Layout />}>
						<Route index element={<Navigate to="/organizations" replace />} />
						<Route path="/organizations">
							<Route index element={<OrganizationList />} />
							<Route path="create" element={<OrganizationCreate />} />
							<Route path=":id" element={<OrganizationShow />} />
							<Route path=":id/edit" element={<OrganizationEdit />} />
						</Route>
						<Route path="/members">
							<Route index element={<MemberList />} />
							<Route path="create" element={<MemberCreate />} />
						</Route>
						<Route path="/teams">
							<Route index element={<TeamList />} />
							<Route path="create" element={<TeamCreate />} />
						</Route>
					</Route>
				</Routes>
			</Refine>
		</BrowserRouter>
	);
}
