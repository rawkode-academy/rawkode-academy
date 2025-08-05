import type { ReactNode } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { ThemeToggle } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppLayoutProps {
	children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
	const { user, logout } = useAuth();

	return (
		<div className="min-h-screen bg-[--color-background]">
			<header className="border-b border-[--color-border] bg-[--color-card]">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<div className="flex h-16 items-center justify-between">
						<div className="flex items-center">
							<h1 className="text-xl font-semibold text-[--color-foreground]">
								Rawkode Studio
							</h1>
						</div>

						<nav className="flex items-center space-x-4">
							<ThemeToggle />
							{user ? (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											className="relative h-8 w-8 rounded-full"
										>
											<div className="flex h-8 w-8 items-center justify-center rounded-full bg-[--color-primary] text-[--color-primary-foreground]">
												{user.name?.[0] || user.email?.[0] || "U"}
											</div>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuLabel className="font-normal">
											<div className="flex flex-col space-y-1">
												<p className="text-sm font-medium leading-none">
													{user.name || "User"}
												</p>
												{user.email && (
													<p className="text-xs leading-none text-[--color-muted-foreground]">
														{user.email}
													</p>
												)}
											</div>
										</DropdownMenuLabel>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											onClick={() => logout()}
											className="text-[--color-destructive]"
										>
											Log out
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							) : (
								<Button
									variant="default"
									onClick={() => {
										window.location.href = "/api/auth/login";
									}}
								>
									Sign in
								</Button>
							)}
						</nav>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
				{children}
			</main>
		</div>
	);
}
