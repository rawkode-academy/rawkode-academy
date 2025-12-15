import { useCreate, useList, useNavigation } from "@refinedev/core";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { Button, Select, Input } from "../ui";

interface Organization {
	id: string;
	name: string;
	slug: string;
}

interface User {
	id: string;
	name: string;
	email: string;
	image?: string;
}

const ROLES = [
	{ value: "member", label: "Member" },
	{ value: "contributor", label: "Contributor" },
	{ value: "moderator", label: "Moderator" },
	{ value: "admin", label: "Admin" },
	{ value: "owner", label: "Owner" },
];

export function MemberCreate() {
	const { list } = useNavigation();
	const [searchParams] = useSearchParams();
	const preselectedOrgId = searchParams.get("organizationId");

	const { mutate: createMember, mutation } = useCreate();
	const isCreating = mutation.isPending;

	const [formData, setFormData] = useState({
		organizationId: preselectedOrgId || "",
		userId: "",
		role: "member",
	});
	const [userSearch, setUserSearch] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Fetch organizations for dropdown
	const { result: orgsResult } = useList<Organization>({
		resource: "organizations",
		pagination: { currentPage: 1, pageSize: 100 },
	});

	// Fetch users for selection
	const { result: usersResult, query: usersQuery } = useList<User>({
		resource: "users",
		pagination: { currentPage: 1, pageSize: 100 },
		filters: userSearch
			? [{ field: "q", operator: "contains", value: userSearch }]
			: [],
	});
	const isLoadingUsers = usersQuery.isLoading;

	const organizations = (orgsResult?.data ?? []) as Organization[];
	const users = (usersResult?.data ?? []) as User[];

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const newErrors: Record<string, string> = {};
		if (!formData.organizationId) {
			newErrors.organizationId = "Organization is required";
		}
		if (!formData.userId) {
			newErrors.userId = "User is required";
		}

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			return;
		}

		createMember(
			{
				resource: "members",
				values: formData,
			},
			{
				onSuccess: () => {
					list("members");
				},
				onError: (error) => {
					if (error.message.includes("already a member")) {
						setErrors({ userId: "User is already a member of this organization" });
					}
				},
			},
		);
	};

	const selectedUser = users.find((u) => u.id === formData.userId);

	return (
		<div>
			<div className="mb-6">
				<h2 className="text-2xl font-bold text-gray-900">Add Member</h2>
				<p className="text-gray-600 mt-1">
					Add a user to an organization.
				</p>
			</div>

			<form onSubmit={handleSubmit} className="max-w-lg space-y-4">
				<Select
					label="Organization"
					name="organizationId"
					value={formData.organizationId}
					onChange={(e) =>
						setFormData((prev) => ({ ...prev, organizationId: e.target.value }))
					}
					options={organizations.map((org) => ({
						value: org.id,
						label: `${org.name} (${org.slug})`,
					}))}
					placeholder="Select an organization"
					error={errors.organizationId}
					required
				/>

				<div className="space-y-2">
					<label className="block text-sm font-medium text-gray-700">
						User
					</label>
					<Input
						placeholder="Search users by name or email..."
						value={userSearch}
						onChange={(e) => setUserSearch(e.target.value)}
					/>
					{isLoadingUsers ? (
						<div className="text-sm text-gray-500">Loading users...</div>
					) : users.length > 0 ? (
						<div className="max-h-48 overflow-y-auto border rounded-md">
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
						<div className="flex items-center gap-2 p-2 bg-blue-50 rounded-md">
							{selectedUser.image && (
								<img
									src={selectedUser.image}
									alt={selectedUser.name}
									className="w-8 h-8 rounded-full"
								/>
							)}
							<div>
								<div className="font-medium">{selectedUser.name}</div>
								<div className="text-sm text-gray-500">{selectedUser.email}</div>
							</div>
						</div>
					)}
					{errors.userId && (
						<p className="text-sm text-red-600">{errors.userId}</p>
					)}
				</div>

				<Select
					label="Role"
					name="role"
					value={formData.role}
					onChange={(e) =>
						setFormData((prev) => ({ ...prev, role: e.target.value }))
					}
					options={ROLES}
				/>

				<div className="flex gap-3 pt-4">
					<Button type="submit" disabled={isCreating}>
						{isCreating ? "Adding..." : "Add Member"}
					</Button>
					<Button
						type="button"
						variant="secondary"
						onClick={() => list("members")}
					>
						Cancel
					</Button>
				</div>
			</form>
		</div>
	);
}
