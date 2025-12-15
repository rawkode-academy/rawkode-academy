import { useCreate, useNavigation } from "@refinedev/core";
import { useState } from "react";
import { Button, Input } from "../ui";

export function OrganizationCreate() {
	const { list } = useNavigation();
	const { mutate: createOrg, mutation } = useCreate();
	const isLoading = mutation.isPending;

	const [formData, setFormData] = useState({
		name: "",
		slug: "",
		logo: "",
	});
	const [errors, setErrors] = useState<Record<string, string>>({});

	const generateSlug = (name: string) => {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");
	};

	const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const name = e.target.value;
		setFormData((prev) => ({
			...prev,
			name,
			slug: prev.slug || generateSlug(name),
		}));
	};

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

		createOrg(
			{
				resource: "organizations",
				values: {
					name: formData.name.trim(),
					slug: formData.slug.trim(),
					logo: formData.logo.trim() || undefined,
				},
			},
			{
				onSuccess: () => {
					list("organizations");
				},
				onError: (error) => {
					if (error.message.includes("slug already exists")) {
						setErrors({ slug: "This slug is already taken" });
					}
				},
			},
		);
	};

	return (
		<div>
			<div className="mb-6">
				<h2 className="text-2xl font-bold text-gray-900">Create Organization</h2>
				<p className="text-gray-600 mt-1">
					Add a new organization to the platform.
				</p>
			</div>

			<form onSubmit={handleSubmit} className="max-w-lg space-y-4">
				<Input
					label="Name"
					name="name"
					value={formData.name}
					onChange={handleNameChange}
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
					<Button type="submit" disabled={isLoading}>
						{isLoading ? "Creating..." : "Create Organization"}
					</Button>
					<Button
						type="button"
						variant="secondary"
						onClick={() => list("organizations")}
					>
						Cancel
					</Button>
				</div>
			</form>
		</div>
	);
}
