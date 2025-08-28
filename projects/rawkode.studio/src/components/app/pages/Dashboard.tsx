import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { useId, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ShareMeetingDialog } from "@/components/app/components/ShareMeetingDialog";
import { useAuth } from "@/components/app/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useMeetings } from "@/lib/hooks/useMeetings";
import type { Meeting, PreferredRegion } from "@/lib/realtime-kit/client";

function CreateMeetingDialog() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const titleId = useId();
	const regionId = useId();
	const [open, setOpen] = useState(false);
	const [formData, setFormData] = useState({
		title: "",
		preferred_region: "" as PreferredRegion | "",
		record_on_start: false,
		live_stream_on_start: false,
		persist_chat: false,
		summarize_on_end: false,
	});

	const createMeetingMutation = useMutation({
		mutationFn: async () => {
			// Build the request body, excluding empty preferred_region
			const requestBody: CreateMeetingOptions = {
				title: formData.title || undefined,
				record_on_start: formData.record_on_start,
				live_stream_on_start: formData.live_stream_on_start,
				persist_chat: formData.persist_chat,
				summarize_on_end: formData.summarize_on_end,
			};

			// Only include preferred_region if it has a value
			if (formData.preferred_region) {
				requestBody.preferred_region = formData.preferred_region;
			}

			const response = await fetch("/api/meetings", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to create meeting");
			}

			return response.json();
		},
		onSuccess: (data) => {
			// Invalidate and refetch meetings list
			queryClient.invalidateQueries({ queryKey: ["meetings"] });

			// Reset form
			setFormData({
				title: "",
				preferred_region: "",
				record_on_start: false,
				live_stream_on_start: false,
				persist_chat: false,
				summarize_on_end: false,
			});

			// Close dialog
			setOpen(false);

			// Navigate to the new meeting
			if (data.id) {
				navigate(`/meeting/${data.id}`);
			}
		},
		onError: (error: Error) => {
			console.error(`Failed to create meeting: ${error.message}`);
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		createMeetingMutation.mutate();
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="gradient" size="default">
					<svg
						aria-hidden="true"
						className="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 4v16m8-8H4"
						/>
					</svg>
					New Meeting
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Create New Meeting</DialogTitle>
						<DialogDescription>
							Set up a new meeting with your preferred settings.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<label
								htmlFor={titleId}
								className="text-sm font-medium text-foreground"
							>
								Meeting Title
							</label>
							<input
								id={titleId}
								type="text"
								value={formData.title}
								onChange={(e) =>
									setFormData({ ...formData, title: e.target.value })
								}
								className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
								placeholder="Enter meeting title"
								autoFocus
							/>
						</div>

						<div className="grid gap-2">
							<label
								htmlFor={regionId}
								className="text-sm font-medium text-foreground"
							>
								Preferred Region
							</label>
							<select
								id={regionId}
								value={formData.preferred_region}
								onChange={(e) =>
									setFormData({
										...formData,
										preferred_region: e.target.value as PreferredRegion | "",
									})
								}
								className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
							>
								<option value="">Auto-select</option>
								<option value="us-east-1">US East</option>
								<option value="eu-central-1">EU Central</option>
								<option value="ap-south-1">Asia Pacific South</option>
								<option value="ap-southeast-1">Asia Pacific Southeast</option>
							</select>
						</div>

						<div className="space-y-3">
							<div className="text-sm font-medium text-foreground">
								Meeting Options
							</div>

							{/* Show warning if user tries to enable both */}
							{(formData.record_on_start || formData.live_stream_on_start) && (
								<div className="text-xs text-yellow-800 bg-yellow-50 dark:text-yellow-200 dark:bg-yellow-950/50 p-2 rounded">
									Note: Recording and livestreaming cannot be enabled
									simultaneously at meeting start
								</div>
							)}

							<div className="space-y-2">
								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={formData.record_on_start}
										onChange={(e) =>
											setFormData({
												...formData,
												record_on_start: e.target.checked,
												// If enabling recording, disable livestream
												live_stream_on_start: e.target.checked
													? false
													: formData.live_stream_on_start,
											})
										}
										className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
									/>
									<span
										className={`text-sm ${formData.live_stream_on_start ? "text-muted-foreground line-through" : "text-muted-foreground"}`}
									>
										Start recording automatically
									</span>
								</label>

								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={formData.live_stream_on_start}
										onChange={(e) =>
											setFormData({
												...formData,
												live_stream_on_start: e.target.checked,
												// If enabling livestream, disable recording
												record_on_start: e.target.checked
													? false
													: formData.record_on_start,
											})
										}
										className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
									/>
									<span
										className={`text-sm ${formData.record_on_start ? "text-muted-foreground line-through" : "text-muted-foreground"}`}
									>
										Start livestream automatically
									</span>
								</label>

								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={formData.persist_chat}
										onChange={(e) =>
											setFormData({
												...formData,
												persist_chat: e.target.checked,
											})
										}
										className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
									/>
									<span className="text-sm text-muted-foreground">
										Save chat history
									</span>
								</label>

								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={formData.summarize_on_end}
										onChange={(e) =>
											setFormData({
												...formData,
												summarize_on_end: e.target.checked,
											})
										}
										className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
									/>
									<span className="text-sm text-muted-foreground">
										Generate AI summary when meeting ends
									</span>
								</label>
							</div>
						</div>
					</div>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
							disabled={createMeetingMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant="default"
							loading={createMeetingMutation.isPending}
							disabled={createMeetingMutation.isPending}
						>
							{createMeetingMutation.isPending
								? "Creating..."
								: "Create Meeting"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function StopMeetingButton({
	meetingId,
	meetingTitle,
	isActive,
}: {
	meetingId: string;
	meetingTitle: string;
	isActive: boolean;
}) {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);

	const stopMeetingMutation = useMutation({
		mutationFn: async () => {
			const response = await fetch(`/api/meetings/${meetingId}/stop`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to stop meeting");
			}

			return response.json();
		},
		onSuccess: (data) => {
			// Invalidate and refetch meetings list
			queryClient.invalidateQueries({ queryKey: ["meetings"] });

			// Close dialog
			setOpen(false);

			// Log success for debugging (replace with toast notification in production)
			if (data.success) {
				console.log(`Meeting "${meetingTitle}" stopped successfully`);
			} else {
				console.warn(`Meeting partially stopped: ${data.message}`);
			}
		},
		onError: (error: Error) => {
			// Close dialog
			setOpen(false);

			// Log error for debugging (replace with toast notification in production)
			console.error(`Failed to stop meeting: ${error.message}`);
		},
	});

	const handleStopMeeting = () => {
		stopMeetingMutation.mutate();
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					variant={isActive ? "destructive" : "outline"}
					size="sm"
					disabled={!isActive}
					title={!isActive ? "Meeting is not active" : "Stop meeting"}
				>
					Stop
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="text-xl">Stop Meeting</DialogTitle>
					<DialogDescription className="pt-2">
						Are you sure you want to stop{" "}
						<span className="font-semibold text-foreground">
							"{meetingTitle}"
						</span>
						?
					</DialogDescription>
				</DialogHeader>
				<div className="my-4 space-y-3">
					<p className="text-sm font-medium text-foreground">
						This action will:
					</p>
					<ul className="space-y-2 text-sm text-muted-foreground">
						<li className="flex items-start gap-3">
							<svg
								className="mt-0.5 h-5 w-5 text-red-500 flex-shrink-0"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								/>
							</svg>
							<span>
								Set the meeting status to{" "}
								<strong className="font-semibold text-foreground">
									INACTIVE
								</strong>
							</span>
						</li>
						<li className="flex items-start gap-3">
							<svg
								className="mt-0.5 h-5 w-5 text-red-500 flex-shrink-0"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6"
								/>
							</svg>
							<span>Kick all participants from the current session</span>
						</li>
						<li className="flex items-start gap-3">
							<svg
								className="mt-0.5 h-5 w-5 text-red-500 flex-shrink-0"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
								/>
							</svg>
							<span>Stop any active recordings</span>
						</li>
						<li className="flex items-start gap-3">
							<svg
								className="mt-0.5 h-5 w-5 text-red-500 flex-shrink-0"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
								/>
							</svg>
							<span>Stop any active livestreams</span>
						</li>
					</ul>
				</div>
				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						variant="outline"
						onClick={() => setOpen(false)}
						disabled={stopMeetingMutation.isPending}
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={handleStopMeeting}
						loading={stopMeetingMutation.isPending}
						disabled={stopMeetingMutation.isPending}
					>
						{stopMeetingMutation.isPending ? "Stopping..." : "Stop Meeting"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function Dashboard() {
	const { user } = useAuth();
	const navigate = useNavigate();
	const [sorting, setSorting] = useState<SortingState>([]);
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10,
	});

	const { data, isLoading, isError, error } = useMeetings({
		page: pagination.pageIndex + 1,
		perPage: pagination.pageSize,
	});

	const columns = useMemo<ColumnDef<Meeting>[]>(
		() => [
			{
				accessorKey: "title",
				header: "Title",
				cell: ({ row }) => (
					<div>
						<div className="font-medium text-foreground">
							{row.original.title || "Untitled Meeting"}
						</div>
						<div className="text-xs text-muted-foreground mt-0.5">
							ID: {row.original.id}
						</div>
					</div>
				),
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => {
					const status = row.original.status || "INACTIVE";
					return (
						<div className="flex items-center">
							<div
								className={`h-2 w-2 rounded-full mr-2 ${
									status === "ACTIVE"
										? "bg-green-500 animate-pulse"
										: "bg-muted"
								}`}
							/>
							<span
								className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-md ${
									status === "ACTIVE"
										? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
										: "bg-muted text-muted-foreground"
								}`}
							>
								{status}
							</span>
						</div>
					);
				},
			},
			{
				accessorKey: "preferred_region",
				header: "Region",
				cell: ({ row }) => (
					<span className="text-sm font-medium">
						{row.original.preferred_region || "Auto"}
					</span>
				),
			},
			{
				accessorKey: "created_at",
				header: ({ column }) => {
					return (
						<Button
							variant="ghost"
							size="sm"
							className="-ml-3 h-8 data-[state=open]:bg-accent"
							onClick={() =>
								column.toggleSorting(column.getIsSorted() === "asc")
							}
						>
							Created
							{column.getIsSorted() === "asc" ? (
								<svg
									aria-hidden="true"
									className="ml-2 h-4 w-4"
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path d="m18 15-6-6-6 6" />
								</svg>
							) : column.getIsSorted() === "desc" ? (
								<svg
									aria-hidden="true"
									className="ml-2 h-4 w-4"
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path d="m6 9 6 6 6-6" />
								</svg>
							) : (
								<svg
									aria-hidden="true"
									className="ml-2 h-4 w-4"
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
								</svg>
							)}
						</Button>
					);
				},
				cell: ({ row }) =>
					new Date(row.original.created_at).toLocaleDateString("en-US", {
						month: "short",
						day: "numeric",
						year: "numeric",
					}),
				sortingFn: "datetime",
			},
			{
				id: "actions",
				header: "Actions",
				cell: ({ row }) => {
					const isActive = row.original.status === "ACTIVE";
					return (
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => navigate(`/meeting/${row.original.id}`)}
								title="View meeting details"
							>
								View
							</Button>
							<ShareMeetingDialog meeting={row.original}>
								<Button
									variant="outline"
									size="sm"
									disabled={!isActive}
									title={
										!isActive ? "Meeting is not active" : "Share meeting link"
									}
								>
									Share
								</Button>
							</ShareMeetingDialog>
							<StopMeetingButton
								meetingId={row.original.id}
								meetingTitle={row.original.title || "Untitled Meeting"}
								isActive={isActive}
							/>
						</div>
					);
				},
			},
		],
		[navigate],
	);

	const table = useReactTable({
		data: data?.data ?? [],
		columns,
		pageCount: data
			? Math.ceil(data.paging.total_count / pagination.pageSize)
			: -1,
		state: {
			sorting,
			pagination,
		},
		onSortingChange: setSorting,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		manualPagination: true,
		manualSorting: false,
	});

	if (!user) {
		return null;
	}

	return (
		<div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
			<div className="mb-8">
				<h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
				<p className="text-muted-foreground mt-2">
					Manage your meetings and view their status
				</p>
			</div>

			<div className="space-y-6">
				<div>
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-2xl font-semibold">Meetings</h2>
						<CreateMeetingDialog />
					</div>

					{isLoading ? (
						<div className="flex items-center justify-center p-12">
							<div className="text-center">
								<svg
									aria-hidden="true"
									className="animate-spin h-8 w-8 mx-auto mb-4 text-primary"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
								>
									<circle
										className="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										strokeWidth="4"
									/>
									<path
										className="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									/>
								</svg>
								<p className="text-muted-foreground">Loading meetings...</p>
							</div>
						</div>
					) : isError ? (
						<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-8">
							<div className="flex items-center justify-center text-destructive">
								<svg
									aria-hidden="true"
									className="h-5 w-5 mr-2"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								Error: {error?.message || "Failed to load meetings"}
							</div>
						</div>
					) : !data || data.data.length === 0 ? (
						<div className="rounded-lg border-2 border-dashed border-border p-12">
							<div className="text-center">
								<svg
									aria-hidden="true"
									className="mx-auto h-12 w-12 text-muted-foreground"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
									/>
								</svg>
								<h3 className="mt-2 text-sm font-semibold text-foreground">
									No meetings
								</h3>
								<p className="mt-1 text-sm text-muted-foreground">
									Get started by creating a new meeting.
								</p>
								<div className="mt-6">
									<CreateMeetingDialog />
								</div>
							</div>
						</div>
					) : (
						<>
							<div className="rounded-lg border bg-card overflow-hidden shadow-sm">
								<table className="w-full">
									<thead className="bg-muted/50 border-b">
										{table.getHeaderGroups().map((headerGroup) => (
											<tr key={headerGroup.id}>
												{headerGroup.headers.map((header) => (
													<th
														key={header.id}
														className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
													>
														{header.isPlaceholder
															? null
															: flexRender(
																	header.column.columnDef.header,
																	header.getContext(),
																)}
													</th>
												))}
											</tr>
										))}
									</thead>
									<tbody className="divide-y divide-border">
										{table.getRowModel().rows.map((row) => (
											<tr
												key={row.id}
												className="hover:bg-muted/30 transition-colors"
											>
												{row.getVisibleCells().map((cell) => (
													<td key={cell.id} className="px-6 py-4 text-sm">
														{flexRender(
															cell.column.columnDef.cell,
															cell.getContext(),
														)}
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{/* Pagination */}
							<div className="flex items-center justify-between px-2 mt-4">
								<div className="text-sm text-muted-foreground">
									{data && (
										<>
											Showing{" "}
											<span className="font-medium">
												{pagination.pageIndex * pagination.pageSize + 1}
											</span>{" "}
											to{" "}
											<span className="font-medium">
												{Math.min(
													(pagination.pageIndex + 1) * pagination.pageSize,
													data.paging.total_count,
												)}
											</span>{" "}
											of{" "}
											<span className="font-medium">
												{data.paging.total_count}
											</span>{" "}
											meetings
										</>
									)}
								</div>
								<div className="flex items-center gap-2">
									<div className="flex items-center gap-1">
										<Button
											variant="outline"
											size="icon-sm"
											onClick={() => table.firstPage()}
											disabled={!table.getCanPreviousPage()}
											title="First page"
										>
											<svg
												aria-hidden="true"
												className="h-4 w-4"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
												/>
											</svg>
										</Button>
										<Button
											variant="outline"
											size="icon-sm"
											onClick={() => table.previousPage()}
											disabled={!table.getCanPreviousPage()}
											title="Previous page"
										>
											<svg
												aria-hidden="true"
												className="h-4 w-4"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M15 19l-7-7 7-7"
												/>
											</svg>
										</Button>
									</div>

									<span className="text-sm font-medium px-3">
										Page {pagination.pageIndex + 1} of {table.getPageCount()}
									</span>

									<div className="flex items-center gap-1">
										<Button
											variant="outline"
											size="icon-sm"
											onClick={() => table.nextPage()}
											disabled={!table.getCanNextPage()}
											title="Next page"
										>
											<svg
												aria-hidden="true"
												className="h-4 w-4"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M9 5l7 7-7 7"
												/>
											</svg>
										</Button>
										<Button
											variant="outline"
											size="icon-sm"
											onClick={() => table.lastPage()}
											disabled={!table.getCanNextPage()}
											title="Last page"
										>
											<svg
												aria-hidden="true"
												className="h-4 w-4"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M13 5l7 7-7 7M5 5l7 7-7 7"
												/>
											</svg>
										</Button>
									</div>

									<select
										value={pagination.pageSize}
										onChange={(e) => {
											table.setPageSize(Number(e.target.value));
										}}
										className="ml-4 px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
									>
										{[1, 5, 10, 20, 30, 50].map((pageSize) => (
											<option key={pageSize} value={pageSize}>
												{pageSize} per page
											</option>
										))}
									</select>
								</div>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
