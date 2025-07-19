import React, { useEffect, useState } from "react";
import { Tldraw, createShapeId, Editor } from "tldraw";
import "tldraw/tldraw.css";

interface Activity {
	id: string;
	slug?: string;
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
	slug?: string;
	data: {
		title: string;
		description: string;
	};
}

interface Story {
	id: string;
	slug?: string;
	data: {
		title: string;
		description: string;
		personaId: string;
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
		personaId: string;
		activityId: string;
		type: "click" | "input" | "navigate" | "view" | "interact";
		outcome: string;
		storyId?: string;
		sequence?: number;
	};
}

interface Feature {
	id: string;
	slug?: string;
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

// Create shapes for personas at the top
const createPersonaShapes = (personas: Persona[], editor: Editor) => {
	const shapes = personas.map((persona, index) => {
		const colors = ["violet", "blue", "green", "orange", "red"];
		const personaId = persona.slug || persona.id;
		return {
			id: createShapeId(`persona-${personaId}`),
			type: "geo" as const,
			x: 100 + index * 120,
			y: 50,
			props: {
				w: 100,
				h: 40,
				geo: "rectangle" as const,
				color: colors[index % colors.length] as const,
				fill: "solid" as const,
				text: persona.data.title,
				font: "sans" as const,
				size: "s" as const,
				align: "middle" as const,
				verticalAlign: "middle" as const,
			},
		};
	});
	return shapes;
};

// Generate sample actions for each activity
const generateActionsForActivity = (activity: Activity): Action[] => {
	const actions: Action[] = [];
	const activityId = activity.slug || activity.id;

	// Generate actions based on activity type
	if (activityId.includes("discover")) {
		actions.push(
			{
				id: `${activityId}-action-1`,
				slug: `${activityId}-action-1`,
				data: {
					title: "Search",
					description: "Enter search terms",
					personaId: activity.data.personas[0],
					activityId: activityId,
					type: "input",
					outcome: "Find relevant content",
					sequence: 1,
				},
			},
			{
				id: `${activityId}-action-2`,
				slug: `${activityId}-action-2`,
				data: {
					title: "Browse",
					description: "Scroll through results",
					personaId: activity.data.personas[0],
					activityId: activityId,
					type: "view",
					outcome: "View available options",
					sequence: 2,
				},
			},
			{
				id: `${activityId}-action-3`,
				slug: `${activityId}-action-3`,
				data: {
					title: "Select",
					description: "Click on item",
					personaId: activity.data.personas[0],
					activityId: activityId,
					type: "click",
					outcome: "Access detailed view",
					sequence: 3,
				},
			},
		);
	} else if (activityId.includes("interact")) {
		actions.push(
			{
				id: `${activityId}-action-1`,
				slug: `${activityId}-action-1`,
				data: {
					title: "Comment",
					description: "Add feedback",
					personaId: activity.data.personas[0],
					activityId: activityId,
					type: "input",
					outcome: "Share thoughts",
					sequence: 1,
				},
			},
			{
				id: `${activityId}-action-2`,
				slug: `${activityId}-action-2`,
				data: {
					title: "Share",
					description: "Distribute content",
					personaId: activity.data.personas[0],
					activityId: activityId,
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
				id: `${activityId}-action-1`,
				slug: `${activityId}-action-1`,
				data: {
					title: "Navigate",
					description: "Go to section",
					personaId: activity.data.personas[0],
					activityId: activityId,
					type: "navigate",
					outcome: "Reach destination",
					sequence: 1,
				},
			},
			{
				id: `${activityId}-action-2`,
				slug: `${activityId}-action-2`,
				data: {
					title: "Interact",
					description: "Engage with feature",
					personaId: activity.data.personas[0],
					activityId: activityId,
					type: "interact",
					outcome: "Complete task",
					sequence: 2,
				},
			},
		);
	}

	return actions;
};

export default function InteractiveStoryMap({
	personas,
	activities,
	stories,
	actions = [],
	features = [],
}: Props) {
	const [editor, setEditor] = useState<Editor | null>(null);

	// Debug logging
	console.log("InteractiveStoryMap props:", {
		personas: personas.length,
		activities: activities.length,
		stories: stories.length,
		actions: actions.length,
		features: features.length,
	});

	// Sort activities by order
	const sortedActivities = [...activities].sort(
		(a, b) => a.data.order - b.data.order,
	);

	// Create shapes when editor is ready
	useEffect(() => {
		if (!editor) {
			console.log("Editor not ready yet");
			return;
		}

		console.log("Editor ready, creating shapes");

		// Clear all existing shapes to rebuild the canvas
		const allShapes = [...editor.getCurrentPageShapeIds()];
		if (allShapes.length > 0) {
			editor.deleteShapes(allShapes);
		}

		// Create all shapes
		const shapes: any[] = [];
		console.log("Creating shapes for activities:", sortedActivities.length);

		// Create persona shapes
		shapes.push(...createPersonaShapes(personas, editor));

		// Create activity shapes
		sortedActivities.forEach((activity, index) => {
			const x = 100 + index * 360;
			const y = 150;
			const activityId = activity.slug || activity.id;

			// Activity card shape
			shapes.push({
				id: createShapeId(`activity-${activityId}`),
				type: "geo" as const,
				x,
				y,
				props: {
					w: 320,
					h: 200,
					geo: "rectangle" as const,
					color: "blue" as const,
					fill: "solid" as const,
					text: `${activity.data.title}\n\n${activity.data.description}\n\nOutcome: ${activity.data.outcome}`,
					font: "sans" as const,
					size: "s" as const,
					align: "start" as const,
					verticalAlign: "start" as const,
				},
			});

			// Create action shapes
			const activityActions =
				actions.length > 0
					? actions.filter((a) => a.data.activityId === activityId)
					: generateActionsForActivity(activity);

			activityActions.forEach((action, actionIndex) => {
				const actionX = x + (actionIndex % 2) * 170;
				const actionY = 380 + Math.floor(actionIndex / 2) * 80;

				shapes.push({
					id: createShapeId(`action-${action.id}`),
					type: "geo" as const,
					x: actionX,
					y: actionY,
					props: {
						w: 160,
						h: 70,
						geo: "rectangle" as const,
						color: "violet" as const,
						fill: "pattern" as const,
						text: `${action.data.title}\n${action.data.description}`,
						font: "sans" as const,
						size: "s" as const,
						align: "middle" as const,
						verticalAlign: "middle" as const,
					},
				});

				// Create arrow from activity to action
				shapes.push({
					id: createShapeId(`arrow-${activityId}-${action.id}`),
					type: "arrow" as const,
					x: x + 160,
					y: y + 200,
					props: {
						start: {
							x: 0,
							y: 0,
						},
						end: {
							x: actionX + 80 - (x + 160),
							y: actionY - (y + 200),
						},
						color: "grey" as const,
						dash: "dashed" as const,
						size: "s" as const,
					},
				});
			});

			// Create story shapes
			const activityStories = stories.filter(
				(story) => story.data.activityId === activityId,
			);
			const actionsHeight = Math.ceil(activityActions.length / 2) * 80;

			activityStories.forEach((story, storyIndex) => {
				const storyY = 380 + actionsHeight + 40 + storyIndex * 120;
				const storyId = story.slug || story.id;
				const priorityColors = {
					must: "red" as const,
					should: "yellow" as const,
					could: "blue" as const,
					wont: "grey" as const,
				};

				shapes.push({
					id: createShapeId(`story-${storyId}`),
					type: "geo" as const,
					x,
					y: storyY,
					props: {
						w: 280,
						h: 100,
						geo: "rectangle" as const,
						color: priorityColors[story.data.priority],
						fill: "semi" as const,
						text: `${story.data.title}\n\nAs a ${story.data.personaId}\nI want ${story.data.iWant}\nSo that ${story.data.soThat}`,
						font: "sans" as const,
						size: "s" as const,
						align: "start" as const,
						verticalAlign: "start" as const,
					},
				});
			});
		});

		// Create feature shapes
		features.forEach((feature, index) => {
			const x = 100 + sortedActivities.length * 360 + 100;
			const y = 150 + index * 180;
			const featureId = feature.slug || feature.id;
			const priorityColors = {
				must: "red" as const,
				should: "yellow" as const,
				could: "blue" as const,
				wont: "grey" as const,
			};

			shapes.push({
				id: createShapeId(`feature-${featureId}`),
				type: "geo" as const,
				x,
				y,
				props: {
					w: 320,
					h: 160,
					geo: "rectangle" as const,
					color: priorityColors[feature.data.priority],
					fill: "solid" as const,
					text: `FEATURE: ${feature.data.title}\n\n${feature.data.description}\n\nEnhancement: ${feature.data.enhancement}`,
					font: "sans" as const,
					size: "s" as const,
					align: "start" as const,
					verticalAlign: "start" as const,
				},
			});
		});

		// Create arrows from stories to features
		stories.forEach((story) => {
			if (story.data.featureId) {
				const storyId = story.slug || story.id;
				const featureId = story.data.featureId;
				const feature = features.find(f => (f.slug || f.id) === featureId);
				
				if (feature) {
					const activityId = story.data.activityId;
					const activityIndex = sortedActivities.findIndex(a => (a.slug || a.id) === activityId);
					
					if (activityIndex !== -1) {
						const storyX = 100 + activityIndex * 360;
						const featureX = 100 + sortedActivities.length * 360 + 100;
						const featureIndex = features.findIndex(f => (f.slug || f.id) === featureId);
						const featureY = 150 + featureIndex * 180;
						
						// Find the story shape to get its Y position
						const storyShape = shapes.find(s => s.id === createShapeId(`story-${storyId}`));
						if (storyShape) {
							shapes.push({
								id: createShapeId(`arrow-story-${storyId}-feature-${featureId}`),
								type: "arrow" as const,
								x: storyX + 280,
								y: storyShape.y + 50,
								props: {
									start: {
										x: 0,
										y: 0,
									},
									end: {
										x: featureX - (storyX + 280),
										y: featureY + 80 - (storyShape.y + 50),
									},
									color: "green" as const,
									dash: "solid" as const,
									size: "m" as const,
									arrowheadEnd: "arrow" as const,
								},
							});
						}
					}
				}
			}
		});

		if (shapes.length > 0) {
			console.log(`Creating ${shapes.length} shapes`);
			editor.createShapes(shapes);
			// Center the view on the content
			editor.zoomToFit();
			editor.centerOnPoint({ x: 600, y: 400 });
		}
	}, [editor, sortedActivities, personas, stories, actions, features]);

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
					const personaId = prompt("As a (persona):") || "learner";
					const iWant = prompt("I want to:") || "";
					const soThat = prompt("So that:") || "";

					// Check if we're in development mode
					if (window.location.hostname === "localhost") {
						try {
							const activityId = clickedActivity.slug || clickedActivity.id;
							const response = await fetch("/api/stories", {
								method: "POST",
								headers: {
									"Content-Type": "application/json",
								},
								body: JSON.stringify({
									title,
									description,
									personaId,
									iWant,
									soThat,
									acceptanceCriteria: [],
									priority: "should",
									activityId: activityId,
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
		<div className="w-full h-full bg-[#0a0a0a] relative">
			{/* Floating Help */}
			<div className="absolute top-4 left-4 z-10 bg-[#1a1a1d] border border-[#2a2a2d] rounded-lg p-3 max-w-sm">
				<div className="text-xs text-gray-400 space-y-1">
					<div>
						<kbd className="bg-[#2a2a2d] px-1.5 py-0.5 rounded text-gray-300">
							Shift + Click
						</kbd>{" "}
						Create story
					</div>
					<div>
						<kbd className="bg-[#2a2a2d] px-1.5 py-0.5 rounded text-gray-300">
							Double-click
						</kbd>{" "}
						Edit item
					</div>
					<div>
						<kbd className="bg-[#2a2a2d] px-1.5 py-0.5 rounded text-gray-300">
							Drag
						</kbd>{" "}
						Link story to feature
					</div>
				</div>
			</div>

			{/* Priority Legend */}
			<div className="absolute bottom-4 left-4 z-10 bg-[#1a1a1d] border border-[#2a2a2d] rounded-lg p-3">
				<div className="flex gap-3 text-xs">
					<div className="flex items-center gap-1.5">
						<div className="w-3 h-3 bg-red-600 rounded" />
						<span className="text-gray-300">Must</span>
					</div>
					<div className="flex items-center gap-1.5">
						<div className="w-3 h-3 bg-yellow-600 rounded" />
						<span className="text-gray-300">Should</span>
					</div>
					<div className="flex items-center gap-1.5">
						<div className="w-3 h-3 bg-blue-600 rounded" />
						<span className="text-gray-300">Could</span>
					</div>
					<div className="flex items-center gap-1.5">
						<div className="w-3 h-3 bg-gray-600 rounded" />
						<span className="text-gray-300">Won't</span>
					</div>
				</div>
			</div>

			{/* Tldraw Canvas */}
			<Tldraw
				shareZone={<div />}
				forceDarkMode={true}
				className="dark"
				onMount={(editor) => {
					console.log("Tldraw mounted, setting editor");
					setEditor(editor);
				}}
			/>
		</div>
	);
}
