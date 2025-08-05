import { useAuth } from "@/components/app/contexts/AuthContext";

export function Home() {
	const { user } = useAuth();

	return (
		<div className="max-w-4xl mx-auto">
			<h1 className="text-4xl font-bold mb-6">Welcome to Rawkode Studio</h1>

			<div className="prose prose-lg">
				<p>
					This is the home page of the application.
					{user ? " You are currently logged in." : " You are not logged in."}
				</p>
			</div>
		</div>
	);
}
