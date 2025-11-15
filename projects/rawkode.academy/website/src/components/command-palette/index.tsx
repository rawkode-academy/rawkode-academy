import { Command } from "cmdk";
import {
        type ReactElement,
        useCallback,
        useEffect,
        useMemo,
        useRef,
        useState,
} from "react";
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
        const [currentTheme, setCurrentTheme] = useState<Theme>("rawkode-green");
        const [pages, setPages] = useState<CommandPage[]>(["root"]);

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
                                        setTheme(theme);
                                        setCurrentTheme(theme);
                                },
                        })),
                [],
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

	// Search for articles when user types
        useEffect(() => {
                if (searchTimeoutRef.current) {
                        clearTimeout(searchTimeoutRef.current);
                }

                if (activePage !== "root") {
                        setArticleItems([]);
                        setIsSearchingArticles(false);
                        return;
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
                }
        }, [isOpen]);

        const handleSelect = (item: NavigationItem) => {
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
			const absolutePath = item.href.startsWith("/") ? item.href : `/${item.href}`;
			window.location.assign(absolutePath);
		}
		onClose();
	};

	const getItemIcon = (item: NavigationItem) => {
		if (item.href) {
			try {
				const url = new URL(item.href, window.location.origin);
				if (url.hostname === "github.com" || url.hostname === "www.github.com") {
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
