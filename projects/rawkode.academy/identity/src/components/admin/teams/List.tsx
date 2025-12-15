import { useList, useDelete, useNavigation } from "@refinedev/core";
import { useState } from "react";
import { Button, Table, ConfirmModal } from "../ui";

interface Team {
	id: string;
	name: string;
	organizationId: string;
	organizationName: string;
	createdAt: Date;
}

export function TeamList() {
	const { create } = useNavigation();
	const [deleteId, setDeleteId] = useState<string | null>(null);

	const { result, query } = useList<Team>({
		resource: "teams",
		pagination: { currentPage: 1, pageSize: 50 },
		sorters: [{ field: "createdAt", order: "desc" }],
	});
	const data = (result?.data ?? []) as Team[];
	const isLoading = query.isLoading;

	const { mutate: deleteTeam, mutation: deleteMutation } = useDelete();
	const isDeleting = deleteMutation.isPending;

	const handleDelete = () => {
		if (deleteId) {
			deleteTeam(
				{ resource: "teams", id: deleteId },
				{ onSuccess: () => setDeleteId(null) },
			);
		}
	};

	const columns = [
		{
			key: "name",
			header: "Name",
			render: (team: Team) => (
				<span className="font-medium">{team.name}</span>
			),
		},
		{
			key: "organizationName",
			header: "Organization",
			render: (team: Team) => (
				<span className="text-gray-600">{team.organizationName}</span>
			),
		},
		{
			key: "createdAt",
			header: "Created",
			render: (team: Team) => (
				<span className="text-gray-500">
					{new Date(team.createdAt).toLocaleDateString()}
				</span>
			),
		},
		{
			key: "actions",
			header: "Actions",
			render: (team: Team) => (
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setDeleteId(team.id)}
				>
					Delete
				</Button>
			),
		},
	];

	return (
		<div>
			<div className="flex justify-between items-center mb-6">
				<h2 className="text-2xl font-bold text-gray-900">Teams</h2>
				<Button onClick={() => create("teams")}>Create Team</Button>
			</div>

			<Table
				columns={columns}
				data={data}
				loading={isLoading}
				emptyMessage="No teams found"
			/>

			<ConfirmModal
				isOpen={!!deleteId}
				onClose={() => setDeleteId(null)}
				onConfirm={handleDelete}
				title="Delete Team"
				message="Are you sure you want to delete this team? All team members will be removed."
				confirmLabel="Delete"
				variant="danger"
				loading={isDeleting}
			/>
		</div>
	);
}
