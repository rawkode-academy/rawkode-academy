import { useCreate, useDelete, useList } from "@refinedev/core";
import { useMemo, useState } from "react";
import { Badge, Button, ConfirmModal, Input, Select, Table } from "../ui";

interface AccessRole {
	key: string;
	label: string;
	description: string;
}

interface AccessApplication {
	id: string;
	clientId: string;
	name: string;
	description: string;
	roles: AccessRole[];
}

interface User {
	id: string;
	name: string;
	email: string;
	image?: string;
}

interface AccessAssignment {
	id: string;
	userId: string;
	clientId: string;
	role: string;
	reason?: string;
	expiresAt?: string | null;
	createdAt: string;
	userName: string;
	userEmail: string;
	userImage?: string;
}

export function AccessList() {
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [userSearch, setUserSearch] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [formData, setFormData] = useState({
		userId: "",
		clientId: "comtrya",
		role: "maintainer",
		reason: "",
		expiresAt: "",
	});

	const { result: appsResult } = useList<AccessApplication>({
		resource: "access-applications",
		pagination: { currentPage: 1, pageSize: 50 },
	});
	const applications = (appsResult?.data ?? []) as AccessApplication[];
	const selectedApplication = applications.find(
		(app) => app.clientId === formData.clientId,
	);
	const roleOptions = selectedApplication?.roles.map((role) => ({
		value: role.key,
		label: role.label,
	})) ?? [];

	const { result: usersResult, query: usersQuery } = useList<User>({
		resource: "users",
		pagination: { currentPage: 1, pageSize: 25 },
		filters: userSearch
			? [{ field: "q", operator: "contains", value: userSearch }]
			: [],
	});
	const users = (usersResult?.data ?? []) as User[];
	const selectedUser = users.find((user) => user.id === formData.userId);

	const { result, query } = useList<AccessAssignment>({
		resource: "access-assignments",
		pagination: { currentPage: 1, pageSize: 50 },
		sorters: [{ field: "createdAt", order: "desc" }],
	});
	const assignments = (result?.data ?? []) as AccessAssignment[];

	const { mutate: createAssignment, mutation: createMutation } = useCreate();
	const { mutate: deleteAssignment, mutation: deleteMutation } = useDelete();

	const roleLabels = useMemo(() => {
		return new Map(
			applications.flatMap((app) =>
				app.roles.map((role) => [`${app.clientId}:${role.key}`, role.label]),
			),
		);
	}, [applications]);

	const handleSubmit = (event: { preventDefault: () => void }) => {
		event.preventDefault();

		const nextErrors: Record<string, string> = {};
		if (!formData.userId) nextErrors.userId = "User is required";
		if (!formData.clientId) nextErrors.clientId = "Application is required";
		if (!formData.role) nextErrors.role = "Role is required";
		if (Object.keys(nextErrors).length > 0) {
			setErrors(nextErrors);
			return;
		}

		createAssignment(
			{
				resource: "access-assignments",
				values: {
					...formData,
					expiresAt: formData.expiresAt || null,
					reason: formData.reason || undefined,
				},
			},
			{
				onSuccess: () => {
					setErrors({});
					setFormData((prev) => ({
						...prev,
						userId: "",
						reason: "",
						expiresAt: "",
					}));
				},
				onError: (error) => {
					setErrors({ form: error.message });
				},
			},
		);
	};

	const handleDelete = () => {
		if (!deleteId) return;
		deleteAssignment(
			{ resource: "access-assignments", id: deleteId },
			{ onSuccess: () => setDeleteId(null) },
		);
	};

	const columns = [
		{
			key: "user",
			header: "User",
			render: (assignment: AccessAssignment) => (
				<div className="flex items-center gap-2">
					{assignment.userImage && (
						<img
							src={assignment.userImage}
							alt={assignment.userName}
							className="w-8 h-8 rounded-full"
						/>
					)}
					<div>
						<div className="font-medium">{assignment.userName}</div>
						<div className="text-sm text-gray-500">{assignment.userEmail}</div>
					</div>
				</div>
			),
		},
		{
			key: "application",
			header: "Application",
			render: (assignment: AccessAssignment) => (
				<div>
					<div className="font-medium">
						{applications.find((app) => app.clientId === assignment.clientId)?.name ??
							assignment.clientId}
					</div>
					<div className="text-sm text-gray-500">{assignment.clientId}</div>
				</div>
			),
		},
		{
			key: "role",
			header: "Role",
			render: (assignment: AccessAssignment) => (
				<Badge variant={assignment.role === "admin" ? "warning" : "info"}>
					{roleLabels.get(`${assignment.clientId}:${assignment.role}`) ??
						assignment.role}
				</Badge>
			),
		},
		{
			key: "expiresAt",
			header: "Expires",
			render: (assignment: AccessAssignment) => (
				<span className="text-gray-500">
					{assignment.expiresAt
						? new Date(assignment.expiresAt).toLocaleDateString()
						: "Never"}
				</span>
			),
		},
		{
			key: "actions",
			header: "Actions",
			render: (assignment: AccessAssignment) => (
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setDeleteId(assignment.id)}
				>
					Remove
				</Button>
			),
		},
	];

	return (
		<div>
			<div className="mb-6">
				<h2 className="text-2xl font-bold text-gray-900">Access</h2>
				<p className="text-gray-600 mt-1">
					Assign roles to users per application. OIDC claims only include roles
					for the requesting application.
				</p>
			</div>

			<form
				onSubmit={handleSubmit}
				className="mb-8 grid grid-cols-1 lg:grid-cols-5 gap-4 p-4 border rounded-lg bg-gray-50"
			>
				<Select
					label="Application"
					value={formData.clientId}
					onChange={(event) => {
						const nextApplication = applications.find(
							(app) => app.clientId === event.target.value,
						);
						setFormData((prev) => ({
							...prev,
							clientId: event.target.value,
							role: nextApplication?.roles[0]?.key ?? "",
						}));
					}}
					options={applications.map((app) => ({
						value: app.clientId,
						label: app.name,
					}))}
					error={errors.clientId}
				/>

				<div className="space-y-1 lg:col-span-2">
					<Input
						label="User"
						placeholder="Search by name or email..."
						value={userSearch}
						onChange={(event) => setUserSearch(event.target.value)}
						error={errors.userId}
					/>
					{usersQuery.isLoading ? (
						<div className="text-sm text-gray-500">Loading users...</div>
					) : users.length > 0 ? (
						<div className="max-h-40 overflow-y-auto border rounded-md bg-white">
							{users.map((user) => (
								<button
									key={user.id}
									type="button"
									onClick={() =>
										setFormData((prev) => ({ ...prev, userId: user.id }))
									}
									className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 ${
										formData.userId === user.id ? "bg-blue-50" : ""
									}`}
								>
									{user.image && (
										<img
											src={user.image}
											alt={user.name}
											className="w-8 h-8 rounded-full"
										/>
									)}
									<div>
										<div className="font-medium">{user.name}</div>
										<div className="text-sm text-gray-500">{user.email}</div>
									</div>
								</button>
							))}
						</div>
					) : userSearch ? (
						<div className="text-sm text-gray-500">No users found</div>
					) : null}
					{selectedUser && (
						<div className="text-sm text-blue-700">
							Selected {selectedUser.name} ({selectedUser.email})
						</div>
					)}
				</div>

				<Select
					label="Role"
					value={formData.role}
					onChange={(event) =>
						setFormData((prev) => ({ ...prev, role: event.target.value }))
					}
					options={roleOptions}
					error={errors.role}
				/>

				<Input
					label="Expires"
					type="date"
					value={formData.expiresAt}
					onChange={(event) =>
						setFormData((prev) => ({ ...prev, expiresAt: event.target.value }))
					}
				/>

				<div className="lg:col-span-4">
					<Input
						label="Reason"
						placeholder="Optional"
						value={formData.reason}
						onChange={(event) =>
							setFormData((prev) => ({ ...prev, reason: event.target.value }))
						}
					/>
				</div>

				<div className="flex items-end">
					<Button type="submit" disabled={createMutation.isPending}>
						{createMutation.isPending ? "Assigning..." : "Assign Role"}
					</Button>
				</div>

				{errors.form && (
					<p className="lg:col-span-5 text-sm text-red-600">{errors.form}</p>
				)}
			</form>

			<Table
				columns={columns}
				data={assignments}
				loading={query.isLoading}
				emptyMessage="No access assignments found"
			/>

			<ConfirmModal
				isOpen={!!deleteId}
				onClose={() => setDeleteId(null)}
				onConfirm={handleDelete}
				title="Remove Access"
				message="Are you sure you want to remove this role assignment?"
				confirmLabel="Remove"
				variant="danger"
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
