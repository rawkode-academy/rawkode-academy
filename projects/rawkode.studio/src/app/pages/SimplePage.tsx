import { useAuth } from "@/app/providers/AuthProvider";

export function SimplePage() {
	const { user, login, logout } = useAuth();

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50">
			<div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
				<div className="text-center">
					<h1 className="text-3xl font-bold text-gray-900">Rawkode Studio</h1>

					{user ? (
						<div className="mt-8 space-y-4">
							<p className="text-lg text-gray-700">
								Welcome, {user.name || user.email || "User"}!
							</p>
							{user.email && (
								<p className="text-sm text-gray-600">{user.email}</p>
							)}
							<button
								type="button"
								onClick={() => logout()}
								className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
							>
								Logout
							</button>
						</div>
					) : (
						<div className="mt-8 space-y-4">
							<p className="text-lg text-gray-700">You are not logged in</p>
							<button
								type="button"
								onClick={() => login()}
								className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
							>
								Login with Zitadel
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
