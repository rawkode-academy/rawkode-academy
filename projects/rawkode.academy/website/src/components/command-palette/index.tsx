import { Command } from "cmdk";
import {
	type ReactElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { actions } from "astro:actions";
import { SkeletonList } from "@/components/common/SkeletonList";
import { getCategoryIcon, GitHubIcon } from "./icons";
import {
	setTheme,
	getTheme,
	getThemeDisplayName,
	ALL_THEMES,
	type Theme,
} from "@/lib/theme";
import "./styles.css";

interface NavigationItem {
	id: string;
	title: string;
	description?: string;
	href?: string;
	category: string;
	keywords?: string[];
	action?: () => boolean | void;
	theme?: Theme;
}

type CommandPage = "root" | "themes";

interface CommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
}

// Track analytics events client-side
const trackEvent = (event: string, properties?: Record<string, unknown>) => {
	try {
		window.posthog?.capture(event, properties);
	} catch {
		// Ignore tracking errors
	}
};

export default function CommandPalette({
	isOpen,
	onClose,
}: CommandPaletteProps): ReactElement | null {
	const [search, setSearch] = useState("");
	const [navigationItems, setNavigationItems] = useState<NavigationItem[]>([]);
	const [articleItems, setArticleItems] = useState<NavigationItem[]>([]);
	const [aiResponse, setAiResponse] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSearchingArticles, setIsSearchingArticles] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const [currentTheme, setCurrentTheme] = useState<Theme>("rawkode-green");
	const [pages, setPages] = useState<CommandPage[]>(["root"]);
	const hasTrackedOpen = useRef(false);

	const activePage = pages[pages.length - 1];
	const isRootPage = activePage === "root";

	const goToPage = useCallback((page: CommandPage) => {
		setPages((prev) => [...prev, page]);
		setSearch("");
	}, []);

	const goBack = useCallback(() => {
		setPages((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
		setSearch("");
	}, []);

	const customFilter = (value: string, search: string): number => {
		if (!search.trim()) return 1; // Show all items when search is empty

		const searchTerms = search.toLowerCase().split(/\s+/).filter(Boolean);
		const valueLower = value.toLowerCase();

		// Check if all search terms are found in the value
		return searchTerms.every((term) => valueLower.includes(term)) ? 1 : 0;
	};

	const themeItems = useMemo(
		() =>
			ALL_THEMES.map((theme) => ({
				id: `theme-${theme}`,
				title: getThemeDisplayName(theme),
				description: `Switch to ${getThemeDisplayName(theme)} theme`,
				category: "Themes",
				keywords: ["theme", "color", "appearance", theme],
				theme,
				action: () => {
					const previousTheme = currentTheme;
					setTheme(theme);
					setCurrentTheme(theme);
					// Track theme switch
					trackEvent("theme_switched", {
						from_theme: previousTheme,
						to_theme: theme,
						source: "command_palette",
					});
				},
			})),
		[currentTheme],
	);

	const commandItems = useMemo(
		() => [
			{
				id: "command-change-theme",
				title: "Change theme",
				description: "Choose a different color theme",
				category: "Commands",
				keywords: ["theme", "appearance", "color", "change"],
				action: () => {
					goToPage("themes");
					return false;
				},
			},
		],
		[goToPage],
	);

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

		// Get current theme
		setCurrentTheme(getTheme());

		// Listen for theme changes
		const handleThemeChange = (event: Event) => {
			const customEvent = event as CustomEvent<{ theme: Theme }>;
			setCurrentTheme(customEvent.detail.theme);
		};
		window.addEventListener("theme-change", handleThemeChange);

		return () => {
			if (typeof window !== "undefined") {
				window.removeEventListener("theme-change", handleThemeChange);
			}
		};
	}, []);

	// Search using AutoRAG when user types
	useEffect(() => {
		if (searchTimeoutRef.current) {
			clearTimeout(searchTimeoutRef.current);
		}

		if (activePage !== "root") {
			setArticleItems([]);
			setAiResponse(null);
			setIsSearchingArticles(false);
			return;
		}

		if (search.length >= 2) {
			setIsSearchingArticles(true);
			searchTimeoutRef.current = setTimeout(async () => {
				try {
					const { data, error } = await actions.search({
						query: search,
					});

					if (error) {
						console.error("Failed to search:", error);
						setArticleItems([]);
						setAiResponse(null);
						return;
					}

					// Store the AI-generated response
					setAiResponse(data?.response || null);

					// Transform AutoRAG results to NavigationItem format
					interface AutoRAGResult {
						file_id: string;
						filename: string;
						score: number;
						attributes: Record<string, string | number | boolean | null>;
						content: Array<{
							type: "text";
							text: string;
						}>;
					}

					const searchResults: NavigationItem[] =
						data?.data?.map((result: AutoRAGResult, index: number) => {
							// Extract first content block as description
							const contentPreview =
								result.content?.[0]?.text?.slice(0, 100) || "";

							return {
								id: `search-${index}-${result.file_id}`,
								title: result.filename
									.replace(/\.[^/.]+$/, "")
									.replace(/-/g, " "),
								description: contentPreview
									? `${contentPreview}...`
									: `Relevance: ${Math.round(result.score * 100)}%`,
								href: `/${result.filename.replace(/\.[^/.]+$/, "")}`,
								category: "Search Results",
								keywords: [search],
							};
						}) || [];

					setArticleItems(searchResults);
				} catch (error) {
					console.error("Failed to search:", error);
					setArticleItems([]);
					setAiResponse(null);
				} finally {
					setIsSearchingArticles(false);
				}
			}, 300); // Debounce search
		} else {
			setArticleItems([]);
			setAiResponse(null);
			setIsSearchingArticles(false);
		}

		return () => {
			if (searchTimeoutRef.current) {
				clearTimeout(searchTimeoutRef.current);
			}
		};
	}, [activePage, search]);

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

	useEffect(() => {
		if (!isOpen) {
			setPages(["root"]);
			setSearch("");
			setAiResponse(null);
			hasTrackedOpen.current = false;
		} else if (!hasTrackedOpen.current) {
			// Track command palette opened
			trackEvent("command_palette_opened", {
				trigger: "keyboard_shortcut",
			});
			hasTrackedOpen.current = true;
		}
	}, [isOpen]);

	const handleSelect = (item: NavigationItem) => {
		// Track navigation event
		trackEvent("command_palette_navigation", {
			item_id: item.id,
			item_title: item.title,
			category: item.category,
			is_external: item.href?.startsWith("http") ?? false,
			has_action: !!item.action,
			search_query: search || undefined,
		});

		if (item.action) {
			const shouldClose = item.action();
			if (shouldClose !== false) {
				onClose();
			}
			return;
		}

		if (!item.href) return;

		if (item.href.startsWith("http")) {
			window.open(item.href, "_blank");
		} else {
			// Ensure absolute path navigation
			const absolutePath = item.href.startsWith("/")
				? item.href
				: `/${item.href}`;
			window.location.assign(absolutePath);
		}
		onClose();
	};

	const getItemIcon = (item: NavigationItem) => {
		if (item.href) {
			try {
				const url = new URL(item.href, window.location.origin);
				if (
					url.hostname === "github.com" ||
					url.hostname === "www.github.com"
				) {
					return GitHubIcon;
				}
			} catch {
				// Invalid URL or relative path, fall through to default
			}
		}
		return getCategoryIcon(item.category);
	};

	if (!isOpen) return null;

	const rootItems = [...commandItems, ...navigationItems, ...articleItems];
	const themePageItems = [
		{
			id: "command-back-to-root",
			title: "Back to commands",
			description: "Return to the main menu",
			category: "Commands",
			keywords: ["back", "commands", "themes", "return"],
			action: () => {
				goBack();
				return false;
			},
		},
		...themeItems,
	];

	const displayedItems = activePage === "themes" ? themePageItems : rootItems;

	const groupedItems = displayedItems.reduce(
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
								placeholder={
									activePage === "themes"
										? "Search themes..."
										: "Search pages..."
								}
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
						{/* AI Response Summary */}
						{isRootPage && aiResponse && !isSearchingArticles && (
							<div className="command-palette-ai-response">
								<div className="command-palette-ai-header">
									<svg
										className="command-palette-ai-icon"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
										/>
									</svg>
									<span>AI Summary</span>
								</div>
								<p className="command-palette-ai-text">{aiResponse}</p>
							</div>
						)}

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

						{isRootPage &&
							isSearchingArticles &&
							!isLoading &&
							search.length >= 2 && (
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
								(activePage === "themes"
									? `No themes match "${search}"`
									: `No results found for "${search}"`)}
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
										const isCurrentTheme = item.theme === currentTheme;
										return (
											<Command.Item
												key={item.id}
												value={`${item.title} ${item.description || ""} ${item.keywords?.join(" ") || ""}`}
												onSelect={() => handleSelect(item)}
												className="command-palette-item"
											>
												<ItemIcon className="command-palette-item-icon" />
												<div className="command-palette-item-content">
													<div className="command-palette-item-title">
														{item.title}
														{isCurrentTheme && (
															<span className="ml-2 text-xs text-primary">
																(active)
															</span>
														)}
													</div>
													{item.description && (
														<div className="command-palette-item-description">
															{item.description}
														</div>
													)}
												</div>
												{item.href && item.href.startsWith("http") && (
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
