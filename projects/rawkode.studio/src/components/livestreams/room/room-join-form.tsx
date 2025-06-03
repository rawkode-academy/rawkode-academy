import { Spinner } from "@/components/common/Spinner";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { User } from "lucide-react";
import { useState } from "react";

interface Props {
	roomName: string;
}

export default function RoomJoinForm({ roomName }: Props) {
	const [name, setName] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError(null);

		// Store the participant name in sessionStorage
		if (name.trim()) {
			sessionStorage.setItem("participant-name", name.trim());
		} else {
			sessionStorage.removeItem("participant-name");
		}

		// Show success message briefly
		const formContainer = document.querySelector("form")?.closest(".space-y-6");
		if (formContainer) {
			// Create success message
			const successMessage = document.createElement("div");
			successMessage.className =
				"p-4 border border-green-300 bg-green-50 text-green-700 rounded-lg flex items-center gap-3";
			successMessage.innerHTML = `
				<div class="shrink-0 size-10 rounded-full bg-green-100 flex items-center justify-center">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12l5 5 5-5"/><path d="M12 2v15"/></svg>
				</div>
				<div>
					<p class="font-medium">Joining Stream</p>
					<p class="text-sm text-green-600">
						${name.trim() ? `Connecting as ${name.trim()}...` : "Connecting with a random guest name..."}
					</p>
				</div>
			`;

			// Replace form with success message
			formContainer.innerHTML = "";
			formContainer.appendChild(successMessage);
		}

		// Redirect to the watch page
		setTimeout(() => {
			window.location.href = `/watch/${roomName}`;
		}, 500);
	};

	return (
		<div className="space-y-6">
			<form onSubmit={handleSubmit} className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="name" className="text-sm font-medium">
						Your Display Name
					</Label>
					<div className="relative">
						<div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
							<User className="size-4" />
						</div>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Enter your name or leave blank for random"
							className="pl-9"
							disabled={isLoading}
						/>
					</div>
					<p className="text-xs text-muted-foreground">
						This is how others will see you in the livestream
					</p>
				</div>

				{error && (
					<div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md text-sm">
						{error}
					</div>
				)}

				<Button
					type="submit"
					className="w-full gap-2"
					size="lg"
					disabled={isLoading}
				>
					{isLoading ? <Spinner className="size-4" /> : null}
					Join Livestream
				</Button>
			</form>

			<div className="pt-4 border-t border-border">
				<p className="text-xs text-center text-muted-foreground">
					By joining, you agree to our terms of service and community guidelines
				</p>
			</div>
		</div>
	);
}
