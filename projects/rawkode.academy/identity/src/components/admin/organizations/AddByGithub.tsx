import { useCallback, useEffect, useState } from "react";

interface PendingMember {
	id: string;
	githubLogin: string;
	role: string;
}

const ROLES = ["member", "contributor", "moderator", "admin", "owner"];

interface Props {
	organizationId: string;
	/** Called after a member is added so the members list can refresh. */
	onAdded: () => void;
}

/**
 * Adds someone to an organisation by GitHub handle. A person who has signed in
 * before becomes a member now; anyone else is listed as pending and joins on
 * their first sign-in.
 */
export function AddByGithub({ organizationId, onAdded }: Props) {
	const [login, setLogin] = useState("");
	const [role, setRole] = useState("member");
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [pending, setPending] = useState<PendingMember[]>([]);

	const loadPending = useCallback(async () => {
		const response = await fetch(
			`/api/admin/org-github-members?organizationId=${encodeURIComponent(organizationId)}`,
		);
		if (response.ok) setPending((await response.json()) as PendingMember[]);
	}, [organizationId]);

	useEffect(() => {
		void loadPending();
	}, [loadPending]);

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		setBusy(true);
		setMessage(null);
		try {
			const response = await fetch("/api/admin/org-github-members", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ organizationId, githubLogin: login, role }),
			});
			const body = (await response.json()) as {
				status?: string;
				githubLogin?: string;
				error?: string;
			};
			if (!response.ok) {
				setMessage(body.error ?? "Could not add that account");
				return;
			}
			const who = body.githubLogin ?? login;
			setMessage(
				{
					added: `Added ${who}.`,
					already_member: `${who} is already a member.`,
					pending: `${who} hasn't signed in yet. They'll join on their first sign-in.`,
					already_pending: `${who} is already waiting to join.`,
				}[body.status ?? ""] ?? "Done.",
			);
			setLogin("");
			await loadPending();
			onAdded();
		} finally {
			setBusy(false);
		}
	};

	const cancel = async (id: string) => {
		await fetch(`/api/admin/org-github-members?id=${encodeURIComponent(id)}`, {
			method: "DELETE",
		});
		await loadPending();
	};

	return (
		<div className="space-y-3">
			<form onSubmit={submit} className="flex flex-wrap items-end gap-2">
				<label className="text-sm text-gray-700">
					GitHub handle
					<input
						className="mt-1 block rounded border border-gray-300 px-2 py-1"
						value={login}
						onChange={(event) => setLogin(event.target.value)}
						placeholder="octocat"
						autoComplete="off"
						required
					/>
				</label>
				<label className="text-sm text-gray-700">
					Role
					<select
						className="mt-1 block rounded border border-gray-300 px-2 py-1"
						value={role}
						onChange={(event) => setRole(event.target.value)}
					>
						{ROLES.map((item) => (
							<option key={item} value={item}>
								{item}
							</option>
						))}
					</select>
				</label>
				<button
					type="submit"
					disabled={busy || login.trim() === ""}
					className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
				>
					Add by GitHub
				</button>
				{message && <span className="text-sm text-gray-600">{message}</span>}
			</form>
			{pending.length > 0 && (
				<ul className="text-sm text-gray-700">
					{pending.map((row) => (
						<li key={row.id} className="flex items-center gap-2">
							<code>{row.githubLogin}</code> ({row.role}), waiting for first sign-in
							<button
								type="button"
								className="text-blue-600 underline"
								onClick={() => void cancel(row.id)}
							>
								Cancel
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
