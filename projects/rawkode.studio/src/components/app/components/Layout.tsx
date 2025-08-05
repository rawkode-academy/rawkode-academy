import { Link, Outlet } from "react-router";
import { useAuth } from "@/components/app/contexts/AuthContext";

export function Layout() {
	const { user, login, logout } = useAuth();

	return (
		<div className="min-h-screen bg-background">
			<header className="border-b">
				<div className="container mx-auto px-4">
					<nav className="flex items-center justify-between h-16">
						<div className="flex items-center space-x-8">
							<Link to="/" className="text-xl font-bold">
								Rawkode Studio
							</Link>
							<div className="flex items-center space-x-4">
								<Link
									to="/"
									className="text-sm font-medium hover:text-primary transition-colors"
								>
									Home
								</Link>
								{user && (
									<>
										<Link
											to="/dashboard"
											className="text-sm font-medium hover:text-primary transition-colors"
										>
											Dashboard
										</Link>
										<Link
											to="/profile"
											className="text-sm font-medium hover:text-primary transition-colors"
										>
											Profile
										</Link>
									</>
								)}
							</div>
						</div>

						<div className="flex items-center space-x-4">
							{user ? (
								<>
									<span className="text-sm text-muted-foreground">
										Welcome, {user.name || user.email}
									</span>
									<button
										type="button"
										onClick={logout}
										className="px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
									>
										Logout
									</button>
								</>
							) : (
								<button
									type="button"
									onClick={login}
									className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
								>
									Login
								</button>
							)}
						</div>
					</nav>
				</div>
			</header>

			<main className="container mx-auto px-4 py-8">
				<Outlet />
			</main>
		</div>
	);
}
