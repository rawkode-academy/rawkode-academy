import { actions } from "astro:actions";
import { useQuery } from "@tanstack/react-query";

export default function LivestreamCounter() {
	const { data } = useQuery({
		queryKey: ["livestreams", "count"],
		refetchInterval: 10_000,
		queryFn: async () => {
			const { data, error } = await actions.listRooms();

			if (error) {
				throw error;
			}

			return data.length;
		},
	});

	return <>{data || 0}</>;
}
