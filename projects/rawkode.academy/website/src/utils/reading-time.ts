/**
 * Calculate reading time for a given text
 * @param text - The text content to analyze
 * @param wordsPerMinute - Average reading speed (default: 200)
 * @returns Object with minutes and formatted text
 */
export function calculateReadingTime(
	text: string,
	wordsPerMinute: number = 200
): { minutes: number; text: string } {
	// Remove MDX/Markdown syntax
	const cleanText = text
		.replace(/```[\s\S]*?```/g, '') // Remove code blocks
		.replace(/`[^`]*`/g, '') // Remove inline code
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Replace links with text
		.replace(/[#*_~>\-]/g, '') // Remove markdown symbols
		.replace(/\n+/g, ' ') // Replace newlines with spaces
		.trim();
	
	// Count words
	const words = cleanText.split(/\s+/).filter(word => word.length > 0).length;
	
	// Calculate reading time
	const minutes = Math.ceil(words / wordsPerMinute);
	
	// Format text
	const readingText = minutes === 1 ? '1 min read' : `${minutes} min read`;
	
	return { minutes, text: readingText };
}