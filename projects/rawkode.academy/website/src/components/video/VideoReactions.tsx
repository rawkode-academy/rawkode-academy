import { actions } from "astro:actions";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useState, useEffect, useRef } from "react";

interface Reaction {
	emoji: string;
	count: number;
	label?: string;
}

interface VideoReactionsProps {
	videoId: string;
	videoTitle?: string;
	videoSlug?: string;
}

const DEFAULT_BUTTON_EMOJIS = ["👍", "❤️", "🚀", "🔥"];

export default function VideoReactions({ videoId }: VideoReactionsProps) {
	const [reactions, setReactions] = useState<Reaction[]>([]);
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [loading, setLoading] = useState(false);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);
	const [showShareOptions, setShowShareOptions] = useState(false);
	const [showBanner, setShowBanner] = useState(false);
	const [bannerMessage, setBannerMessage] = useState("");
	const [, setUserReactions] = useState<Set<string>>(new Set());
	const [pendingReactions, setPendingReactions] = useState<Map<string, number>>(
		new Map(),
	);
	const pickerRef = useRef<HTMLDivElement>(null);
	const bannerTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
	const fetchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

	// Check authentication status
	useEffect(() => {
		checkAuth();
		fetchReactions();
	}, []);

	// Handle click outside emoji picker
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				pickerRef.current &&
				!pickerRef.current.contains(event.target as Node)
			) {
				setShowEmojiPicker(false);
			}
		}

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	// Cleanup timeouts on unmount
	useEffect(() => {
		return () => {
			if (bannerTimeoutRef.current) {
				clearTimeout(bannerTimeoutRef.current);
			}
			if (fetchTimeoutRef.current) {
				clearTimeout(fetchTimeoutRef.current);
			}
		};
	}, []);

	const checkAuth = async () => {
		try {
			const response = await fetch("/api/auth/me");
			setIsAuthenticated(response.ok);
		} catch (error) {
			console.error("Failed to check auth status:", error);
		}
	};

	const fetchReactions = async () => {
		try {
			const query = `
        query GetVideoReactions($videoId: String!) {
          _entities(representations: [{ __typename: "Video", id: $videoId }]) {
            ... on Video {
              id
              emojiReactions {
                emoji
                count
              }
            }
          }
        }
      `;

			const response = await fetch("https://api.rawkode.academy/graphql", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					query,
					variables: { videoId },
				}),
			});

			if (!response.ok) {
				throw new Error(`GraphQL request failed: ${response.status}`);
			}

			const data = (await response.json()) as {
				data?: {
					_entities?: Array<{
						emojiReactions?: Array<{ emoji: string; count: number }>;
					}>;
				};
			};
			const videoEntity = data.data?._entities?.[0];

			if (videoEntity?.emojiReactions) {
				const reactionMap = new Map<string, Reaction>();

				// Initialize with default emojis
				for (const emoji of DEFAULT_BUTTON_EMOJIS) {
					reactionMap.set(emoji, {
						emoji,
						count: 0,
						label: getEmojiLabel(emoji),
					});
				}

				// Update counts from API
				interface EmojiReaction {
					emoji: string;
					count: number;
				}
				for (const reaction of videoEntity.emojiReactions as EmojiReaction[]) {
					const existing = reactionMap.get(reaction.emoji);
					if (existing) {
						existing.count = reaction.count;
					} else {
						reactionMap.set(reaction.emoji, {
							emoji: reaction.emoji,
							count: reaction.count,
							label: getEmojiLabel(reaction.emoji),
						});
					}
				}

				setReactions(Array.from(reactionMap.values()));
			}
		} catch (error) {
			console.error("Failed to fetch reactions:", error);
			// Set default reactions with 0 counts
			setReactions(
				DEFAULT_BUTTON_EMOJIS.map((emoji) => ({
					emoji,
					count: 0,
					label: getEmojiLabel(emoji),
				})),
			);
		}
	};

	const getEmojiLabel = (emoji: string): string => {
		const labels: Record<string, string> = {
			"👍": "Like this video",
			"🚀": "Rocket reaction",
			"💡": "Insightful reaction",
			"❤️": "Love this video",
			"🔥": "Fire reaction",
			"👏": "Applause reaction",
		};
		return labels[emoji] || `React with ${emoji}`;
	};

	const handleReaction = async (emoji: string) => {
		console.log("handleReaction called with:", emoji);
		console.log("isAuthenticated:", isAuthenticated);

		if (!isAuthenticated) {
			window.location.href = "/api/auth/sign-in";
			return;
		}

		if (loading) return;
		setLoading(true);

		// Optimistically update the count immediately
		setPendingReactions((prev) => {
			const newMap = new Map(prev);
			newMap.set(emoji, (newMap.get(emoji) || 0) + 1);
			return newMap;
		});

		// Update reactions display with pending count
		setReactions((prev) =>
			prev.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1 } : r)),
		);

		try {
			const { error } = await actions.addReaction({
				contentId: videoId,
				emoji: emoji,
			});

			if (error) {
				console.error("Failed to add reaction:", error);
				showBannerMessage("Failed to add reaction. Please try again.");

				// Revert optimistic update on error
				setPendingReactions((prev) => {
					const newMap = new Map(prev);
					const current = newMap.get(emoji) || 0;
					if (current > 1) {
						newMap.set(emoji, current - 1);
					} else {
						newMap.delete(emoji);
					}
					return newMap;
				});

				setReactions((prev) =>
					prev.map((r) =>
						r.emoji === emoji ? { ...r, count: Math.max(0, r.count - 1) } : r,
					),
				);
			} else {
				setUserReactions((prev) => new Set(prev).add(emoji));

				// Clear any existing fetch timeout
				if (fetchTimeoutRef.current) {
					clearTimeout(fetchTimeoutRef.current);
				}

				// Refresh reactions from server after a short delay
				fetchTimeoutRef.current = setTimeout(() => {
					fetchReactions();
					// Clear pending reactions after fetch
					setPendingReactions(new Map());
				}, 1500);
			}
		} catch (error) {
			console.error("Failed to add reaction:", error);
			showBannerMessage("Failed to add reaction. Please try again.");

			// Revert optimistic update on error
			setPendingReactions((prev) => {
				const newMap = new Map(prev);
				const current = newMap.get(emoji) || 0;
				if (current > 1) {
					newMap.set(emoji, current - 1);
				} else {
					newMap.delete(emoji);
				}
				return newMap;
			});

			setReactions((prev) =>
				prev.map((r) =>
					r.emoji === emoji ? { ...r, count: Math.max(0, r.count - 1) } : r,
				),
			);
		} finally {
			setLoading(false);
		}
	};

	const showBannerMessage = (message: string) => {
		if (bannerTimeoutRef.current) {
			clearTimeout(bannerTimeoutRef.current);
		}

		setBannerMessage(message);
		setShowBanner(true);

		bannerTimeoutRef.current = setTimeout(() => {
			setShowBanner(false);
		}, 3000);
	};

	const handleEmojiSelect = (emoji: string) => {
		handleReaction(emoji);
		setShowEmojiPicker(false);
	};

	const handleSave = () => {
		showBannerMessage("This feature is coming in a few days!");
	};

	const handleShare = () => {
		setShowShareOptions(!showShareOptions);
	};

	// Get top 4 reactions for buttons
	const topReactions = DEFAULT_BUTTON_EMOJIS.map((emoji) => {
		const existing = reactions.find((r) => r.emoji === emoji);
		return existing || { emoji, count: 0, label: getEmojiLabel(emoji) };
	});

	// Get other reactions that have been used
	// const otherReactions = reactions.filter(
	// 	(r) => !DEFAULT_BUTTON_EMOJIS.includes(r.emoji) && r.count > 0,
	// );

	return (
		<div
			className={`bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-800 ${
				showShareOptions ? "border-blue-500 dark:border-blue-400" : ""
			}`}
		>
			<div className="flex flex-wrap items-center justify-between gap-4">
				{/* Reaction Buttons */}
				<div className="flex items-center gap-1 sm:gap-2">
					{topReactions.map((reaction) => {
						const hasPending = pendingReactions.has(reaction.emoji);
						return (
							<button
								type="button"
								key={reaction.emoji}
								aria-label={`${reaction.label} (${reaction.count} ${
									reaction.count === 1 ? "reaction" : "reactions"
								})`}
								className={`group flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ${
									hasPending
										? "ring-2 ring-blue-500 ring-opacity-50 animate-pulse"
										: ""
								}`}
								onClick={() => handleReaction(reaction.emoji)}
								disabled={loading && hasPending}
							>
								<span
									aria-hidden="true"
									className="text-xl sm:text-2xl group-hover:scale-110 transition-transform"
								>
									{reaction.emoji}
								</span>
								<span
									className={`text-xs sm:text-sm font-medium ${
										hasPending
											? "text-blue-600 dark:text-blue-400"
											: "text-gray-700 dark:text-gray-300"
									}`}
								>
									{reaction.count}
								</span>
							</button>
						);
					})}

					{/* Emoji Picker Button */}
					<div className="relative" ref={pickerRef}>
						<button
							type="button"
							aria-label="Add custom emoji reaction"
							className="group flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-2 border-dashed border-gray-300 dark:border-gray-600"
							onClick={() => setShowEmojiPicker(!showEmojiPicker)}
						>
							<span aria-hidden="true" className="text-xl sm:text-2xl">
								➕
							</span>
							<span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
								Add
							</span>
						</button>

						{/* Emoji Picker Dropdown */}
						{showEmojiPicker && (
							<div className="absolute z-50 mt-2 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 right-0">
								<Picker
									data={data}
									onEmojiSelect={(emoji: { native: string }) =>
										handleEmojiSelect(emoji.native)
									}
									theme="auto"
									previewPosition="none"
									skinTonePosition="none"
									perLine={8}
									maxFrequentRows={2}
									emojiSize={24}
									emojiButtonSize={36}
								/>
							</div>
						)}
					</div>
				</div>

				{/* Share and Save Options */}
				<div className="flex items-center gap-2">
					<button
						type="button"
						aria-label="Save this video for later"
						className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						onClick={handleSave}
					>
						<svg
							aria-hidden="true"
							className="w-4 sm:w-5 h-4 sm:h-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
							/>
						</svg>
						<span className="text-xs sm:text-sm font-medium">Save</span>
					</button>

					<button
						type="button"
						aria-label="Share this video"
						className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
							showShareOptions ? "bg-blue-100 dark:bg-blue-900" : ""
						}`}
						onClick={handleShare}
					>
						<svg
							aria-hidden="true"
							className="w-4 sm:w-5 h-4 sm:h-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
							/>
						</svg>
						<span className="text-xs sm:text-sm font-medium">Share</span>
					</button>
				</div>
			</div>

			{/* Share Options - TODO: Add ShareButton component */}
			{showShareOptions && (
				<div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
					<p className="text-sm text-gray-600 dark:text-gray-400">
						Share functionality coming soon...
					</p>
				</div>
			)}

			{/* Banner Messages */}
			{showBanner && (
				<div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
					<div className="flex items-center gap-3">
						<svg
							aria-hidden="true"
							className="w-5 h-5 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span className="text-sm font-medium">{bannerMessage}</span>
					</div>
				</div>
			)}
		</div>
	);
}
