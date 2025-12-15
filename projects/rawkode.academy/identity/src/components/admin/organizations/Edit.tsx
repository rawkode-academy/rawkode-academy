import { useOne, useUpdate, useNavigation } from "@refinedev/core";
import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { Button, Input } from "../ui";

interface Organization {
	id: string;
	name: string;
	slug: string;
	logo?: string;
}

export function OrganizationEdit() {
	const { id } = useParams<{ id: string }>();
	const { show } = useNavigation();

	const { result: orgResult, query: orgQuery } = useOne<Organization>({
		resource: "organizations",
		id: id!,
	});
	const isLoadingOrg = orgQuery.isLoading;
	const data = { data: orgResult };

	const { mutate: updateOrg, mutation: updateMutation } = useUpdate();
	const isUpdating = updateMutation.isPending;

	const [formData, setFormData] = useState({
		name: "",
		slug: "",
		logo: "",
	});
	const [errors, setErrors] = useState<Record<string, string>>({});

	useEffect(() => {
		if (data?.data) {
			setFormData({
				name: data.data.name,
				slug: data.data.slug,
				logo: data.data.logo || "",
			});
		}
	}, [data]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const newErrors: Record<string, string> = {};
		if (!formData.name.trim()) {
			newErrors.name = "Name is required";
		}
		if (!formData.slug.trim()) {
			newErrors.slug = "Slug is required";
		} else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
			newErrors.slug = "Slug can only contain lowercase letters, numbers, and hyphens";
		}

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			return;
		}

		updateOrg(
			{
				resource: "organizations",
				id: id!,
				values: {
					name: formData.name.trim(),
					slug: formData.slug.trim(),
					logo: formData.logo.trim() || null,
				},
			},
			{
				onSuccess: () => {
					show("organizations", id!);
				},
				onError: (error) => {
					if (error.message.includes("slug already exists")) {
						setErrors({ slug: "This slug is already taken" });
					}
				},
			},
		);
	};

	if (isLoadingOrg) {
		return (
			<div className="flex items-center justify-center py-8">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6">
				<h2 className="text-2xl font-bold text-gray-900">Edit Organization</h2>
				<p className="text-gray-600 mt-1">
					Update the organization details.
				</p>
			</div>

			<form onSubmit={handleSubmit} className="max-w-lg space-y-4">
				<Input
					label="Name"
					name="name"
					value={formData.name}
					onChange={(e) =>
						setFormData((prev) => ({ ...prev, name: e.target.value }))
					}
					placeholder="My Organization"
					error={errors.name}
					required
				/>

				<Input
					label="Slug"
					name="slug"
					value={formData.slug}
					onChange={(e) =>
						setFormData((prev) => ({ ...prev, slug: e.target.value }))
					}
					placeholder="my-organization"
					error={errors.slug}
					required
				/>

				<Input
					label="Logo URL (optional)"
					name="logo"
					type="url"
					value={formData.logo}
					onChange={(e) =>
						setFormData((prev) => ({ ...prev, logo: e.target.value }))
					}
					placeholder="https://example.com/logo.png"
				/>

				<div className="flex gap-3 pt-4">
					<Button type="submit" disabled={isUpdating}>
						{isUpdating ? "Saving..." : "Save Changes"}
					</Button>
					<Button
						type="button"
						variant="secondary"
						onClick={() => show("organizations", id!)}
					>
						Cancel
					</Button>
				</div>
			</form>
		</div>
	);
}
