import type { ReactNode } from "react";

interface Column<T> {
	key: string;
	header: string;
	render?: (item: T) => ReactNode;
}

interface TableProps<T> {
	columns: Column<T>[];
	data: T[];
	loading?: boolean;
	emptyMessage?: string;
	onRowClick?: (item: T) => void;
}

export function Table<T extends { id: string }>({
	columns,
	data,
	loading,
	emptyMessage = "No data found",
	onRowClick,
}: TableProps<T>) {
	if (loading) {
		return (
			<div className="flex items-center justify-center py-8">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
			</div>
		);
	}

	if (data.length === 0) {
		return (
			<div className="text-center py-8 text-gray-500">{emptyMessage}</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="min-w-full divide-y divide-gray-200">
				<thead className="bg-gray-50">
					<tr>
						{columns.map((column) => (
							<th
								key={column.key}
								scope="col"
								className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>
								{column.header}
							</th>
						))}
					</tr>
				</thead>
				<tbody className="bg-white divide-y divide-gray-200">
					{data.map((item) => (
						<tr
							key={item.id}
							onClick={() => onRowClick?.(item)}
							className={onRowClick ? "cursor-pointer hover:bg-gray-50" : ""}
						>
							{columns.map((column) => (
								<td
									key={`${item.id}-${column.key}`}
									className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
								>
									{column.render
										? column.render(item)
										: (item as Record<string, unknown>)[column.key]?.toString() ?? "-"}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
