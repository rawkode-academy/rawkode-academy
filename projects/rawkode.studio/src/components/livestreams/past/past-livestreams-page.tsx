import { actions } from "astro:actions";
import type { PastLiveStream } from "@/actions"; // Import the new type
import { DataTable } from "@/components/common/DataTable";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Spinner } from "@/components/common/Spinner";
import { Button } from "@/components/shadcn/button";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { motion } from "framer-motion";
import { Link } from "react-router";

// Define columns for the DataTable
const columns: ColumnDef<PastLiveStream>[] = [
	{
		header: "Name",
		accessorKey: "name",
	},
	{
		header: "Started At",
		accessorFn: (row) =>
			row.startedAt ? new Date(row.startedAt).toLocaleString() : "N/A",
	},
	{
		header: "Finished At",
		accessorFn: (row) =>
			row.finishedAt ? new Date(row.finishedAt).toLocaleString() : "N/A",
	},
	{
		header: "Participants Joined",
		accessorKey: "participantsJoined",
		cell: ({ row }) => row.original.participantsJoined ?? 0,
	},
	{
		id: "actions",
		header: "Actions",
		cell: ({ row }) => (
			<Button asChild variant="outline" size="sm">
				<Link to={`/livestreams/past/${row.original.id}`}>View Details</Link>
			</Button>
		),
	},
];

export default function PastLivestreamsPage() {
	const { isPending, isError, data, error } = useQuery({
		queryKey: ["pastLivestreams"],
		queryFn: async () => {
			const { data, error } = await actions.listPastRooms();
			if (error) throw error;
			return data as PastLiveStream[]; // Ensure the data is typed correctly
		},
	});

	if (isPending) {
		return (
			<div className="flex items-center justify-center h-64">
				<motion.div
					initial={{ opacity: 0, scale: 0.8 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.3 }}
				>
					<Spinner className="size-10" />
				</motion.div>
			</div>
		);
	}

	if (isError) {
		return <ErrorMessage error={error} />;
	}

	return (
		<div className="space-y-6">
			<div className="mt-8">
				<DataTable columns={columns} data={data || []} />
			</div>
		</div>
	);
}
