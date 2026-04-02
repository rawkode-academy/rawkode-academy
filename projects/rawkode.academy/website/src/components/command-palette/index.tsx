import { Command } from "cmdk";
import {
	type ReactElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { css } from "../../../styled-system/css";
import { SkeletonList } from "@/components/common/SkeletonList";
import { getCategoryIcon, GitHubIcon } from "./icons";
import "./styles.css";
import {
	setTheme,
	getTheme,
	getThemeDisplayName,
	ALL_THEMES,
	type Theme,
} from "@/lib/theme";

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

const overlayStyle = css({
	position: "fixed",
	top: "0",
	left: "0",
	right: "0",
	bottom: "0",
	bg: "rgba(17, 24, 39, 0.8)",
	backdropFilter: "blur(8px)",
	zIndex: "9999",
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "center",
	pt: "15vh",
	px: "4",
	animation: "fadeIn 0.15s ease-out",
	_dark: {
		bg: "rgba(0, 0, 0, 0.8)",
	},
});

const containerStyle = css({
	w: "full",
	maxW: "480px",
	mx: "auto",
	p: "0",
	boxSizing: "border-box",
	animation: "slideIn 0.15s ease-out",
	lg: {
		maxW: "600px",
	},
});

const paletteStyle = css({
	bg: "white",
	rounded: "3xl",
	shadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(229, 231, 235, 1), 0 8px 32px -8px rgba(95, 94, 215, 0.3)",
	borderWidth: "1px",
	borderColor: "rgba(229, 231, 235, 1)",
	overflow: "hidden",
	backdropFilter: "blur(20px)",
	_dark: {
		bg: "#0f172a",
		borderColor: "#334155",
		shadow: "0 32px 64px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(95, 94, 215, 0.2), 0 8px 32px -8px rgba(95, 94, 215, 0.3)",
	},
});

const headerStyle = css({
	display: "flex",
	alignItems: "center",
	p: "5",
	borderBottomWidth: "1px",
	borderColor: "rgba(229, 231, 235, 1)",
	bg: "rgba(249, 250, 251, 0.8)",
	backdropFilter: "blur(10px)",
	_dark: {
		bg: "rgba(15, 23, 42, 0.9)",
		borderColor: "#334155",
	},
});

const searchIconStyle = css({
	w: "5",
	h: "5",
	color: "#6b7280",
	mr: "3",
	flexShrink: 0,
	_dark: {
		color: "#94a3b8",
	},
});

const inputStyle = css({
	flex: "1",
	border: "none",
	outline: "none",
	bg: "transparent",
	fontSize: "16px",
	fontWeight: "medium",
	color: "#111827",
	textAlign: "left",
	_placeholder: {
		color: "#9ca3af",
	},
	_dark: {
		color: "#f1f5f9",
		_placeholder: {
			color: "#64748b",
		},
	},
});

const kbdStyle = css({
	bg: "#f3f4f6",
	color: "#4b5563",
	py: "1.5",
	px: "2.5",
	rounded: "lg",
	fontSize: "12px",
	fontWeight: "semibold",
	borderWidth: "1px",
	borderColor: "#d1d5db",
	shadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
	_dark: {
		bg: "#1e293b",
		color: "#94a3b8",
		borderColor: "#475569",
		shadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
	},
});

const listStyle = css({
	maxH: "480px",
	overflowY: "auto",
	pt: "2",
	pb: "4",
	_scrollbar: {
		width: "6px",
	},
	_scrollbarTrack: {
		bg: "transparent",
	},
	_scrollbarThumb: {
		bg: "#d1d5db",
		rounded: "sm",
	},
	_dark: {
		_scrollbarThumb: {
			bg: "rgba(95, 94, 215, 0.4)",
		},
	},
});

const emptyStyle = css({
	py: "8",
	px: "4",
	textAlign: "center",
	color: "#6b7280",
	fontSize: "14px",
	_dark: {
		color: "#94a3b8",
	},
});

const groupStyle = css({
	mb: "2",
});

const groupHeadingStyle = css({
	display: "flex",
	alignItems: "center",
	gap: "2",
});

const categoryIconStyle = css({
	w: "4",
	h: "4",
	opacity: "0.8",
	color: "#6b7280",
	_dark: {
		color: "#64748b",
	},
});

const itemStyle = css({
	display: "flex",
	alignItems: "center",
	py: "3",
	px: "4",
	cursor: "pointer",
	border: "none",
	bg: "none",
	w: "calc(100% - 16px)",
	textAlign: "left",
	transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
	rounded: "xl",
	my: "0.5",
	mx: "2",
	_hover: {
		bg: "#f9fafb",
		transform: "translateY(-0.5px)",
	},
	_dark: {
		_hover: {
			bg: "rgba(30, 41, 59, 0.5)",
		},
	},
});

const itemIconStyle = css({
	w: "5",
	h: "5",
	mr: "4",
	flexShrink: 0,
	opacity: "0.8",
	color: "#6b7280",
	_dark: {
		color: "#94a3b8",
	},
});

const itemContentStyle = css({
	flex: "1",
	minW: "0",
});

const itemTitleStyle = css({
	fontSize: "15px",
	fontWeight: "semibold",
	color: "#111827",
	mb: "1",
	lineHeight: "1.4",
	_dark: {
		color: "#f1f5f9",
	},
});

const activeThemeBadge = css({
	ml: "2",
	fontSize: "xs",
	color: "primary",
});

const loadingWrapperStyle = css({
	p: "4",
});

const externalIconStyle = css({
	w: "4",
	h: "4",
	color: "#9ca3af",
	ml: "3",
	flexShrink: 0,
	opacity: "0.8",
	_dark: {
		color: "#00ceff",
		opacity: "0.6",
	},
});

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
		<div className={overlayStyle} onClick={onClose}>
			<div
				className={containerStyle}
				onClick={(e) => e.stopPropagation()}
			>
				<Command className={paletteStyle} filter={customFilter}>
					<div className={headerStyle}>
						<div
							style={{
								position: "relative",
								width: "100%",
								display: "flex",
								alignItems: "center",
							}}
						>
							<svg
								className={searchIconStyle}
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
								className={inputStyle}
								style={{
									paddingLeft: "52px",
									paddingRight: "70px",
									width: "100%",
								}}
							/>
							<kbd
								className={kbdStyle}
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

					<Command.List className={listStyle}>
						{isLoading && (
							<div className={loadingWrapperStyle}>
								<SkeletonList
									items={5}
									showIcon={true}
									iconSize="1.5rem"
									showSubtitle={false}
								/>
							</div>
						)}

						{isRootPage &&
							isSearchingArticles &&
							!isLoading &&
							search.length >= 2 && (
								<div className={loadingWrapperStyle}>
									<SkeletonList
										items={3}
										showIcon={true}
										iconSize="1.5rem"
										showSubtitle={true}
									/>
								</div>
							)}

						<Command.Empty className={emptyStyle}>
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
										<div className={groupHeadingStyle}>
											<CategoryIcon className={categoryIconStyle} />
											{category}
										</div>
									}
									className={groupStyle}
								>
									{items.map((item) => {
										const ItemIcon = getItemIcon(item);
										const isCurrentTheme = item.theme === currentTheme;
										return (
											<Command.Item
												key={item.id}
												value={`${item.title} ${item.description || ""} ${item.keywords?.join(" ") || ""}`}
												onSelect={() => handleSelect(item)}
												className={itemStyle}
											>
												<ItemIcon className={itemIconStyle} />
												<div className={itemContentStyle}>
													<div className={itemTitleStyle}>
														{item.title}
														{isCurrentTheme && (
															<span className={activeThemeBadge}>
																(active)
															</span>
														)}
													</div>
												</div>
												{item.href && item.href.startsWith("http") && (
													<svg
														className={externalIconStyle}
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
