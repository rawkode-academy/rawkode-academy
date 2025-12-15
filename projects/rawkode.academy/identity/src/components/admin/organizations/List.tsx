import { useList, useDelete, useNavigation } from "@refinedev/core";
import { useState } from "react";
import { Button, Table, ConfirmModal } from "../ui";

interface Organization {
	id: string;
	name: string;
	slug: string;
	logo?: string;
	createdAt: Date;
}

export function OrganizationList() {
	const { create, show, edit } = useNavigation();
	const [deleteId, setDeleteId] = useState<string | null>(null);

	const { result, query } = useList<Organization>({
		resource: "organizations",
		pagination: { currentPage: 1, pageSize: 50 },
		sorters: [{ field: "createdAt", order: "desc" }],
	});

	const { mutate: deleteOrg, mutation: deleteMutation } = useDelete();
	const isLoading = query.isLoading;
	const isDeleting = deleteMutation.isPending;
	const data = (result?.data ?? []) as Organization[];

	const handleDelete = () => {
		if (deleteId) {
			deleteOrg(
				{ resource: "organizations", id: deleteId },
				{
					onSuccess: () => setDeleteId(null),
				},
			);
		}
	};

	const columns = [
		{
			key: "name",
			header: "Name",
			render: (org: Organization) => (
				<span className="font-medium">{org.name}</span>
			),
		},
		{
			key: "slug",
			header: "Slug",
			render: (org: Organization) => (
				<code className="bg-gray-100 px-2 py-1 rounded text-sm">
					{org.slug}
				</code>
			),
		},
		{
			key: "createdAt",
			header: "Created",
			render: (org: Organization) => (
				<span className="text-gray-500">
					{new Date(org.createdAt).toLocaleDateString()}
				</span>
			),
		},
		{
			key: "actions",
			header: "Actions",
			render: (org: Organization) => (
				<div className="flex gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={(e) => {
							e.stopPropagation();
							show("organizations", org.id);
						}}
					>
						View
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={(e) => {
							e.stopPropagation();
							edit("organizations", org.id);
						}}
					>
						Edit
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={(e) => {
							e.stopPropagation();
							setDeleteId(org.id);
						}}
					>
						Delete
					</Button>
				</div>
			),
		},
	];

	return (
		<div>
			<div className="flex justify-between items-center mb-6">
				<h2 className="text-2xl font-bold text-gray-900">Organizations</h2>
				<Button onClick={() => create("organizations")}>
					Create Organization
				</Button>
			</div>

			<Table
				columns={columns}
				data={data}
				loading={isLoading}
				emptyMessage="No organizations found"
				onRowClick={(org) => show("organizations", org.id)}
			/>

			<ConfirmModal
				isOpen={!!deleteId}
				onClose={() => setDeleteId(null)}
				onConfirm={handleDelete}
				title="Delete Organization"
				message="Are you sure you want to delete this organization? This will also delete all members, teams, and invitations."
				confirmLabel="Delete"
				variant="danger"
				loading={isDeleting}
			/>
		</div>
	);
}
