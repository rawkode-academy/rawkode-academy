import type { DataProvider, BaseRecord } from "@refinedev/core";

const API_URL = "/api/admin";

interface ListResponse {
	data: BaseRecord[];
	total: number;
}

// Type assertion to satisfy Refine's strict generic requirements
// The runtime implementation correctly handles data transformation
export const dataProvider = {
	getList: async ({ resource, pagination, filters, sorters }) => {
		const params = new URLSearchParams();

		if (pagination) {
			const currentPage = pagination.currentPage ?? 1;
			const pageSize = pagination.pageSize ?? 10;
			params.set("_start", String((currentPage - 1) * pageSize));
			params.set("_end", String(currentPage * pageSize));
		}

		if (sorters && sorters.length > 0) {
			params.set("_sort", sorters.map((s) => s.field).join(","));
			params.set("_order", sorters.map((s) => s.order).join(","));
		}

		if (filters) {
			for (const filter of filters) {
				if ("field" in filter && filter.value !== undefined) {
					params.set(filter.field, String(filter.value));
				}
			}
		}

		const response = await fetch(`${API_URL}/${resource}?${params}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch ${resource}: ${response.statusText}`);
		}

		const result: ListResponse = await response.json();
		return {
			data: result.data,
			total: result.total,
		};
	},

	getOne: async ({ resource, id }) => {
		const response = await fetch(`${API_URL}/${resource}/${id}`);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch ${resource}/${id}: ${response.statusText}`,
			);
		}

		const data = await response.json();
		return { data };
	},

	getMany: async ({ resource, ids }) => {
		const params = new URLSearchParams();
		params.set("ids", ids.join(","));

		const response = await fetch(`${API_URL}/${resource}?${params}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch ${resource}: ${response.statusText}`);
		}

		const result: ListResponse = await response.json();
		return { data: result.data };
	},

	create: async ({ resource, variables }) => {
		const response = await fetch(`${API_URL}/${resource}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(variables),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to create ${resource}: ${error}`);
		}

		const data = await response.json();
		return { data };
	},

	update: async ({ resource, id, variables }) => {
		const response = await fetch(`${API_URL}/${resource}/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(variables),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to update ${resource}/${id}: ${error}`);
		}

		const data = await response.json();
		return { data };
	},

	deleteOne: async ({ resource, id }) => {
		const response = await fetch(`${API_URL}/${resource}/${id}`, {
			method: "DELETE",
		});

		if (!response.ok) {
			throw new Error(
				`Failed to delete ${resource}/${id}: ${response.statusText}`,
			);
		}

		return { data: { id } };
	},

	getApiUrl: () => API_URL,
} as DataProvider;
