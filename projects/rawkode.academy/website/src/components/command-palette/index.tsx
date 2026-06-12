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
	type ColorSchemePreference,
	getColorSchemePreference,
	setColorScheme,
} from "@/lib/theme";
import "./styles.css";

interface NavigationItem {
	id: string;
	title: string;
	description?: string | undefined;
	href?: string | undefined;
	category: string;
	keywords?: string[] | undefined;
	action?: (() => boolean | void) | undefined;
	preference?: ColorSchemePreference | undefined;
}

type CommandPage = "root" | "appearance";

interface UnifiedSearchResult {
	id: string;
	title: string;
	description?: string;
	href: string;
	type: string;
	date?: string;
	keywords?: string[];
}

// Map unified search result types to the palette's category strings
// (see getCategoryIcon in icons.tsx for categories with dedicated icons).
const SEARCH_TYPE_CATEGORIES: Record<string, string> = {
	video: "Videos",
	article: "Articles",
	news: "News",
	course: "Learning",
	"learning-path": "Learning",
	show: "Shows",
	technology: "Technology",
};

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
	const [searchItems, setSearchItems] = useState<NavigationItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isSearchingContent, setIsSearchingContent] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const [currentPreference, setCurrentPreference] =
		useState<ColorSchemePreference>("system");
	const [pages, setPages] = useState<CommandPage[]>(["root"]);
	const [hasLoadedNavigation, setHasLoadedNavigation] = useState(false);
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

	const appearanceItems = useMemo<NavigationItem[]>(() => {
		const options: ReadonlyArray<{
			preference: ColorSchemePreference;
			title: string;
			description: string;
			keywords: string[];
		}> = [
			{
				preference: "light",
				title: "Light mode",
				description: "Always use the light theme",
				keywords: ["light", "day", "bright"],
			},
			{
				preference: "dark",
				title: "Dark mode",
				description: "Always use the dark theme",
				keywords: ["dark", "night", "dim"],
			},
			{
				preference: "system",
				title: "System theme",
				description: "Follow your operating system preference",
				keywords: ["system", "auto", "os", "automatic"],
			},
		];
		return options.map(({ preference, title, description, keywords }) => ({
			id: `appearance-${preference}`,
			title,
			description,
			category: "Appearance",
			keywords: ["theme", "appearance", "color", "mode", ...keywords],
			preference,
			action: () => {
				const previous = currentPreference;
				setColorScheme(preference);
				setCurrentPreference(preference);
				trackEvent("color_scheme_switched", {
					from_preference: previous,
					to_preference: preference,
					source: "command_palette",
				});
			},
		}));
	}, [currentPreference]);

	const commandItems = useMemo(
		() => [
			{
				id: "command-change-appearance",
				title: "Change appearance",
				description: "Switch between light and dark mode",
				category: "Commands",
				keywords: ["theme", "appearance", "color", "mode", "dark", "light"],
				action: () => {
					goToPage("appearance");
					return false;
				},
			},
		],
		[goToPage],
	);

	useEffect(() => {
		setCurrentPreference(getColorSchemePreference());

		const handleSchemeChange = (event: Event) => {
			const customEvent = event as CustomEvent<{
				preference: ColorSchemePreference;
			}>;
			setCurrentPreference(customEvent.detail.preference);
		};
		window.addEventListener("color-scheme-change", handleSchemeChange);

		return () => {
			if (typeof window !== "undefined") {
				window.removeEventListener("color-scheme-change", handleSchemeChange);
			}
		};
	}, []);

	useEffect(() => {
		if (!isOpen || hasLoadedNavigation) return;

		const abortController = new AbortController();

		const fetchNavigationItems = async () => {
			setIsLoading(true);

			try {
				const response = await fetch("/api/sitemap-pages.json", {
					signal: abortController.signal,
				});

				if (!response.ok) {
					return;
				}

				const sitemapItems: NavigationItem[] = await response.json();
				setNavigationItems(
					sitemapItems.filter((item) => item.category !== "Articles"),
				);
				setHasLoadedNavigation(true);
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") {
					return;
				}
			} finally {
				if (!abortController.signal.aborted) {
					setIsLoading(false);
				}
			}
		};

		fetchNavigationItems();

		return () => {
			abortController.abort();
		};
	}, [hasLoadedNavigation, isOpen]);

	// Search all content types (videos, articles, news, courses, learning
	// paths, shows, technologies) via the unified index when the user types.
	useEffect(() => {
		if (searchTimeoutRef.current) {
			clearTimeout(searchTimeoutRef.current);
		}

		if (!isOpen || activePage !== "root") {
			setSearchItems([]);
			setIsSearchingContent(false);
			return;
		}

		if (search.length >= 2) {
			const abortController = new AbortController();

			setIsSearchingContent(true);
			searchTimeoutRef.current = setTimeout(async () => {
				try {
					const response = await fetch(
						`/api/search.json?q=${encodeURIComponent(search)}`,
						{ signal: abortController.signal },
					);
					if (response.ok) {
						const results: UnifiedSearchResult[] = await response.json();
						setSearchItems(
							results.map((result) => ({
								id: result.id,
								title: result.title,
								description: result.description,
								href: result.href,
								category: SEARCH_TYPE_CATEGORIES[result.type] ?? "Pages",
								keywords: result.keywords,
							})),
						);
					}
				} catch (error) {
					if (error instanceof DOMException && error.name === "AbortError") {
						return;
					}
				} finally {
					if (!abortController.signal.aborted) {
						setIsSearchingContent(false);
					}
				}
			}, 300); // Debounce search

			return () => {
				abortController.abort();
				if (searchTimeoutRef.current) {
					clearTimeout(searchTimeoutRef.current);
				}
			};
		} else {
			setSearchItems([]);
			setIsSearchingContent(false);
		}

		return () => {
			if (searchTimeoutRef.current) {
				clearTimeout(searchTimeoutRef.current);
			}
		};
	}, [activePage, isOpen, search]);

	useEffect(() => {
		if (!isOpen) {
			setPages(["root"]);
			setSearch("");
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

	// Drop navigation items that the unified search already returned so the
	// same page doesn't appear twice while searching.
	const searchHrefs = new Set(
		searchItems.map((item) => item.href).filter(Boolean),
	);
	const rootItems = [
		...commandItems,
		...navigationItems.filter(
			(item) => !item.href || !searchHrefs.has(item.href),
		),
		...searchItems,
	];
	const appearancePageItems = [
		{
			id: "command-back-to-root",
			title: "Back to commands",
			description: "Return to the main menu",
			category: "Commands",
			keywords: ["back", "commands", "appearance", "return"],
			action: () => {
				goBack();
				return false;
			},
		},
		...appearanceItems,
	];

	const displayedItems =
		activePage === "appearance" ? appearancePageItems : rootItems;

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
		// Command.Dialog wraps Radix Dialog: focus trap, focus restoration
		// to the trigger, Escape handling, scroll lock, and dialog ARIA all
		// come from the library rather than hand-rolled listeners.
		<Command.Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			label="Search and commands"
			overlayClassName="command-palette-overlay"
			contentClassName="command-palette-container"
			className="command-palette"
			filter={customFilter}
		>
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
						aria-label="Search pages and commands"
						placeholder={
							activePage === "appearance"
								? "Search appearance..."
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
					isSearchingContent &&
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
						!isSearchingContent &&
						(activePage === "appearance"
							? `No appearance options match "${search}"`
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
								const isActiveScheme = item.preference === currentPreference;
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
												{isActiveScheme && (
													<span className="ml-2 text-xs text-primary">
														(active)
													</span>
												)}
											</div>
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
		</Command.Dialog>
	);
}
