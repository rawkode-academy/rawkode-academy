import { useCreate, useList, useNavigation } from "@refinedev/core";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { Button, Select, Input } from "../ui";

interface Organization {
	id: string;
	name: string;
	slug: string;
}

export function TeamCreate() {
	const { list } = useNavigation();
	const [searchParams] = useSearchParams();
	const preselectedOrgId = searchParams.get("organizationId");

	const { mutate: createTeam, mutation } = useCreate();
	const isCreating = mutation.isPending;

	const [formData, setFormData] = useState({
		name: "",
		organizationId: preselectedOrgId || "",
	});
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Fetch organizations for dropdown
	const { result: orgsResult } = useList<Organization>({
		resource: "organizations",
		pagination: { currentPage: 1, pageSize: 100 },
	});

	const organizations = (orgsResult?.data ?? []) as Organization[];

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const newErrors: Record<string, string> = {};
		if (!formData.name.trim()) {
			newErrors.name = "Team name is required";
		}
		if (!formData.organizationId) {
			newErrors.organizationId = "Organization is required";
		}

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			return;
		}

		createTeam(
			{
				resource: "teams",
				values: {
					name: formData.name.trim(),
					organizationId: formData.organizationId,
				},
			},
			{
				onSuccess: () => {
					list("teams");
				},
			},
		);
	};

	return (
		<div>
			<div className="mb-6">
				<h2 className="text-2xl font-bold text-gray-900">Create Team</h2>
				<p className="text-gray-600 mt-1">
					Create a new team within an organization.
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

				<Input
					label="Team Name"
					name="name"
					value={formData.name}
					onChange={(e) =>
						setFormData((prev) => ({ ...prev, name: e.target.value }))
					}
					placeholder="Engineering"
					error={errors.name}
					required
				/>

				<div className="flex gap-3 pt-4">
					<Button type="submit" disabled={isCreating}>
						{isCreating ? "Creating..." : "Create Team"}
					</Button>
					<Button
						type="button"
						variant="secondary"
						onClick={() => list("teams")}
					>
						Cancel
					</Button>
				</div>
			</form>
		</div>
	);
}
