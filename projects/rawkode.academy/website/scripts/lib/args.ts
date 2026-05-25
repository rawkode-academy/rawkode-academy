export function flagValue(
	argv: string[],
	flag: string,
	fallback?: string,
): string | undefined {
	const index = argv.indexOf(flag);
	return index === -1 ? fallback : argv[index + 1] ?? fallback;
}

export function integerFlag(
	argv: string[],
	flag: string,
	fallback: number,
): number {
	return Number.parseInt(flagValue(argv, flag, String(fallback))!, 10);
}
