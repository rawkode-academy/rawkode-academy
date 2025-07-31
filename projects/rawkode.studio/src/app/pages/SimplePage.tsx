import { useAuth } from "@/app/providers/AuthProvider";
import { AppLayout } from "@/components/layouts";
import { Button } from "@/components/ui/button";

export function SimplePage() {
	const { user, login } = useAuth();

	return (
		<AppLayout>
			<div className="flex items-center justify-center">
				<div className="max-w-md w-full space-y-8 p-8 bg-[--color-card] rounded-lg border border-[--color-border]">
					<div className="text-center">
						<h2 className="text-3xl font-bold text-[--color-foreground]">
							Welcome
						</h2>

						{user ? (
							<div className="mt-8 space-y-4">
								<p className="text-lg text-[--color-foreground]">
									Hello, {user.name || user.email || "User"}!
								</p>
								<p className="text-sm text-[--color-muted-foreground]">
									You are successfully logged in.
								</p>
							</div>
						) : (
							<div className="mt-8 space-y-4">
								<p className="text-lg text-[--color-muted-foreground]">
									Please sign in to continue
								</p>
								<Button onClick={() => login()} className="w-full" size="lg">
									Sign in with Zitadel
								</Button>
							</div>
						)}
					</div>
				</div>
			</div>
		</AppLayout>
	);
}
