export const getValueAsDate = async (keyValueStore: Deno.Kv, key: string): Promise<Date> => {
	const dateString = await keyValueStore.get<string>([key], {
		consistency: "strong",
	});

	if (!dateString.value) {
		return new Date(Date.now() - 6 * 60 * 60 * 1000);
	}

	return new Date(dateString.value);
}

export const storeDate = async (keyValueStore: Deno.Kv, key: string, date: Date): Promise<void> => {
	await keyValueStore.set([key], date.toISOString());
}
