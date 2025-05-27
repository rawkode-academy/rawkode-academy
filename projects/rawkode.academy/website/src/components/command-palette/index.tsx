import { useState, useEffect, useRef } from "react";
import { Command } from "cmdk";
import { getCategoryIcon, GitHubIcon, GitLabIcon } from "./icons";
import "./styles.css";

interface NavigationItem {
	id: string;
	title: string;
	description?: string;
	href: string;
	category: string;
	keywords?: string[];
}

// External links that aren't in the sitemap
const externalNavigationItems: NavigationItem[] = [
	{
		id: "github",
		title: "GitHub",
		href: "https://github.com/rawkode",
		category: "External",
		description: "Visit our GitHub",
	},
	{
		id: "gitlab-issues",
		title: "Report Issue",
		href: "https://gitlab.com/rawkode/rawkode-academy/-/issues",
		category: "External",
		description: "Report a bug or request a feature",
	},
	{
		id: "gitlab-repo",
		title: "Source Code",
		href: "https://gitlab.com/rawkode/rawkode-academy",
		category: "External",
		description: "View the source code",
	},
];

interface CommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function CommandPalette({
	isOpen,
	onClose,
}: CommandPaletteProps) {
	const [search, setSearch] = useState("");
	const [navigationItems, setNavigationItems] = useState<NavigationItem[]>(
		externalNavigationItems,
	);
	const [isLoading, setIsLoading] = useState(true);
	const inputRef = useRef<HTMLInputElement>(null);

	const customFilter = (value: string, search: string) => {
		const searchLower = search.toLowerCase();
		const valueLower = value.toLowerCase();

		// Exact match gets highest priority
		if (valueLower === searchLower) return 1;

		// Starts with search term gets high priority
		if (valueLower.startsWith(searchLower)) return 0.9;

		// Contains search term gets medium priority
		if (valueLower.includes(searchLower)) return 0.7;

		// No match
		return 0;
	};

	useEffect(() => {
		const fetchNavigationItems = async () => {
			try {
				const response = await fetch("/api/sitemap-pages.json");
				if (response.ok) {
					const sitemapItems = await response.json();
					setNavigationItems([...sitemapItems, ...externalNavigationItems]);
				}
			} catch (error) {
				console.error("Failed to fetch navigation items:", error);
				// Keep external items as fallback
			} finally {
				setIsLoading(false);
			}
		};

		fetchNavigationItems();
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		if (isOpen) {
			document.addEventListener("keydown", handleKeyDown);
			document.body.style.overflow = "hidden";
			// Focus the input after the component has rendered
			setTimeout(() => {
				inputRef.current?.focus();
			}, 0);
		}

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.body.style.overflow = "unset";
		};
	}, [isOpen, onClose]);

	const handleSelect = (href: string) => {
		if (href.startsWith("http")) {
			window.open(href, "_blank");
		} else {
			// Ensure absolute path navigation
			const absolutePath = href.startsWith("/") ? href : `/${href}`;
			window.location.assign(absolutePath);
		}
		onClose();
	};

	const getItemIcon = (item: NavigationItem) => {
		if (item.href.includes("github.com")) return GitHubIcon;
		if (item.href.includes("gitlab.com")) return GitLabIcon;
		return getCategoryIcon(item.category);
	};

	if (!isOpen) return null;

	const groupedItems = navigationItems.reduce(
		(acc, item) => {
			if (!acc[item.category]) {
				acc[item.category] = [];
			}
			acc[item.category]!.push(item);
			return acc;
		},
		{} as Record<string, NavigationItem[]>,
	);

	return (
		<div className="command-palette-overlay" onClick={onClose}>
			<div
				className="command-palette-container"
				onClick={(e) => e.stopPropagation()}
			>
				<Command className="command-palette" filter={customFilter}>
					<div className="command-palette-header">
						<div
							style={{
								position: "relative",
								width: "100%",
								display: "flex",
								alignItems: "center",
							}}
						>
							<svg
								className="command-palette-search-icon"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								style={{
									position: "absolute",
									left: "16px",
									top: "50%",
									transform: "translateY(-50%)",
									zIndex: 1,
									pointerEvents: "none",
								}}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								/>
							</svg>
							<Command.Input
								ref={inputRef}
								placeholder="Search pages..."
								value={search}
								onValueChange={setSearch}
								className="command-palette-input"
								style={{
									paddingLeft: "52px",
									paddingRight: "70px",
									width: "100%",
								}}
							/>
							<kbd
								className="command-palette-kbd"
								style={{
									position: "absolute",
									right: "16px",
									top: "50%",
									transform: "translateY(-50%)",
									zIndex: 1,
								}}
							>
								ESC
							</kbd>
						</div>
					</div>

					<Command.List className="command-palette-list">
						<Command.Empty className="command-palette-empty">
							{isLoading ? "Loading..." : `No results found for "${search}"`}
						</Command.Empty>

						{Object.entries(groupedItems).map(([category, items]) => {
							const CategoryIcon = getCategoryIcon(category);
							return (
								<Command.Group
									key={category}
									heading={
										<div className="flex items-center gap-2">
											<CategoryIcon className="command-palette-category-icon" />
											{category}
										</div>
									}
									className="command-palette-group"
								>
									{items.map((item) => {
										const ItemIcon = getItemIcon(item);
										return (
											<Command.Item
												key={item.id}
												value={`${item.title} ${item.description || ""} ${(item.keywords || []).join(" ")}`}
												onSelect={() => handleSelect(item.href)}
												className="command-palette-item"
											>
												<ItemIcon className="command-palette-item-icon" />
												<div className="command-palette-item-content">
													<div className="command-palette-item-title">
														{item.title}
													</div>
													{item.description && (
														<div className="command-palette-item-description">
															{item.description}
														</div>
													)}
												</div>
												{item.href.startsWith("http") && (
													<svg
														className="command-palette-external-icon"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
														/>
													</svg>
												)}
											</Command.Item>
										);
									})}
								</Command.Group>
							);
						})}
					</Command.List>
				</Command>
			</div>
		</div>
	);
}
