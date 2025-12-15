import { Outlet, Link, useLocation } from "react-router";
import { useGetIdentity, useLogout } from "@refinedev/core";
import { Button } from "./ui";

interface User {
	id: string;
	name: string;
	email: string;
	image?: string;
}

const navItems = [
	{ path: "/organizations", label: "Organizations", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
	{ path: "/members", label: "Members", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
	{ path: "/teams", label: "Teams", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
];

export function Layout() {
	const location = useLocation();
	const { data: user } = useGetIdentity<User>();
	const { mutate: logout } = useLogout();

	return (
		<div className="min-h-screen bg-gray-100">
			{/* Header */}
			<header className="bg-white shadow">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center h-16">
						<div className="flex items-center">
							<h1 className="text-xl font-bold text-gray-900">
								Admin Panel
							</h1>
						</div>
						<div className="flex items-center gap-4">
							{user && (
								<div className="flex items-center gap-2">
									{user.image && (
										<img
											src={user.image}
											alt={user.name}
											className="w-8 h-8 rounded-full"
										/>
									)}
									<span className="text-sm text-gray-700">{user.name}</span>
								</div>
							)}
							<Button
								variant="ghost"
								size="sm"
								onClick={() => logout()}
							>
								Sign Out
							</Button>
						</div>
					</div>
				</div>
			</header>

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="flex gap-8">
					{/* Sidebar Navigation */}
					<nav className="w-64 flex-shrink-0">
						<ul className="space-y-1">
							{navItems.map((item) => {
								const isActive = location.pathname.startsWith(item.path);
								return (
									<li key={item.path}>
										<Link
											to={item.path}
											className={`flex items-center gap-3 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
												isActive
													? "bg-blue-50 text-blue-700"
													: "text-gray-700 hover:bg-gray-50"
											}`}
										>
											<svg
												className="w-5 h-5"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d={item.icon}
												/>
											</svg>
											{item.label}
										</Link>
									</li>
								);
							})}
						</ul>
					</nav>

					{/* Main Content */}
					<main className="flex-1 bg-white rounded-lg shadow p-6">
						<Outlet />
					</main>
				</div>
			</div>
		</div>
	);
}
