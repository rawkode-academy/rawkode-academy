import {
	REALTIMEKIT_API_KEY,
	REALTIMEKIT_API_URL,
	REALTIMEKIT_ORGANIZATION_ID,
} from "astro:env/server";

export type PreferredRegion =
	| "ap-south-1"
	| "ap-southeast-1"
	| "us-east-1"
	| "eu-central-1"
	| null;

export type TranscriptionLanguage =
	| "en-US"
	| "en-IN"
	| "de"
	| "hi"
	| "sv"
	| "ru"
	| "pl"
	| "el"
	| "fr"
	| "nl";

export type SummaryTextFormat = "plain_text" | "markdown";

export type SummaryType =
	| "general"
	| "team_meeting"
	| "sales_call"
	| "client_check_in"
	| "interview"
	| "daily_standup"
	| "one_on_one_meeting"
	| "lecture"
	| "code_review";

export type VideoCodec = "H264" | "VP8";
export type AudioCodec = "MP3" | "AAC";
export type AudioChannel = "mono" | "stereo";
export type WatermarkPosition =
	| "left top"
	| "right top"
	| "left bottom"
	| "right bottom";

export type StorageType = "aws" | "azure" | "digitalocean" | "gcs" | "sftp";
export type AuthMethod = "KEY" | "PASSWORD";

export interface TranscriptionConfig {
	keywords?: string[];
	language?: TranscriptionLanguage;
	profanity_filter?: boolean;
}

export interface SummarizationConfig {
	word_limit?: number;
	text_format?: SummaryTextFormat;
	summary_type?: SummaryType;
}

export interface AIConfig {
	transcription?: TranscriptionConfig;
	summarization?: SummarizationConfig;
}

export interface VideoWatermark {
	url: string;
	size?: {
		width: number;
		height: number;
	};
	position?: WatermarkPosition;
}

export interface VideoConfig {
	codec?: VideoCodec;
	width?: number;
	height?: number;
	watermark?: VideoWatermark;
	export_file?: boolean;
}

export interface AudioConfig {
	codec?: AudioCodec;
	channel?: AudioChannel;
	export_file?: boolean;
}

export interface StorageConfig {
	type: StorageType;
	access_key?: string;
	secret?: string;
	bucket?: string;
	region?: string;
	path?: string;
	auth_method?: AuthMethod;
	username?: string;
	password?: string;
	host?: string;
	port?: number;
	private_key?: string;
}

export interface RealtimeKitBucketConfig {
	enabled: boolean;
}

export interface LiveStreamingConfig {
	rtmp_url?: string;
}

export interface RecordingConfig {
	max_seconds?: number;
	file_name_prefix?: string;
	video_config?: VideoConfig;
	audio_config?: AudioConfig;
	storage_config?: StorageConfig;
	realtimekit_bucket_config?: RealtimeKitBucketConfig;
	live_streaming_config?: LiveStreamingConfig;
}

export interface CreateMeetingOptions {
	title?: string;
	preferred_region?: PreferredRegion;
	record_on_start?: boolean;
	live_stream_on_start?: boolean;
	recording_config?: RecordingConfig;
	ai_config?: AIConfig;
	persist_chat?: boolean;
	summarize_on_end?: boolean;
}

export interface Meeting {
	id: string;
	title?: string;
	preferred_region?: PreferredRegion;
	created_at: string;
	record_on_start?: boolean;
	updated_at: string;
	live_stream_on_start?: boolean;
	persist_chat?: boolean;
	summarize_on_end?: boolean;
	status?: "ACTIVE" | "INACTIVE";
	recording_config?: RecordingConfig;
	ai_config?: AIConfig;
}

export interface Recording {
	id: string;
	download_url: string | null;
	download_url_expiry: string | null;
	audio_download_url: string | null;
	file_size: number | null;
	session_id: string | null;
	output_file_name: string;
	status:
		| "INVOKED"
		| "RECORDING"
		| "UPLOADING"
		| "UPLOADED"
		| "ERRORED"
		| "PAUSED";
	invoked_time: string;
	started_time: string | null;
	stopped_time: string | null;
	recording_duration?: number;
}

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: {
		code: number;
		message: string;
	};
}

export class RealtimeKitError extends Error {
	constructor(
		public readonly code: number,
		message: string,
	) {
		super(message);
		this.name = "RealtimeKitError";
	}
}

export class RealtimeKitClient {
	private readonly baseUrl: string;
	private readonly organizationId: string;
	private readonly apiKey: string;

	constructor(baseUrl?: string, organizationId?: string, apiKey?: string) {
		this.baseUrl =
			baseUrl ||
			REALTIMEKIT_API_URL ||
			"https://rtk.realtime.cloudflare.com/v2";
		this.organizationId = organizationId || REALTIMEKIT_ORGANIZATION_ID;
		this.apiKey = apiKey || REALTIMEKIT_API_KEY;

		if (!this.organizationId || !this.apiKey) {
			throw new Error("RealtimeKit credentials are required");
		}
	}

	private getAuthHeader(): string {
		const credentials = `${this.organizationId}:${this.apiKey}`;
		return `Basic ${btoa(credentials)}`;
	}

	private async request<T>(
		path: string,
		options: RequestInit = {},
	): Promise<T> {
		const url = `${this.baseUrl}${path}`;

		const response = await fetch(url, {
			...options,
			headers: {
				Authorization: this.getAuthHeader(),
				"Content-Type": "application/json",
				...options.headers,
			},
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({
				error: { code: response.status, message: response.statusText },
			}));

			throw new RealtimeKitError(
				errorData.error?.code || response.status,
				errorData.error?.message ||
					`Request failed with status ${response.status}`,
			);
		}

		const data = (await response.json()) as ApiResponse<T>;

		if (!data.success) {
			throw new RealtimeKitError(
				data.error?.code || 500,
				data.error?.message || "Request failed",
			);
		}

		return data.data as T;
	}

	/**
	 * Create a new meeting with all available options
	 */
	async createMeeting(options: CreateMeetingOptions = {}): Promise<Meeting> {
		return this.request<Meeting>("/meetings", {
			method: "POST",
			body: JSON.stringify(options),
		});
	}

	/**
	 * Get a meeting by ID
	 */
	async getMeeting(meetingId: string): Promise<Meeting> {
		return this.request<Meeting>(`/meetings/${meetingId}`);
	}

	/**
	 * Update a meeting
	 */
	async updateMeeting(
		meetingId: string,
		options: Partial<CreateMeetingOptions>,
	): Promise<Meeting> {
		return this.request<Meeting>(`/meetings/${meetingId}`, {
			method: "PATCH",
			body: JSON.stringify(options),
		});
	}

	/**
	 * Replace a meeting (PUT)
	 */
	async replaceMeeting(
		meetingId: string,
		options: CreateMeetingOptions,
	): Promise<Meeting> {
		return this.request<Meeting>(`/meetings/${meetingId}`, {
			method: "PUT",
			body: JSON.stringify(options),
		});
	}

	/**
	 * List all meetings
	 */
	async listMeetings(params?: {
		page_no?: number;
		per_page?: number;
		start_time?: string;
		end_time?: string;
		search?: string;
	}): Promise<{
		data: Meeting[];
		paging: {
			total_count: number;
			start_offset: number;
			end_offset: number;
		};
	}> {
		const queryParams = new URLSearchParams();
		if (params?.page_no)
			queryParams.append("page_no", params.page_no.toString());
		if (params?.per_page)
			queryParams.append("per_page", params.per_page.toString());
		if (params?.start_time) queryParams.append("start_time", params.start_time);
		if (params?.end_time) queryParams.append("end_time", params.end_time);
		if (params?.search) queryParams.append("search", params.search);

		const query = queryParams.toString();

		// Make the raw request without the standard data extraction
		const url = `${this.baseUrl}/meetings${query ? `?${query}` : ""}`;

		const response = await fetch(url, {
			headers: {
				Authorization: this.getAuthHeader(),
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({
				error: { code: response.status, message: response.statusText },
			}));

			throw new RealtimeKitError(
				errorData.error?.code || response.status,
				errorData.error?.message ||
					`Request failed with status ${response.status}`,
			);
		}

		const data = await response.json();

		if (!data.success) {
			throw new RealtimeKitError(
				data.error?.code || 500,
				data.error?.message || "Request failed",
			);
		}

		// Return the data and paging structure as expected
		return {
			data: data.data || [],
			paging: data.paging || {
				total_count: 0,
				start_offset: 0,
				end_offset: 0,
			},
		};
	}

	/**
	 * Add a participant to a meeting
	 */
	async addParticipant(
		meetingId: string,
		participant: {
			name?: string;
			picture?: string;
			preset_name: string;
			custom_participant_id: string;
		},
	): Promise<{
		id: string;
		name?: string;
		picture?: string;
		custom_participant_id: string;
		preset_name: string;
		created_at: string;
		updated_at: string;
		token: string;
	}> {
		return this.request(`/meetings/${meetingId}/participants`, {
			method: "POST",
			body: JSON.stringify(participant),
		});
	}

	/**
	 * Start recording a meeting
	 */
	async startRecording(options: {
		meeting_id: string;
		max_seconds?: number;
		storage_config?: StorageConfig;
		video_config?: VideoConfig;
		audio_config?: AudioConfig;
		rtmp_out_config?: LiveStreamingConfig;
		file_name_prefix?: string;
		url?: string;
		realtimekit_bucket_config?: RealtimeKitBucketConfig;
		interactive_config?: { type: "ID3" };
		allow_multiple_recordings?: boolean;
	}): Promise<Recording> {
		return this.request("/recordings", {
			method: "POST",
			body: JSON.stringify(options),
		});
	}

	/**
	 * Stop recording
	 */
	async stopRecording(recordingId: string): Promise<Recording> {
		return this.request(`/recordings/${recordingId}`, {
			method: "PUT",
			body: JSON.stringify({ action: "stop" }),
		});
	}

	/**
	 * Pause recording
	 */
	async pauseRecording(recordingId: string): Promise<Recording> {
		return this.request(`/recordings/${recordingId}`, {
			method: "PUT",
			body: JSON.stringify({ action: "pause" }),
		});
	}

	/**
	 * Resume recording
	 */
	async resumeRecording(recordingId: string): Promise<Recording> {
		return this.request(`/recordings/${recordingId}`, {
			method: "PUT",
			body: JSON.stringify({ action: "resume" }),
		});
	}

	/**
	 * Start livestreaming a meeting
	 */
	async startLivestream(
		meetingId: string,
		options?: {
			name?: string;
			video_config?: {
				height?: number;
				width?: number;
			};
		},
	): Promise<{
		status: "LIVE" | "IDLE" | "ERRORED" | "INVOKED";
		ingest_server: string;
		id: string;
		stream_key: string;
		playback_url: string;
	}> {
		return this.request(`/meetings/${meetingId}/livestreams`, {
			method: "POST",
			body: JSON.stringify(options || {}),
		});
	}

	/**
	 * Stop livestreaming a meeting
	 */
	async stopLivestream(meetingId: string): Promise<{
		message: string;
	}> {
		return this.request(`/meetings/${meetingId}/active-livestream/stop`, {
			method: "POST",
			body: JSON.stringify({}),
		});
	}

	/**
	 * Get active session for a meeting
	 */
	async getActiveSession(meetingId: string): Promise<{
		id: string;
		meeting_id: string;
		created_at: string;
		started_at: string;
		status: string;
		participants?: Array<{
			id: string;
			name?: string;
			custom_participant_id: string;
			joined_at: string;
		}>;
		recordings?: Array<{
			id: string;
			status: string;
			started_time?: string;
			recording_duration?: number;
		}>;
	}> {
		return this.request(`/meetings/${meetingId}/active-session`);
	}

	/**
	 * Get active livestream for a meeting
	 */
	async getActiveLivestream(meetingId: string): Promise<{
		id: string;
		meeting_id: string;
		status: "LIVE" | "IDLE" | "ERRORED" | "INVOKED";
		ingest_server?: string;
		stream_key?: string;
		playback_url?: string;
		started_at?: string;
		viewer_count?: number;
	}> {
		return this.request(`/meetings/${meetingId}/active-livestream`);
	}

	/**
	 * Stop a meeting by:
	 * 1. Setting status to INACTIVE
	 * 2. Kicking all participants from active session
	 * 3. Stopping any active recordings
	 * 4. Stopping any active livestreams
	 */
	async stopMeeting(meetingId: string): Promise<{
		success: boolean;
		message: string;
		details: {
			statusUpdated: boolean;
			participantsKicked: boolean;
			recordingsStopped: boolean;
			livestreamsStopped: boolean;
		};
	}> {
		const results = {
			statusUpdated: false,
			participantsKicked: false,
			recordingsStopped: false,
			livestreamsStopped: false,
		};

		const errors: string[] = [];

		try {
			// 1. Update meeting status to INACTIVE
			try {
				await this.updateMeeting(meetingId, {
					// @ts-ignore - status field exists but not in CreateMeetingOptions type
					status: "INACTIVE",
				});
				results.statusUpdated = true;
			} catch (error) {
				console.error("Failed to update meeting status:", error);
				errors.push("Failed to update meeting status");
			}

			// 2. Kick all participants from active session
			try {
				await this.request(`/meetings/${meetingId}/active-session/kick-all`, {
					method: "POST",
					body: JSON.stringify({}),
				});
				results.participantsKicked = true;
			} catch (error) {
				// 404 means no active session, which is fine
				const errorCode = (error as RealtimeKitError)?.code;
				if (errorCode !== 404) {
					console.error("Failed to kick participants:", error);
					errors.push("Failed to kick participants");
				} else {
					results.participantsKicked = true; // No active session to kick from
				}
			}

			// 3. Get active session to find recordings
			try {
				const activeSession = await this.request<{
					recordings?: Array<{
						id: string;
						status: string;
					}>;
				}>(`/meetings/${meetingId}/active-session`);

				// Stop any active recordings
				if (activeSession?.recordings && activeSession.recordings.length > 0) {
					for (const recording of activeSession.recordings) {
						if (
							recording.status === "RECORDING" ||
							recording.status === "PAUSED"
						) {
							try {
								await this.stopRecording(recording.id);
								results.recordingsStopped = true;
							} catch (error) {
								console.error(
									`Failed to stop recording ${recording.id}:`,
									error,
								);
								errors.push(`Failed to stop recording ${recording.id}`);
							}
						}
					}
				} else {
					results.recordingsStopped = true; // No recordings to stop
				}
			} catch (error) {
				// 404 means no active session
				const errorCode = (error as RealtimeKitError)?.code;
				if (errorCode === 404) {
					results.recordingsStopped = true; // No active session means no recordings
				} else {
					console.error("Failed to check recordings:", error);
					errors.push("Failed to check recordings");
				}
			}

			// 4. Stop any active livestreams
			try {
				const activeLivestream = await this.request<{
					status?: string;
				}>(`/meetings/${meetingId}/active-livestream`);

				if (activeLivestream?.status === "LIVE") {
					await this.stopLivestream(meetingId);
					results.livestreamsStopped = true;
				} else {
					results.livestreamsStopped = true; // No active livestream to stop
				}
			} catch (error) {
				// 404 or other errors mean no active livestream
				const errorCode = (error as RealtimeKitError)?.code;
				if (errorCode === 404) {
					results.livestreamsStopped = true; // No active livestream
				} else {
					console.error("Failed to stop livestream:", error);
					errors.push("Failed to stop livestream");
				}
			}

			const allSuccessful = Object.values(results).every((v) => v === true);

			return {
				success: allSuccessful,
				message: allSuccessful
					? "Meeting stopped successfully"
					: `Meeting partially stopped. Errors: ${errors.join(", ")}`,
				details: results,
			};
		} catch (error) {
			console.error("Failed to stop meeting:", error);
			return {
				success: false,
				message: "Failed to stop meeting",
				details: results,
			};
		}
	}

	/**
	 * Create an independent livestream (not tied to a meeting)
	 */
	async createIndependentLivestream(name?: string): Promise<{
		status: "LIVE" | "IDLE" | "ERRORED" | "INVOKED";
		name?: string;
		meeting_id: null;
		ingest_server: string;
		id: string;
		stream_key: string;
		playback_url: string;
		disabled: boolean;
	}> {
		return this.request("/livestreams", {
			method: "POST",
			body: JSON.stringify({ name }),
		});
	}

	/**
	 * Get all livestreams
	 */
	async listLivestreams(params?: {
		exclude_meetings?: boolean;
		per_page?: number;
		page_no?: number;
		status?: "LIVE" | "IDLE" | "ERRORED" | "INVOKED";
		start_time?: string;
		end_time?: string;
		sort_order?: "ASC" | "DSC";
	}): Promise<Recording[]> {
		const queryParams = new URLSearchParams();
		if (params?.exclude_meetings !== undefined) {
			queryParams.append(
				"exclude_meetings",
				params.exclude_meetings.toString(),
			);
		}
		if (params?.per_page)
			queryParams.append("per_page", params.per_page.toString());
		if (params?.page_no)
			queryParams.append("page_no", params.page_no.toString());
		if (params?.status) queryParams.append("status", params.status);
		if (params?.start_time) queryParams.append("start_time", params.start_time);
		if (params?.end_time) queryParams.append("end_time", params.end_time);
		if (params?.sort_order) queryParams.append("sort_order", params.sort_order);

		const query = queryParams.toString();
		return this.request(`/livestreams${query ? `?${query}` : ""}`);
	}

	/**
	 * Get participants for a meeting
	 */
	async getParticipants(
		meetingId: string,
		params?: {
			page_no?: number;
			per_page?: number;
		},
	): Promise<{
		data: Array<{
			id: string;
			name?: string;
			picture?: string;
			custom_participant_id: string;
			preset_name: string;
			created_at: string;
			updated_at: string;
			audio_enabled?: boolean;
			video_enabled?: boolean;
		}>;
		paging?: {
			total_count: number;
			start_offset: number;
			end_offset: number;
		};
	}> {
		const queryParams = new URLSearchParams();
		if (params?.page_no)
			queryParams.append("page_no", params.page_no.toString());
		if (params?.per_page)
			queryParams.append("per_page", params.per_page.toString());

		const query = queryParams.toString();
		const url = `/meetings/${meetingId}/participants${query ? `?${query}` : ""}`;

		// The API returns { success: true, data: [...], paging: {...} }
		// But our request method only returns the data part
		// We need to get the full response for pagination info
		const response = await fetch(`${this.baseUrl}${url}`, {
			headers: {
				Authorization: this.getAuthHeader(),
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			throw new RealtimeKitError(
				response.status,
				`Failed to fetch participants: ${response.statusText}`,
			);
		}

		const result = await response.json();

		if (!result.success) {
			throw new RealtimeKitError(
				result.error?.code || 500,
				result.error?.message || "Failed to fetch participants",
			);
		}

		// Return the data array and paging info
		return {
			data: result.data || [],
			paging: result.paging,
		};
	}

	/**
	 * Get recordings for a meeting
	 */
	async getRecordings(params?: {
		meeting_id?: string;
		page_no?: number;
		per_page?: number;
		status?:
			| "INVOKED"
			| "RECORDING"
			| "UPLOADING"
			| "UPLOADED"
			| "ERRORED"
			| "PAUSED";
	}): Promise<{
		data: Array<Recording>;
		paging?: {
			total_count: number;
			start_offset: number;
			end_offset: number;
		};
	}> {
		const queryParams = new URLSearchParams();
		if (params?.meeting_id) queryParams.append("meeting_id", params.meeting_id);
		if (params?.page_no)
			queryParams.append("page_no", params.page_no.toString());
		if (params?.per_page)
			queryParams.append("per_page", params.per_page.toString());
		if (params?.status) queryParams.append("status", params.status);

		const query = queryParams.toString();
		const url = `/recordings${query ? `?${query}` : ""}`;

		// The API returns { success: true, data: [...], paging: {...} }
		// We need to get the full response for pagination info
		const response = await fetch(`${this.baseUrl}${url}`, {
			headers: {
				Authorization: this.getAuthHeader(),
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			throw new RealtimeKitError(
				response.status,
				`Failed to fetch recordings: ${response.statusText}`,
			);
		}

		const result = await response.json();

		if (!result.success) {
			throw new RealtimeKitError(
				result.error?.code || 500,
				result.error?.message || "Failed to fetch recordings",
			);
		}

		// Return the data array and paging info
		return {
			data: result.data || [],
			paging: result.paging,
		};
	}

	/**
	 * Get session summary
	 */
	async getSessionSummary(sessionId: string): Promise<{
		sessionId: string;
		summaryDownloadUrl: string;
		summaryDownloadUrlExpiry: string;
	}> {
		const response = await this.request<{
			success: boolean;
			data: {
				sessionId: string;
				summaryDownloadUrl: string;
				summaryDownloadUrlExpiry: string;
			};
		}>(`/sessions/${sessionId}/summary`);
		return response.data;
	}

	/**
	 * Generate session summary
	 */
	async generateSessionSummary(sessionId: string): Promise<{
		message: string;
		status: string;
	}> {
		return this.request(`/sessions/${sessionId}/summary`, {
			method: "POST",
			body: JSON.stringify({}),
		});
	}

	/**
	 * Get session chat download URL
	 */
	async getSessionChat(sessionId: string): Promise<{
		chat_download_url: string;
		chat_download_url_expiry: string;
	}> {
		const response = await this.request<{
			success: boolean;
			data: {
				chat_download_url: string;
				chat_download_url_expiry: string;
			};
		}>(`/sessions/${sessionId}/chat`);
		return response.data;
	}

	/**
	 * Get session transcript download URL
	 */
	async getSessionTranscript(sessionId: string): Promise<{
		sessionId: string;
		transcript_download_url: string;
		transcript_download_url_expiry: string;
	}> {
		const response = await this.request<{
			success: boolean;
			data: {
				sessionId: string;
				transcript_download_url: string;
				transcript_download_url_expiry: string;
			};
		}>(`/sessions/${sessionId}/transcript`);
		return response.data;
	}
}

// Export a default instance for convenience
export const realtimeKitClient = new RealtimeKitClient();
