import { useAuth } from "@/components/app/contexts/AuthContext";

export function Profile() {
	const { user } = useAuth();

	if (!user) {
		return null;
	}

	return (
		<div className="max-w-2xl mx-auto">
			<h1 className="text-3xl font-bold mb-8">Profile</h1>

			<div className="space-y-6">
				<div className="p-6 bg-card rounded-lg border">
					<h2 className="text-xl font-semibold mb-4">Account Information</h2>
					<dl className="space-y-3">
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Name:</dt>
							<dd className="font-medium">{user.name || "Not set"}</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Email:</dt>
							<dd className="font-medium">{user.email || "Not set"}</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-muted-foreground">Subject ID:</dt>
							<dd className="font-mono text-sm">{user.sub}</dd>
						</div>
						{user.preferred_username && (
							<div className="flex justify-between">
								<dt className="text-muted-foreground">Username:</dt>
								<dd className="font-medium">{user.preferred_username}</dd>
							</div>
						)}
					</dl>
				</div>

				<div className="p-6 bg-card rounded-lg border">
					<h2 className="text-xl font-semibold mb-4">Assigned Roles</h2>
					{user.roles.length > 0 ? (
						<div className="flex flex-wrap gap-2">
							{user.roles.map((role) => (
								<span
									key={role}
									className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
								>
									{role}
								</span>
							))}
						</div>
					) : (
						<p className="text-muted-foreground">
							No roles assigned to your account.
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
