import { Command } from "cmdk";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { SkeletonList } from "@/components/common/SkeletonList";
import { GitHubIcon, getCategoryIcon } from "./icons";
import "./styles.css";

interface NavigationItem {
	id: string;
	title: string;
	description?: string;
	href: string;
	category: string;
	keywords?: string[];
}

interface CommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function CommandPalette({
	isOpen,
	onClose,
}: CommandPaletteProps): ReactElement | null {
	const [search, setSearch] = useState("");
	const [navigationItems, setNavigationItems] = useState<NavigationItem[]>([]);
	const [articleItems, setArticleItems] = useState<NavigationItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSearchingArticles, setIsSearchingArticles] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const customFilter = (value: string, search: string): number => {
		if (!search.trim()) return 1; // Show all items when search is empty

		const searchTerms = search.toLowerCase().split(/\s+/).filter(Boolean);
		const valueLower = value.toLowerCase();

		// Check if all search terms are found in the value
		return searchTerms.every((term) => valueLower.includes(term)) ? 1 : 0;
	};

	useEffect(() => {
		const fetchNavigationItems = async () => {
			try {
				const response = await fetch("/api/sitemap-pages.json");
				if (response.ok) {
					const sitemapItems: NavigationItem[] = await response.json();
					// Filter out articles initially
					const filteredItems = sitemapItems.filter(
						(item) => item.category !== "Articles",
					);
					setNavigationItems(filteredItems);
				}
			} catch (error) {
				console.error("Failed to fetch navigation items:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchNavigationItems();
	}, []);

	// Search for articles when user types
	useEffect(() => {
		if (searchTimeoutRef.current) {
			clearTimeout(searchTimeoutRef.current);
		}

		if (search.length >= 2) {
			setIsSearchingArticles(true);
			searchTimeoutRef.current = setTimeout(async () => {
				try {
					const response = await fetch(
						`/api/search-articles.json?q=${encodeURIComponent(search)}`,
					);
					if (response.ok) {
						const articles: NavigationItem[] = await response.json();
						setArticleItems(articles);
					}
				} catch (error) {
					console.error("Failed to search articles:", error);
				} finally {
					setIsSearchingArticles(false);
				}
			}, 300); // Debounce search
		} else {
			setArticleItems([]);
			setIsSearchingArticles(false);
		}

		return () => {
			if (searchTimeoutRef.current) {
				clearTimeout(searchTimeoutRef.current);
			}
		};
	}, [search]);

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
		try {
			const url = new URL(item.href, window.location.origin);
			if (url.hostname === "github.com" || url.hostname === "www.github.com") {
				return GitHubIcon;
			}
		} catch {
			// Invalid URL or relative path, fall through to default
		}
		return getCategoryIcon(item.category);
	};

	if (!isOpen) return null;

	// Combine navigation items and article items
	const allItems = [...navigationItems, ...articleItems];

	const groupedItems = allItems.reduce(
		(acc, item) => {
			if (!acc[item.category]) {
				acc[item.category] = [];
			}
			acc[item.category]?.push(item);
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
						{isLoading && (
							<div className="command-palette-loading">
								<SkeletonList
									items={5}
									showIcon={true}
									iconSize="1.5rem"
									showSubtitle={false}
									className="command-palette-skeleton"
								/>
							</div>
						)}

						{isSearchingArticles && !isLoading && search.length >= 2 && (
							<div className="command-palette-searching">
								<SkeletonList
									items={3}
									showIcon={true}
									iconSize="1.5rem"
									showSubtitle={true}
									className="command-palette-skeleton"
								/>
							</div>
						)}

						<Command.Empty className="command-palette-empty">
							{!isLoading &&
								!isSearchingArticles &&
								`No results found for "${search}"`}
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
												value={`${item.title} ${item.description || ""}`}
												onSelect={() => handleSelect(item.href)}
												className="command-palette-item"
											>
												<ItemIcon className="command-palette-item-icon" />
												<div className="command-palette-item-content">
													<div className="command-palette-item-title">
														{item.title}
													</div>
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
