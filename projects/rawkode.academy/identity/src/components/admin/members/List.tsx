import { useList, useDelete, useUpdate, useNavigation } from "@refinedev/core";
import { useState } from "react";
import { Button, Table, RoleBadge, Select, ConfirmModal } from "../ui";

interface Member {
	id: string;
	organizationId: string;
	userId: string;
	role: string;
	userName: string;
	userEmail: string;
	userImage?: string;
	createdAt: Date;
}

const ROLES = [
	{ value: "owner", label: "Owner" },
	{ value: "admin", label: "Admin" },
	{ value: "moderator", label: "Moderator" },
	{ value: "contributor", label: "Contributor" },
	{ value: "member", label: "Member" },
];

export function MemberList() {
	const { create } = useNavigation();
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [editingRole, setEditingRole] = useState<{ id: string; role: string } | null>(null);

	const { result, query } = useList<Member>({
		resource: "members",
		pagination: { currentPage: 1, pageSize: 50 },
		sorters: [{ field: "createdAt", order: "desc" }],
	});
	const data = (result?.data ?? []) as Member[];
	const isLoading = query.isLoading;

	const { mutate: deleteMember, mutation: deleteMutation } = useDelete();
	const { mutate: updateMember } = useUpdate();
	const isDeleting = deleteMutation.isPending;

	const handleDelete = () => {
		if (deleteId) {
			deleteMember(
				{ resource: "members", id: deleteId },
				{ onSuccess: () => setDeleteId(null) },
			);
		}
	};

	const handleRoleChange = (memberId: string, newRole: string) => {
		updateMember({
			resource: "members",
			id: memberId,
			values: { role: newRole },
		});
		setEditingRole(null);
	};

	const columns = [
		{
			key: "user",
			header: "User",
			render: (member: Member) => (
				<div className="flex items-center gap-2">
					{member.userImage && (
						<img
							src={member.userImage}
							alt={member.userName}
							className="w-8 h-8 rounded-full"
						/>
					)}
					<div>
						<div className="font-medium">{member.userName}</div>
						<div className="text-sm text-gray-500">{member.userEmail}</div>
					</div>
				</div>
			),
		},
		{
			key: "role",
			header: "Role",
			render: (member: Member) => {
				if (editingRole?.id === member.id) {
					return (
						<div className="flex items-center gap-2">
							<Select
								options={ROLES}
								value={editingRole.role}
								onChange={(e) =>
									setEditingRole({ ...editingRole, role: e.target.value })
								}
								className="w-32"
							/>
							<Button
								size="sm"
								onClick={() => handleRoleChange(member.id, editingRole.role)}
							>
								Save
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onClick={() => setEditingRole(null)}
							>
								Cancel
							</Button>
						</div>
					);
				}
				return (
					<button
						type="button"
						onClick={() => setEditingRole({ id: member.id, role: member.role })}
						className="cursor-pointer hover:opacity-80"
					>
						<RoleBadge role={member.role} />
					</button>
				);
			},
		},
		{
			key: "createdAt",
			header: "Joined",
			render: (member: Member) => (
				<span className="text-gray-500">
					{new Date(member.createdAt).toLocaleDateString()}
				</span>
			),
		},
		{
			key: "actions",
			header: "Actions",
			render: (member: Member) => (
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setDeleteId(member.id)}
				>
					Remove
				</Button>
			),
		},
	];

	return (
		<div>
			<div className="flex justify-between items-center mb-6">
				<h2 className="text-2xl font-bold text-gray-900">Members</h2>
				<Button onClick={() => create("members")}>Add Member</Button>
			</div>

			<p className="text-gray-600 mb-4">
				Click on a role badge to change the member's role.
			</p>

			<Table
				columns={columns}
				data={data}
				loading={isLoading}
				emptyMessage="No members found"
			/>

			<ConfirmModal
				isOpen={!!deleteId}
				onClose={() => setDeleteId(null)}
				onConfirm={handleDelete}
				title="Remove Member"
				message="Are you sure you want to remove this member from the organization?"
				confirmLabel="Remove"
				variant="danger"
				loading={isDeleting}
			/>
		</div>
	);
}
