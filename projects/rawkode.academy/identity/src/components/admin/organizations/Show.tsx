import { useOne, useList, useDelete, useNavigation } from "@refinedev/core";
import { useState } from "react";
import { useParams } from "react-router";
import { Button, Table, RoleBadge, ConfirmModal } from "../ui";

interface Organization {
	id: string;
	name: string;
	slug: string;
	logo?: string;
	createdAt: Date;
}

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

interface Team {
	id: string;
	name: string;
	organizationId: string;
	organizationName: string;
	createdAt: Date;
}

export function OrganizationShow() {
	const { id } = useParams<{ id: string }>();
	const { edit, list, create } = useNavigation();
	const [deleteMemberId, setDeleteMemberId] = useState<string | null>(null);
	const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);

	const { result: orgResult, query: orgQuery } = useOne<Organization>({
		resource: "organizations",
		id: id!,
	});
	const org = orgResult;
	const isLoadingOrg = orgQuery.isLoading;

	const { result: membersResult, query: membersQuery } = useList<Member>({
		resource: "members",
		filters: [{ field: "organizationId", operator: "eq", value: id }],
		pagination: { currentPage: 1, pageSize: 100 },
	});
	const membersData = (membersResult?.data ?? []) as Member[];
	const isLoadingMembers = membersQuery.isLoading;

	const { result: teamsResult, query: teamsQuery } = useList<Team>({
		resource: "teams",
		filters: [{ field: "organizationId", operator: "eq", value: id }],
		pagination: { currentPage: 1, pageSize: 100 },
	});
	const teamsData = (teamsResult?.data ?? []) as Team[];
	const isLoadingTeams = teamsQuery.isLoading;

	const { mutate: deleteMember, mutation: deleteMemberMutation } = useDelete();
	const { mutate: deleteTeam, mutation: deleteTeamMutation } = useDelete();
	const isDeletingMember = deleteMemberMutation.isPending;
	const isDeletingTeam = deleteTeamMutation.isPending;

	const handleDeleteMember = () => {
		if (deleteMemberId) {
			deleteMember(
				{ resource: "members", id: deleteMemberId },
				{ onSuccess: () => setDeleteMemberId(null) },
			);
		}
	};

	const handleDeleteTeam = () => {
		if (deleteTeamId) {
			deleteTeam(
				{ resource: "teams", id: deleteTeamId },
				{ onSuccess: () => setDeleteTeamId(null) },
			);
		}
	};

	const memberColumns = [
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
			render: (member: Member) => <RoleBadge role={member.role} />,
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
					onClick={() => setDeleteMemberId(member.id)}
				>
					Remove
				</Button>
			),
		},
	];

	const teamColumns = [
		{
			key: "name",
			header: "Name",
			render: (team: Team) => <span className="font-medium">{team.name}</span>,
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
					onClick={() => setDeleteTeamId(team.id)}
				>
					Delete
				</Button>
			),
		},
	];

	if (isLoadingOrg) {
		return (
			<div className="flex items-center justify-center py-8">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
			</div>
		);
	}

	if (!org) {
		return <div>Organization not found</div>;
	}

	return (
		<div className="space-y-8">
			{/* Organization Header */}
			<div className="flex justify-between items-start">
				<div className="flex items-center gap-4">
					{org.logo && (
						<img
							src={org.logo}
							alt={org.name}
							className="w-16 h-16 rounded-lg object-cover"
						/>
					)}
					<div>
						<h2 className="text-2xl font-bold text-gray-900">{org.name}</h2>
						<code className="bg-gray-100 px-2 py-1 rounded text-sm">
							{org.slug}
						</code>
					</div>
				</div>
				<div className="flex gap-2">
					<Button variant="secondary" onClick={() => edit("organizations", id!)}>
						Edit
					</Button>
					<Button variant="ghost" onClick={() => list("organizations")}>
						Back to List
					</Button>
				</div>
			</div>

			{/* Members Section */}
			<div>
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-lg font-semibold text-gray-900">Members</h3>
					<Button
						size="sm"
						onClick={() => create("members", undefined, { organizationId: id })}
					>
						Add Member
					</Button>
				</div>
				<Table
					columns={memberColumns}
					data={membersData}
					loading={isLoadingMembers}
					emptyMessage="No members yet"
				/>
			</div>

			{/* Teams Section */}
			<div>
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-lg font-semibold text-gray-900">Teams</h3>
					<Button
						size="sm"
						onClick={() => create("teams", undefined, { organizationId: id })}
					>
						Create Team
					</Button>
				</div>
				<Table
					columns={teamColumns}
					data={teamsData}
					loading={isLoadingTeams}
					emptyMessage="No teams yet"
				/>
			</div>

			{/* Delete Member Modal */}
			<ConfirmModal
				isOpen={!!deleteMemberId}
				onClose={() => setDeleteMemberId(null)}
				onConfirm={handleDeleteMember}
				title="Remove Member"
				message="Are you sure you want to remove this member from the organization?"
				confirmLabel="Remove"
				variant="danger"
				loading={isDeletingMember}
			/>

			{/* Delete Team Modal */}
			<ConfirmModal
				isOpen={!!deleteTeamId}
				onClose={() => setDeleteTeamId(null)}
				onConfirm={handleDeleteTeam}
				title="Delete Team"
				message="Are you sure you want to delete this team? All team members will be removed."
				confirmLabel="Delete"
				variant="danger"
				loading={isDeletingTeam}
			/>
		</div>
	);
}
