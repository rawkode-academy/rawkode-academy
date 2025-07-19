import React, { useEffect } from "react";
import { Tldraw, createShapeId, useEditor, track } from "tldraw";
import type { TLGeoShape, TLShape } from "@tldraw/tlschema";
import "tldraw/tldraw.css";

interface Activity {
	id: string;
	data: {
		title: string;
		description: string;
		order: number;
		outcome: string;
		personas: string[];
	};
}

interface Persona {
	id: string;
	data: {
		title: string;
		description: string;
	};
}

interface Story {
	id: string;
	data: {
		title: string;
		description: string;
		asA: string;
		iWant: string;
		soThat: string;
		priority: "must" | "should" | "could" | "wont";
		activityId: string;
	};
}

interface Action {
	id: string;
	slug: string;
	data: {
		title: string;
		description: string;
		persona: string;
		activityId: string;
		type: "click" | "input" | "navigate" | "view" | "interact";
		outcome: string;
		storyId?: string;
		sequence?: number;
	};
}

interface Feature {
	id: string;
	data: {
		title: string;
		description: string;
		enhancement: string;
		priority: "must" | "should" | "could" | "wont";
		size?: "XS" | "S" | "M" | "L" | "XL";
	};
}

interface Props {
	personas: Persona[];
	activities: Activity[];
	stories: Story[];
	actions?: Action[];
	features?: Feature[];
}

const priorityColors = {
	must: "red",
	should: "yellow",
	could: "blue",
	wont: "grey",
} as const;

// Persona Pills Component
const PersonaPills = track(
	({ personas, x, y }: { personas: Persona[]; x: number; y: number }) => {
		const editor = useEditor();

		// Convert world coordinates to screen coordinates
		const screenPoint = editor.pageToScreen({ x, y });

		// Get current zoom
		const zoom = editor.getZoomLevel();

		return (
			<div
				className="absolute"
				style={{
					transform: `translate(${screenPoint.x}px, ${screenPoint.y}px) scale(${zoom})`,
					transformOrigin: "top left",
					display: "flex",
					gap: "15px",
					pointerEvents: "none",
				}}
			>
				{personas.map((persona, index) => {
					const colors = [
						"bg-violet-600",
						"bg-blue-600",
						"bg-green-600",
						"bg-orange-600",
						"bg-red-600",
					];
					return (
						<div
							key={persona.id}
							className={`${colors[index % colors.length]} text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg`}
							style={{ pointerEvents: "auto" }}
						>
							{persona.data.title}
						</div>
					);
				})}
			</div>
		);
	},
);

// Generate sample actions for each activity
const generateActionsForActivity = (activity: Activity): Action[] => {
	const actions: Action[] = [];

	// Generate actions based on activity type
	if (activity.id.includes("discover")) {
		actions.push(
			{
				id: `${activity.id}-action-1`,
				slug: `${activity.id}-action-1`,
				data: {
					title: "Search",
					description: "Enter search terms",
					persona: activity.data.personas[0],
					activityId: activity.id,
					type: "input",
					outcome: "Find relevant content",
					sequence: 1,
				},
			},
			{
				id: `${activity.id}-action-2`,
				slug: `${activity.id}-action-2`,
				data: {
					title: "Browse",
					description: "Scroll through results",
					persona: activity.data.personas[0],
					activityId: activity.id,
					type: "view",
					outcome: "View available options",
					sequence: 2,
				},
			},
			{
				id: `${activity.id}-action-3`,
				slug: `${activity.id}-action-3`,
				data: {
					title: "Select",
					description: "Click on item",
					persona: activity.data.personas[0],
					activityId: activity.id,
					type: "click",
					outcome: "Access detailed view",
					sequence: 3,
				},
			},
		);
	} else if (activity.id.includes("interact")) {
		actions.push(
			{
				id: `${activity.id}-action-1`,
				slug: `${activity.id}-action-1`,
				data: {
					title: "Comment",
					description: "Add feedback",
					persona: activity.data.personas[0],
					activityId: activity.id,
					type: "input",
					outcome: "Share thoughts",
					sequence: 1,
				},
			},
			{
				id: `${activity.id}-action-2`,
				slug: `${activity.id}-action-2`,
				data: {
					title: "Share",
					description: "Distribute content",
					persona: activity.data.personas[0],
					activityId: activity.id,
					type: "interact",
					outcome: "Spread knowledge",
					sequence: 2,
				},
			},
		);
	} else {
		// Default actions
		actions.push(
			{
				id: `${activity.id}-action-1`,
				slug: `${activity.id}-action-1`,
				data: {
					title: "Navigate",
					description: "Go to section",
					persona: activity.data.personas[0],
					activityId: activity.id,
					type: "navigate",
					outcome: "Reach destination",
					sequence: 1,
				},
			},
			{
				id: `${activity.id}-action-2`,
				slug: `${activity.id}-action-2`,
				data: {
					title: "Interact",
					description: "Engage with feature",
					persona: activity.data.personas[0],
					activityId: activity.id,
					type: "interact",
					outcome: "Complete task",
					sequence: 2,
				},
			},
		);
	}

	return actions;
};

function StoryMapContent({
	personas,
	activities,
	stories,
	actions = [],
	features = [],
}: Props) {
	const editor = useEditor();

	// Sort activities by order
	const sortedActivities = [...activities].sort(
		(a, b) => a.data.order - b.data.order,
	);

	// Create tldraw shapes for arrows
	useEffect(() => {
		if (!editor) return;

		// Clear existing arrows
		const existingArrows = [...editor.getCurrentPageShapeIds()].filter((id) =>
			id.includes("arrow-activity-to-action"),
		);
		if (existingArrows.length > 0) {
			editor.deleteShapes(existingArrows);
		}

		// Create arrows from activities to actions
		setTimeout(() => {
			const arrows = [];

			sortedActivities.forEach((activity, activityIndex) => {
				const activityX = 100 + activityIndex * 360 + 160; // Center of activity card
				const activityY = 150 + 200; // Bottom of activity card

				const actions = generateActionsForActivity(activity);
				actions.forEach((action, actionIndex) => {
					const actionX =
						100 + activityIndex * 360 + (actionIndex % 2) * 170 + 80; // Center of action
					const actionY = 380 + Math.floor(actionIndex / 2) * 80;

					const arrowId = createShapeId(
						`arrow-activity-to-action-${activity.id}-${action.id}`,
					);
					const arrow = {
						id: arrowId,
						type: "arrow" as const,
						x: activityX,
						y: activityY,
						props: {
							start: {
								x: 0,
								y: 0,
							},
							end: {
								x: actionX - activityX,
								y: actionY - activityY,
							},
							color: "grey" as const,
							dash: "dashed" as const,
							size: "s" as const,
						},
					};
					arrows.push(arrow);
				});
			});

			if (arrows.length > 0) {
				editor.createShapes(arrows);
			}
		}, 500);
	}, [editor, sortedActivities]);

	// Add click handler for creating new stories
	useEffect(() => {
		if (!editor) return;

		const handleCanvasClick = async (e: PointerEvent) => {
			// Get the point where the user clicked in canvas coordinates
			const point = editor.inputs.currentPagePoint;

			// Determine which activity column was clicked
			let clickedActivityIndex = -1;
			let clickedActivity = null;

			for (let i = 0; i < sortedActivities.length; i++) {
				const activityX = 100 + i * 360;
				const activityWidth = 320;

				if (point.x >= activityX && point.x <= activityX + activityWidth) {
					clickedActivityIndex = i;
					clickedActivity = sortedActivities[i];
					break;
				}
			}

			// Only proceed if clicked within an activity column and below the actions area
			if (clickedActivity && point.y > 600) {
				// Check if holding shift key for creation mode
				if (e.shiftKey) {
					const title = prompt("Enter story title:");
					if (!title) return;

					const description = prompt("Enter story description:") || "";
					const asA = prompt("As a (persona):") || "user";
					const iWant = prompt("I want to:") || "";
					const soThat = prompt("So that:") || "";

					// Check if we're in development mode
					if (window.location.hostname === "localhost") {
						try {
							const response = await fetch("/api/stories", {
								method: "POST",
								headers: {
									"Content-Type": "application/json",
								},
								body: JSON.stringify({
									title,
									description,
									asA,
									iWant,
									soThat,
									acceptanceCriteria: [],
									priority: "should",
									activityId: clickedActivity.id,
								}),
							});

							if (response.ok) {
								const result = await response.json();
								alert(`Story created: ${result.filename}`);
								// Reload to show new story
								window.location.reload();
							} else {
								const error = await response.json();
								alert(`Error creating story: ${error.error}`);
							}
						} catch (err) {
							alert(
								`Error: ${err instanceof Error ? err.message : String(err)}`,
							);
						}
					} else {
						alert(
							"Story creation is only available in development mode. In production, stories should be created via Git.",
						);
					}
				}
			}
		};

		// Add event listener
		editor.on("pointer:up", handleCanvasClick);

		// Cleanup
		return () => {
			editor.off("pointer:up", handleCanvasClick);
		};
	}, [editor, sortedActivities]);

	return (
		<>
			{/* Render persona pills at the top */}
			<PersonaPills personas={personas} x={100} y={50} />

			{/* Render activity cards with proper positioning */}
			{sortedActivities.map((activity, index) => {
				const x = 100 + index * 360; // 320px width + 40px gap
				const y = 150;

				return (
					<ActivityCard key={activity.id} activity={activity} x={x} y={y} />
				);
			})}

			{/* Render actions for each activity */}
			{sortedActivities.map((activity, activityIndex) => {
				const activityX = 100 + activityIndex * 360;
				// Use actual actions from content if available, otherwise generate sample ones
				const activityActions =
					actions.length > 0
						? actions
								.filter((a) => a.data.activityId === activity.id)
								.sort((a, b) => (a.data.sequence || 0) - (b.data.sequence || 0))
						: generateActionsForActivity(activity);

				return activityActions.map((action, actionIndex) => {
					const x = activityX + (actionIndex % 2) * 170; // 2 columns
					const y = 380 + Math.floor(actionIndex / 2) * 80; // Rows

					return (
						<ActionCard
							key={action.id || action.slug}
							action={action}
							x={x}
							y={y}
						/>
					);
				});
			})}

			{/* Render story cards below actions */}
			{sortedActivities.map((activity, activityIndex) => {
				const activityX = 100 + activityIndex * 360;
				const activityStories = stories.filter(
					(story) => story.data.activityId === activity.id,
				);
				// Count actual or generated actions
				const activityActions =
					actions.length > 0
						? actions.filter((a) => a.data.activityId === activity.id).length
						: generateActionsForActivity(activity).length;
				const actionsCount = activityActions;
				const actionsHeight = Math.ceil(actionsCount / 2) * 80; // Height of action cards

				return activityStories.map((story, storyIndex) => {
					const x = activityX;
					const y = 380 + actionsHeight + 40 + storyIndex * 120; // Below action cards

					return <StoryCard key={story.id} story={story} x={x} y={y} />;
				});
			})}

			{/* Render features on the right side */}
			{features.map((feature, index) => {
				const x = 100 + sortedActivities.length * 360 + 100; // To the right of all activities
				const y = 150 + index * 180; // Vertical spacing

				return <FeatureCard key={feature.id} feature={feature} x={x} y={y} />;
			})}
		</>
	);
}

// Custom Activity Card Component
const ActivityCard = track(
	({ activity, x, y }: { activity: Activity; x: number; y: number }) => {
		const editor = useEditor();

		// Convert world coordinates to screen coordinates
		const screenPoint = editor.pageToScreen({ x, y });

		// Get current zoom and camera position
		const zoom = editor.getZoomLevel();
		const camera = editor.getCamera();

		return (
			<div
				className="absolute"
				style={{
					transform: `translate(${screenPoint.x}px, ${screenPoint.y}px) scale(${zoom})`,
					transformOrigin: "top left",
					width: "320px",
					pointerEvents: "none",
				}}
			>
				<div
					className="bg-gray-800 rounded-lg shadow-lg border-2 border-gray-700 overflow-hidden"
					style={{ pointerEvents: "auto" }}
				>
					{/* Header */}
					<div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2">
						<div className="text-xs font-semibold uppercase tracking-wider">
							Activity
						</div>
						<h3 className="text-lg font-bold mt-1">{activity.data.title}</h3>
					</div>

					{/* Content */}
					<div className="p-4 space-y-3">
						{/* Personas Pills */}
						<div className="flex flex-wrap gap-2">
							{activity.data.personas.map((persona) => (
								<span
									key={persona}
									className="px-3 py-1 bg-purple-600 text-purple-100 rounded-full text-xs font-medium"
								>
									{persona}
								</span>
							))}
						</div>

						{/* Description */}
						<p className="text-sm text-gray-300">{activity.data.description}</p>

						{/* Outcome */}
						<div className="bg-green-900 border border-green-700 rounded p-3">
							<div className="flex items-start gap-2">
								<span className="text-green-400">🎯</span>
								<div>
									<div className="text-xs font-semibold text-green-400">
										Outcome
									</div>
									<div className="text-sm text-gray-200">
										{activity.data.outcome}
									</div>
								</div>
							</div>
						</div>

						{/* Order indicator */}
						<div className="flex justify-between items-center pt-2 border-t border-gray-700">
							<span className="text-xs text-gray-400">
								Order: {activity.data.order}
							</span>
							<div className="flex gap-1">
								{[1, 2, 3].map((i) => (
									<div
										key={i}
										className={`w-2 h-2 rounded-full ${i <= activity.data.order ? "bg-blue-500" : "bg-gray-600"}`}
									/>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	},
);

// Custom Action Card Component
const ActionCard = track(
	({ action, x, y }: { action: Action; x: number; y: number }) => {
		const editor = useEditor();

		// Convert world coordinates to screen coordinates
		const screenPoint = editor.pageToScreen({ x, y });

		// Get current zoom
		const zoom = editor.getZoomLevel();

		const actionTypeIcons = {
			click: "👆",
			input: "⌨️",
			navigate: "🧭",
			view: "👁️",
			interact: "🤝",
		};

		const actionTypeColors = {
			click: "bg-purple-900 border-purple-700 text-purple-200",
			input: "bg-indigo-900 border-indigo-700 text-indigo-200",
			navigate: "bg-teal-900 border-teal-700 text-teal-200",
			view: "bg-cyan-900 border-cyan-700 text-cyan-200",
			interact: "bg-pink-900 border-pink-700 text-pink-200",
		};

		return (
			<div
				className="absolute"
				style={{
					transform: `translate(${screenPoint.x}px, ${screenPoint.y}px) scale(${zoom})`,
					transformOrigin: "top left",
					width: "160px",
					pointerEvents: "none",
				}}
			>
				<div
					className={`rounded-lg border-2 p-3 shadow-md ${actionTypeColors[action.data.type]}`}
					style={{ pointerEvents: "auto" }}
				>
					<div className="flex items-start gap-2">
						<span className="text-xl">{actionTypeIcons[action.data.type]}</span>
						<div className="flex-1">
							<h5 className="font-semibold text-xs mb-1">
								{action.data.title}
							</h5>
							<p className="text-xs opacity-80 mb-2">
								{action.data.description}
							</p>
							<div className="flex items-center justify-between">
								<span className="text-xs font-medium px-2 py-0.5 bg-black bg-opacity-30 rounded">
									{action.data.persona}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	},
);

// Custom Feature Card Component
const FeatureCard = track(
	({ feature, x, y }: { feature: Feature; x: number; y: number }) => {
		const editor = useEditor();
		const [isDragOver, setIsDragOver] = React.useState(false);

		// Convert world coordinates to screen coordinates
		const screenPoint = editor.pageToScreen({ x, y });

		// Get current zoom
		const zoom = editor.getZoomLevel();

		const priorityStyles = {
			must: "bg-red-800 border-red-600 text-red-100",
			should: "bg-yellow-800 border-yellow-600 text-yellow-100",
			could: "bg-blue-800 border-blue-600 text-blue-100",
			wont: "bg-gray-600 border-gray-500 text-gray-100",
		};

		const sizeStyles = {
			XS: "text-xs",
			S: "text-sm",
			M: "text-base",
			L: "text-lg",
			XL: "text-xl",
		};

		const handleDragOver = (e: React.DragEvent) => {
			e.preventDefault();
			e.dataTransfer.dropEffect = "link";
			setIsDragOver(true);
		};

		const handleDragLeave = () => {
			setIsDragOver(false);
		};

		const handleDrop = async (e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);

			const storyId = e.dataTransfer.getData("storyId");
			const storyData = JSON.parse(e.dataTransfer.getData("storyData"));

			// Check if we're in development mode
			if (window.location.hostname === "localhost") {
				try {
					const response = await fetch(`/api/stories/${storyId}`, {
						method: "PATCH",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							featureId: feature.id,
						}),
					});

					if (response.ok) {
						alert(
							`Story "${storyData.title}" linked to feature "${feature.data.title}"`,
						);
						// Reload to show updated relationships
						window.location.reload();
					} else {
						const error = await response.json();
						alert(`Error linking story: ${error.error}`);
					}
				} catch (err) {
					alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
				}
			} else {
				alert(
					"Story linking is only available in development mode. In production, stories should be linked via Git.",
				);
			}
		};

		return (
			<div
				className="absolute"
				style={{
					transform: `translate(${screenPoint.x}px, ${screenPoint.y}px) scale(${zoom})`,
					transformOrigin: "top left",
					width: "320px",
					pointerEvents: "none",
				}}
			>
				<div
					className={`rounded-lg border-4 p-4 shadow-2xl ${priorityStyles[feature.data.priority]} ${isDragOver ? "ring-4 ring-white ring-opacity-50" : ""}`}
					style={{ pointerEvents: "auto" }}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
				>
					<div className="flex justify-between items-start mb-3">
						<div>
							<div className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">
								Feature
							</div>
							<h3 className="font-bold text-lg">{feature.data.title}</h3>
						</div>
						{feature.data.size && (
							<span
								className={`px-3 py-1 bg-black bg-opacity-30 rounded-full font-bold ${sizeStyles[feature.data.size]}`}
							>
								{feature.data.size}
							</span>
						)}
					</div>

					<p className="text-sm mb-3 opacity-90">{feature.data.description}</p>

					<div className="bg-black bg-opacity-20 rounded p-3 mb-3">
						<div className="text-xs font-semibold mb-1 opacity-80">
							Enhancement
						</div>
						<div className="text-sm">{feature.data.enhancement}</div>
					</div>

					<div className="text-xs opacity-70">
						Drop stories here to link them
					</div>
				</div>
			</div>
		);
	},
);

// Custom Story Card Component
const StoryCard = track(
	({ story, x, y }: { story: Story; x: number; y: number }) => {
		const editor = useEditor();
		const [isEditing, setIsEditing] = React.useState(false);
		const [editedStory, setEditedStory] = React.useState(story.data);
		const [isDragging, setIsDragging] = React.useState(false);

		// Convert world coordinates to screen coordinates
		const screenPoint = editor.pageToScreen({ x, y });

		// Get current zoom
		const zoom = editor.getZoomLevel();

		const priorityStyles = {
			must: "bg-red-900 border-red-700 text-red-200",
			should: "bg-yellow-900 border-yellow-700 text-yellow-200",
			could: "bg-blue-900 border-blue-700 text-blue-200",
			wont: "bg-gray-700 border-gray-600 text-gray-200",
		};

		const priorityBadgeStyles = {
			must: "bg-red-600 text-white",
			should: "bg-yellow-600 text-white",
			could: "bg-blue-600 text-white",
			wont: "bg-gray-600 text-white",
		};

		const handleDoubleClick = () => {
			setIsEditing(true);
		};

		const handleSave = async () => {
			// Check if we're in development mode
			if (window.location.hostname === "localhost") {
				try {
					const response = await fetch(`/api/stories/${story.id}`, {
						method: "PATCH",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify(editedStory),
					});

					if (response.ok) {
						setIsEditing(false);
						// Reload to show updated story
						window.location.reload();
					} else {
						const error = await response.json();
						alert(`Error updating story: ${error.error}`);
					}
				} catch (err) {
					alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
				}
			} else {
				alert(
					"Story editing is only available in development mode. In production, stories should be edited via Git.",
				);
				setIsEditing(false);
			}
		};

		const handleCancel = () => {
			setEditedStory(story.data);
			setIsEditing(false);
		};

		const handleDragStart = (e: React.DragEvent) => {
			setIsDragging(true);
			e.dataTransfer.setData("storyId", story.id);
			e.dataTransfer.setData("storyData", JSON.stringify(story.data));
			e.dataTransfer.effectAllowed = "link";
		};

		const handleDragEnd = () => {
			setIsDragging(false);
		};

		return (
			<div
				className="absolute"
				style={{
					transform: `translate(${screenPoint.x}px, ${screenPoint.y}px) scale(${zoom})`,
					transformOrigin: "top left",
					width: "280px",
					pointerEvents: "none",
				}}
			>
				<div
					className={`rounded-lg border-2 p-4 ${priorityStyles[story.data.priority]} ${isDragging ? "opacity-50" : ""}`}
					style={{
						pointerEvents: "auto",
						cursor: isEditing ? "default" : "grab",
					}}
					onDoubleClick={handleDoubleClick}
					draggable={!isEditing}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
				>
					{isEditing ? (
						<div className="space-y-2">
							<input
								type="text"
								value={editedStory.title}
								onChange={(e) =>
									setEditedStory({ ...editedStory, title: e.target.value })
								}
								className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm"
								placeholder="Title"
							/>
							<textarea
								value={editedStory.description}
								onChange={(e) =>
									setEditedStory({
										...editedStory,
										description: e.target.value,
									})
								}
								className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs"
								placeholder="Description"
								rows={2}
							/>
							<input
								type="text"
								value={editedStory.asA}
								onChange={(e) =>
									setEditedStory({ ...editedStory, asA: e.target.value })
								}
								className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs"
								placeholder="As a..."
							/>
							<input
								type="text"
								value={editedStory.iWant}
								onChange={(e) =>
									setEditedStory({ ...editedStory, iWant: e.target.value })
								}
								className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs"
								placeholder="I want..."
							/>
							<input
								type="text"
								value={editedStory.soThat}
								onChange={(e) =>
									setEditedStory({ ...editedStory, soThat: e.target.value })
								}
								className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs"
								placeholder="So that..."
							/>
							<select
								value={editedStory.priority}
								onChange={(e) =>
									setEditedStory({
										...editedStory,
										priority: e.target.value as
											| "must"
											| "should"
											| "could"
											| "wont",
									})
								}
								className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs"
							>
								<option value="must">MUST</option>
								<option value="should">SHOULD</option>
								<option value="could">COULD</option>
								<option value="wont">WON'T</option>
							</select>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={handleSave}
									className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
								>
									Save
								</button>
								<button
									type="button"
									onClick={handleCancel}
									className="px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
								>
									Cancel
								</button>
							</div>
						</div>
					) : (
						<>
							<div className="flex justify-between items-start mb-2">
								<h4 className="font-semibold text-sm">{story.data.title}</h4>
								<span
									className={`px-2 py-1 rounded text-xs font-bold ${priorityBadgeStyles[story.data.priority]}`}
								>
									{story.data.priority.toUpperCase()}
								</span>
							</div>

							<div className="space-y-2 text-xs">
								<div>
									<span className="font-semibold">As a</span> {story.data.asA}
								</div>
								<div>
									<span className="font-semibold">I want</span>{" "}
									{story.data.iWant}
								</div>
								<div>
									<span className="font-semibold">So that</span>{" "}
									{story.data.soThat}
								</div>
							</div>
							<div className="mt-2 text-xs text-gray-400">
								{story.data.featureId ? (
									<span className="text-green-400">✓ Linked to feature</span>
								) : (
									"Double-click to edit • Drag to link"
								)}
							</div>
						</>
					)}
				</div>
			</div>
		);
	},
);

export default function InteractiveStoryMap({
	personas,
	activities,
	stories,
	actions,
	features,
}: Props) {
	return (
		<div className="w-full h-screen border rounded-lg overflow-hidden bg-gray-900">
			{/* Toolbar */}
			<div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
				<h2 className="text-xl font-semibold text-white">
					Interactive Story Map
				</h2>
				<div className="flex gap-4 items-center">
					<div className="text-sm text-gray-300 bg-gray-700 px-3 py-1 rounded">
						💡 Shift + Click: Create story | Double-click: Edit | Drag: Link to
						feature
					</div>
					<div className="text-sm text-gray-300">
						✏️ Full drawing tools • 🎨 Professional whiteboard • 🔗 Infinite
						canvas
					</div>
				</div>
			</div>

			{/* Tldraw Canvas */}
			<div className="h-[calc(100vh-140px)]">
				<Tldraw shareZone={<div />} forceDarkMode={true} className="dark">
					<StoryMapContent
						personas={personas}
						activities={activities}
						stories={stories}
						actions={actions}
						features={features}
					/>
				</Tldraw>
			</div>

			{/* Legend */}
			<div className="p-4 border-t border-gray-700 bg-gray-800">
				<div className="flex flex-wrap gap-4 text-sm">
					<div className="flex items-center gap-2">
						<div className="w-4 h-4 bg-red-500 border border-red-400 rounded" />
						<span className="text-white">MUST have</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="w-4 h-4 bg-yellow-500 border border-yellow-400 rounded" />
						<span className="text-white">SHOULD have</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="w-4 h-4 bg-blue-500 border border-blue-400 rounded" />
						<span className="text-white">COULD have</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="w-4 h-4 bg-gray-500 border border-gray-400 rounded" />
						<span className="text-white">WON'T have</span>
					</div>
					<span className="ml-8 text-gray-300">
						💡 Professional whiteboard with full drawing tools, shapes, and
						collaboration features
					</span>
				</div>
			</div>
		</div>
	);
}
