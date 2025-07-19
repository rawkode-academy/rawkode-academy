import React, { useState, useEffect, useRef } from "react";

interface CommandItem {
	id: string;
	title: string;
	description?: string;
	icon?: React.ReactNode;
	action: () => void;
	category?: string;
	shortcut?: string;
}

interface CommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
}

const defaultCommands: CommandItem[] = [
	{
		id: "nav-story-map",
		title: "Go to Story Map",
		description: "View the interactive story map",
		category: "Navigation",
		shortcut: "⌘1",
		action: () => (window.location.href = "/story-map"),
	},
	{
		id: "nav-stories",
		title: "Go to Stories",
		description: "View all user stories",
		category: "Navigation",
		shortcut: "⌘2",
		action: () => (window.location.href = "/stories"),
	},
	{
		id: "nav-features",
		title: "Go to Features",
		description: "View all features",
		category: "Navigation",
		shortcut: "⌘3",
		action: () => (window.location.href = "/features"),
	},
	{
		id: "nav-activities",
		title: "Go to Activities",
		description: "View all activities",
		category: "Navigation",
		shortcut: "⌘4",
		action: () => (window.location.href = "/activities"),
	},
	{
		id: "nav-personas",
		title: "Go to Personas",
		description: "View all personas",
		category: "Navigation",
		shortcut: "⌘5",
		action: () => (window.location.href = "/personas"),
	},
	{
		id: "create-story",
		title: "Create New Story",
		description: "Create a new user story",
		category: "Create",
		shortcut: "⌘N S",
		action: () => {
			// TODO: Open create story modal
			console.log("Create story");
		},
	},
	{
		id: "create-feature",
		title: "Create New Feature",
		description: "Create a new feature",
		category: "Create",
		shortcut: "⌘N F",
		action: () => {
			// TODO: Open create feature modal
			console.log("Create feature");
		},
	},
	{
		id: "create-activity",
		title: "Create New Activity",
		description: "Create a new activity",
		category: "Create",
		shortcut: "⌘N A",
		action: () => {
			// TODO: Open create activity modal
			console.log("Create activity");
		},
	},
];

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
	const [search, setSearch] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

	// Filter commands based on search
	const filteredCommands = defaultCommands.filter((command) => {
		const searchLower = search.toLowerCase();
		return (
			command.title.toLowerCase().includes(searchLower) ||
			(command.description && command.description.toLowerCase().includes(searchLower)) ||
			(command.category && command.category.toLowerCase().includes(searchLower))
		);
	});

	// Group commands by category
	const groupedCommands = filteredCommands.reduce((acc, command) => {
		const category = command.category || "Other";
		if (!acc[category]) {
			acc[category] = [];
		}
		acc[category].push(command);
		return acc;
	}, {} as Record<string, CommandItem[]>);

	// Reset selection when search changes
	useEffect(() => {
		setSelectedIndex(0);
	}, [search]);

	// Focus input when opened
	useEffect(() => {
		if (isOpen && inputRef.current) {
			inputRef.current.focus();
			setSearch("");
			setSelectedIndex(0);
		}
	}, [isOpen]);

	// Scroll selected item into view
	useEffect(() => {
		const selectedItem = itemRefs.current[selectedIndex];
		if (selectedItem) {
			selectedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
		}
	}, [selectedIndex]);

	// Handle keyboard navigation
	const handleKeyDown = (e: React.KeyboardEvent) => {
		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
				break;
			case "ArrowUp":
				e.preventDefault();
				setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
				break;
			case "Enter":
				e.preventDefault();
				if (filteredCommands[selectedIndex]) {
					filteredCommands[selectedIndex].action();
					onClose();
				}
				break;
			case "Escape":
				e.preventDefault();
				onClose();
				break;
		}
	};

	if (!isOpen) return null;

	let commandIndex = 0;

	return (
		<div className="command-palette-overlay" onClick={onClose}>
			<div className="command-palette" onClick={(e) => e.stopPropagation()}>
				<div className="command-palette-header">
					<input
						ref={inputRef}
						type="text"
						className="command-palette-input"
						placeholder="Type a command or search..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						onKeyDown={handleKeyDown}
					/>
				</div>
				<div className="command-palette-content">
					{Object.entries(groupedCommands).map(([category, commands]) => (
						<div key={category} className="command-category">
							<div className="command-category-title">{category}</div>
							{commands.map((command) => {
								const index = commandIndex++;
								const isSelected = index === selectedIndex;
								return (
									<button
										key={command.id}
										ref={(el) => (itemRefs.current[index] = el)}
										className={`command-item ${isSelected ? "selected" : ""}`}
										onClick={() => {
											command.action();
											onClose();
										}}
										onMouseEnter={() => setSelectedIndex(index)}
									>
										<div className="command-item-content">
											<div className="command-item-title">{command.title}</div>
											{command.description && (
												<div className="command-item-description">{command.description}</div>
											)}
										</div>
										{command.shortcut && (
											<div className="command-item-shortcut">{command.shortcut}</div>
										)}
									</button>
								);
							})}
						</div>
					))}
					{filteredCommands.length === 0 && (
						<div className="command-empty">
							No commands found for "{search}"
						</div>
					)}
				</div>
			</div>

			<style jsx>{`
				.command-palette-overlay {
					position: fixed;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					background-color: rgba(0, 0, 0, 0.5);
					backdrop-filter: blur(4px);
					z-index: 9999;
					display: flex;
					align-items: flex-start;
					justify-content: center;
					padding-top: 15vh;
				}

				.command-palette {
					width: 90%;
					max-width: 640px;
					max-height: 60vh;
					background-color: #1a1a1d;
					border: 1px solid #2a2a2d;
					border-radius: 12px;
					overflow: hidden;
					display: flex;
					flex-direction: column;
					box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
						0 10px 10px -5px rgba(0, 0, 0, 0.04);
				}

				.command-palette-header {
					padding: 16px;
					border-bottom: 1px solid #2a2a2d;
				}

				.command-palette-input {
					width: 100%;
					background: transparent;
					border: none;
					font-size: 16px;
					color: #e1e1e3;
					outline: none;
					placeholder-color: #6b6b6d;
				}

				.command-palette-input::placeholder {
					color: #6b6b6d;
				}

				.command-palette-content {
					flex: 1;
					overflow-y: auto;
					padding: 8px;
				}

				.command-category {
					margin-bottom: 16px;
				}

				.command-category:last-child {
					margin-bottom: 0;
				}

				.command-category-title {
					font-size: 11px;
					font-weight: 600;
					text-transform: uppercase;
					letter-spacing: 0.05em;
					color: #6b6b6d;
					padding: 8px 12px 4px;
				}

				.command-item {
					width: 100%;
					padding: 12px;
					background: transparent;
					border: none;
					border-radius: 8px;
					cursor: pointer;
					display: flex;
					align-items: center;
					justify-content: space-between;
					transition: background-color 0.1s ease;
					text-align: left;
				}

				.command-item:hover {
					background-color: #2a2a2d;
				}

				.command-item.selected {
					background-color: #2a2a2d;
				}

				.command-item-content {
					flex: 1;
				}

				.command-item-title {
					font-size: 14px;
					font-weight: 500;
					color: #e1e1e3;
					margin-bottom: 2px;
				}

				.command-item-description {
					font-size: 13px;
					color: #8b8b8d;
				}

				.command-item-shortcut {
					font-size: 12px;
					color: #6b6b6d;
					background-color: #0e0e10;
					padding: 4px 8px;
					border-radius: 4px;
					margin-left: 12px;
				}

				.command-empty {
					text-align: center;
					padding: 32px;
					font-size: 14px;
					color: #6b6b6d;
				}

				/* Scrollbar styles */
				.command-palette-content::-webkit-scrollbar {
					width: 8px;
				}

				.command-palette-content::-webkit-scrollbar-track {
					background: transparent;
				}

				.command-palette-content::-webkit-scrollbar-thumb {
					background: #2a2a2d;
					border-radius: 4px;
				}

				.command-palette-content::-webkit-scrollbar-thumb:hover {
					background: #3a3a3d;
				}
			`}</style>
		</div>
	);
}