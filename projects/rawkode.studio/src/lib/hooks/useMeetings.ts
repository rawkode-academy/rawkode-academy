import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Meeting } from "@/lib/realtime-kit/client";

interface MeetingsResponse {
	data: Meeting[];
	paging: {
		total_count: number;
		start_offset: number;
		end_offset: number;
	};
}

interface UseMeetingsParams {
	page?: number;
	perPage?: number;
	search?: string;
}

export function useMeetings({
	page = 1,
	perPage = 10,
	search,
}: UseMeetingsParams = {}) {
	return useQuery<MeetingsResponse>({
		queryKey: ["meetings", { page, perPage, search }],
		queryFn: async () => {
			const params = new URLSearchParams({
				page: page.toString(),
				per_page: perPage.toString(),
			});

			if (search) {
				params.append("search", search);
			}

			const response = await fetch(`/api/meetings?${params}`, {
				credentials: "include",
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch meetings: ${response.statusText}`);
			}

			return response.json();
		},
		placeholderData: keepPreviousData,
	});
}
