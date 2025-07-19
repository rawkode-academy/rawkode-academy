import React, { useState, useEffect, useRef } from "react";
import "./StoryCreationModal.css";

interface StoryCreationModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (data: StoryFormData) => void;
	activityId: string;
	activityTitle: string;
	personas: Array<{ id: string; slug?: string; data: { title: string } }>;
	features: Array<{ id: string; slug?: string; data: { title: string } }>;
}

interface StoryFormData {
	title: string;
	description: string;
	personaId: string;
	iWant: string;
	soThat: string;
	acceptanceCriteria: string[];
	priority: "must" | "should" | "could" | "wont";
	size?: "XS" | "S" | "M" | "L" | "XL";
	activityId: string;
	featureId?: string;
}

export default function StoryCreationModal({
	isOpen,
	onClose,
	onSubmit,
	activityId,
	activityTitle,
	personas,
	features,
}: StoryCreationModalProps) {
	const [formData, setFormData] = useState<StoryFormData>({
		title: "",
		description: "",
		personaId: personas[0]?.slug || personas[0]?.id || "",
		iWant: "",
		soThat: "",
		acceptanceCriteria: [""],
		priority: "should",
		size: "M",
		activityId,
		featureId: "",
	});

	const titleInputRef = useRef<HTMLInputElement>(null);

	// Focus title input when modal opens
	useEffect(() => {
		if (isOpen && titleInputRef.current) {
			titleInputRef.current.focus();
		}
	}, [isOpen]);

	// Handle escape key
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isOpen) {
				onClose();
			}
		};
		window.addEventListener("keydown", handleEscape);
		return () => window.removeEventListener("keydown", handleEscape);
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		// Remove empty acceptance criteria
		const cleanedData = {
			...formData,
			acceptanceCriteria: formData.acceptanceCriteria.filter(
				(ac) => ac.trim() !== "",
			),
		};
		onSubmit(cleanedData);
	};

	const addAcceptanceCriteria = () => {
		setFormData({
			...formData,
			acceptanceCriteria: [...formData.acceptanceCriteria, ""],
		});
	};

	const updateAcceptanceCriteria = (index: number, value: string) => {
		const updated = [...formData.acceptanceCriteria];
		updated[index] = value;
		setFormData({ ...formData, acceptanceCriteria: updated });
	};

	const removeAcceptanceCriteria = (index: number) => {
		const updated = formData.acceptanceCriteria.filter((_, i) => i !== index);
		setFormData({ ...formData, acceptanceCriteria: updated });
	};

	return (
		<div className="story-modal-overlay" onClick={onClose}>
			<div className="story-modal" onClick={(e) => e.stopPropagation()}>
				<div className="story-modal-header">
					<h2 className="story-modal-title">Create New Story</h2>
					<button type="button" className="story-modal-close" onClick={onClose}>
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form onSubmit={handleSubmit} className="story-modal-form">
					<div className="form-section">
						<div className="form-group">
							<label htmlFor="title">Story Title</label>
							<input
								ref={titleInputRef}
								id="title"
								type="text"
								value={formData.title}
								onChange={(e) =>
									setFormData({ ...formData, title: e.target.value })
								}
								placeholder="Enter a concise story title"
								required
							/>
						</div>

						<div className="form-group">
							<label htmlFor="description">Description</label>
							<textarea
								id="description"
								value={formData.description}
								onChange={(e) =>
									setFormData({ ...formData, description: e.target.value })
								}
								placeholder="Describe the story in detail"
								rows={3}
								required
							/>
						</div>
					</div>

					<div className="form-section story-format-section">
						<h3>Story Format</h3>

						<div className="form-group">
							<label htmlFor="persona">As a</label>
							<select
								id="persona"
								value={formData.personaId}
								onChange={(e) =>
									setFormData({ ...formData, personaId: e.target.value })
								}
								required
							>
								{personas.map((persona) => (
									<option
										key={persona.slug || persona.id}
										value={persona.slug || persona.id}
									>
										{persona.data.title}
									</option>
								))}
							</select>
						</div>

						<div className="form-group">
							<label htmlFor="iWant">I want</label>
							<input
								id="iWant"
								type="text"
								value={formData.iWant}
								onChange={(e) =>
									setFormData({ ...formData, iWant: e.target.value })
								}
								placeholder="What the user wants to do"
								required
							/>
						</div>

						<div className="form-group">
							<label htmlFor="soThat">So that</label>
							<input
								id="soThat"
								type="text"
								value={formData.soThat}
								onChange={(e) =>
									setFormData({ ...formData, soThat: e.target.value })
								}
								placeholder="The value or benefit"
								required
							/>
						</div>
					</div>

					<div className="form-section">
						<h3>Acceptance Criteria</h3>
						{formData.acceptanceCriteria.map((criteria, index) => (
							<div key={index} className="criteria-row">
								<input
									type="text"
									value={criteria}
									onChange={(e) =>
										updateAcceptanceCriteria(index, e.target.value)
									}
									placeholder="Enter acceptance criteria"
								/>
								{formData.acceptanceCriteria.length > 1 && (
									<button
										type="button"
										className="criteria-remove"
										onClick={() => removeAcceptanceCriteria(index)}
									>
										×
									</button>
								)}
							</div>
						))}
						<button
							type="button"
							className="criteria-add"
							onClick={addAcceptanceCriteria}
						>
							+ Add Criteria
						</button>
					</div>

					<div className="form-section">
						<div className="form-row">
							<div className="form-group">
								<label htmlFor="priority">Priority</label>
								<select
									id="priority"
									value={formData.priority}
									onChange={(e) =>
										setFormData({
											...formData,
											priority: e.target.value as any,
										})
									}
								>
									<option value="must">Must</option>
									<option value="should">Should</option>
									<option value="could">Could</option>
									<option value="wont">Won't</option>
								</select>
							</div>

							<div className="form-group">
								<label htmlFor="size">Size</label>
								<select
									id="size"
									value={formData.size}
									onChange={(e) =>
										setFormData({ ...formData, size: e.target.value as any })
									}
								>
									<option value="XS">XS</option>
									<option value="S">S</option>
									<option value="M">M</option>
									<option value="L">L</option>
									<option value="XL">XL</option>
								</select>
							</div>

							<div className="form-group">
								<label htmlFor="feature">Feature (Optional)</label>
								<select
									id="feature"
									value={formData.featureId}
									onChange={(e) =>
										setFormData({ ...formData, featureId: e.target.value })
									}
								>
									<option value="">None</option>
									{features.map((feature) => (
										<option
											key={feature.slug || feature.id}
											value={feature.slug || feature.id}
										>
											{feature.data.title}
										</option>
									))}
								</select>
							</div>
						</div>
					</div>

					<div className="form-section activity-info">
						<p>
							Activity: <strong>{activityTitle}</strong>
						</p>
					</div>

					<div className="story-modal-actions">
						<button type="button" className="btn-cancel" onClick={onClose}>
							Cancel
						</button>
						<button type="submit" className="btn-create">
							Create Story
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
