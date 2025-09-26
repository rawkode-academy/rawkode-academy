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
	bitrate?: number; // Video bitrate in kbps for high-quality recording
	frame_rate?: number; // Frame rate for video recording
	quality_preset?: "podcast" | "livestream" | "ultra_hd" | "standard"; // Preset for different use cases
}

export interface AudioConfig {
	codec?: AudioCodec;
	channel?: AudioChannel;
	export_file?: boolean;
	bitrate?: number; // Audio bitrate in kbps for high-quality recording
	sample_rate?: number; // Sample rate (44100, 48000) for podcast/music quality
	quality_preset?: "podcast" | "music" | "voice" | "standard"; // Preset for different use cases
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

export interface UpdateMeetingOptions extends CreateMeetingOptions {
	status?: "ACTIVE" | "INACTIVE";
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

export interface LivestreamObject {
	id: string;
	name?: string;
	status: "LIVE" | "IDLE" | "ERRORED" | "INVOKED";
	meeting_id?: string;
	ingest_server: string;
	stream_key: string;
	playback_url: string;
	created_at: string;
	updated_at: string;
	disabled: boolean;
}

export interface PagingInfo {
	total_count: number;
	start_offset: number;
	end_offset: number;
}

export interface SessionRawData {
	id: string;
	status?: string;
	started_at?: string;
	startedAt?: string;
	ended_at?: string | null;
	endedAt?: string | null;
	minutes_consumed?: number;
	minutesConsumed?: number;
}

export interface SessionData {
	id: string;
	status: string;
	started_at: string;
	ended_at: string | null;
	minutes_consumed: number;
}

export interface ChatResponse {
	data?: {
		chat_download_url?: string;
		chatDownloadUrl?: string;
		chat_download_url_expiry?: string;
		chatDownloadUrlExpiry?: string;
	};
	chat_download_url?: string;
	chatDownloadUrl?: string;
	chat_download_url_expiry?: string;
	chatDownloadUrlExpiry?: string;
}

/**
 * Type for parsed chat message data
 */
export interface ParsedChatMessage {
	timestamp: string;
	participantName: string;
	message: string;
}

/**
 * Type for CSV field indices
 */
export interface ChatCsvIndices {
	displayName: number;
	payload: number;
	createdAt: number;
	payloadType: number;
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
		public readonly context?: {
			method?: string;
			endpoint?: string;
			requestId?: string;
			retryable?: boolean;
		},
	) {
		super(message);
		this.name = "RealtimeKitError";

		// Add context to error message if available
		if (this.context) {
			const contextParts = [];
			if (this.context.method)
				contextParts.push(`Method: ${this.context.method}`);
			if (this.context.endpoint)
				contextParts.push(`Endpoint: ${this.context.endpoint}`);
			if (this.context.requestId)
				contextParts.push(`Request ID: ${this.context.requestId}`);
			if (contextParts.length > 0) {
				this.message += ` (${contextParts.join(", ")})`;
			}
		}
	}

	/**
	 * Check if the error is retryable based on status code and context
	 */
	get isRetryable(): boolean {
		if (this.context?.retryable !== undefined) {
			return this.context.retryable;
		}

		// Common retryable status codes
		return [429, 500, 502, 503, 504].includes(this.code);
	}

	/**
	 * Get a user-friendly error message
	 */
	get userMessage(): string {
		switch (this.code) {
			case 400:
				return "Bad request. Please check your input parameters.";
			case 401:
				return "Authentication failed. Please check your API credentials.";
			case 403:
				return "Access forbidden. You do not have permission to perform this action.";
			case 404:
				return "Resource not found. The requested item may not exist.";
			case 429:
				return "Rate limit exceeded. Please wait before making more requests.";
			case 500:
				return "Internal server error. Please try again later.";
			case 502:
				return "Bad gateway. The service is temporarily unavailable.";
			case 503:
				return "Service unavailable. Please try again later.";
			case 504:
				return "Gateway timeout. The request took too long to process.";
			default:
				return this.message;
		}
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

	/**
	 * Validate that a string is a valid UUID format
	 */
	private validateUUID(value: string, paramName: string): void {
		const uuidRegex =
			/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		if (!uuidRegex.test(value)) {
			throw new Error(`Invalid ${paramName}: must be a valid UUID format`);
		}
	}

	/**
	 * Validate that a required string parameter is provided
	 */
	private validateRequiredString(value: unknown, paramName: string): void {
		if (!value || typeof value !== "string" || value.trim() === "") {
			throw new Error(
				`${paramName} is required and must be a non-empty string`,
			);
		}
	}

	/**
	 * Validate that a date string is in valid ISO format
	 */
	private validateDateString(value: string, paramName: string): void {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			throw new Error(`Invalid ${paramName}: must be a valid ISO date string`);
		}
	}

	/**
	 * Validate pagination parameters
	 */
	private validatePaginationParams(params?: {
		page_no?: number;
		per_page?: number;
	}): void {
		if (params?.page_no !== undefined) {
			if (!Number.isInteger(params.page_no) || params.page_no < 1) {
				throw new Error("page_no must be a positive integer");
			}
		}
		if (params?.per_page !== undefined) {
			if (
				!Number.isInteger(params.per_page) ||
				params.per_page < 1 ||
				params.per_page > 100
			) {
				throw new Error("per_page must be an integer between 1 and 100");
			}
		}
	}

	private async request<T>(
		path: string,
		options: RequestInit = {},
		method?: string,
	): Promise<T> {
		const url = `${this.baseUrl}${path}`;

		try {
			const response = await fetch(url, {
				...options,
				headers: {
					Authorization: this.getAuthHeader(),
					"Content-Type": "application/json",
					...options.headers,
				},
			});

			const requestId =
				response.headers.get("x-request-id") ||
				response.headers.get("request-id");

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({
					error: { code: response.status, message: response.statusText },
				}));

				throw new RealtimeKitError(
					errorData.error?.code || response.status,
					errorData.error?.message ||
						`Request failed with status ${response.status}: ${response.statusText}`,
					{
						method: method || options.method || "GET",
						endpoint: path,
						requestId: requestId || undefined,
						retryable: [429, 500, 502, 503, 504].includes(response.status),
					},
				);
			}

			const data = (await response.json()) as ApiResponse<T>;

			if (!data.success) {
				throw new RealtimeKitError(
					data.error?.code || 500,
					data.error?.message || "Request failed - API returned success: false",
					{
						method: method || options.method || "GET",
						endpoint: path,
						requestId: requestId || undefined,
					},
				);
			}

			return data.data as T;
		} catch (error) {
			// Re-throw RealtimeKitError as-is
			if (error instanceof RealtimeKitError) {
				throw error;
			}

			// Handle network errors
			if (error instanceof TypeError && error.message.includes("fetch")) {
				throw new RealtimeKitError(0, `Network error: ${error.message}`, {
					method: method || options.method || "GET",
					endpoint: path,
					retryable: true,
				});
			}

			// Handle other unexpected errors
			throw new RealtimeKitError(
				500,
				`Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
				{
					method: method || options.method || "GET",
					endpoint: path,
				},
			);
		}
	}

	/**
	 * Handle paginated API responses consistently
	 */
	private async requestPaginated<T>(
		path: string,
		options: RequestInit = {},
		method?: string,
	): Promise<{
		data: T[];
		paging?: PagingInfo;
	}> {
		const url = `${this.baseUrl}${path}`;

		try {
			const response = await fetch(url, {
				...options,
				headers: {
					Authorization: this.getAuthHeader(),
					"Content-Type": "application/json",
					...options.headers,
				},
			});

			const requestId =
				response.headers.get("x-request-id") ||
				response.headers.get("request-id");

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({
					error: { code: response.status, message: response.statusText },
				}));

				throw new RealtimeKitError(
					errorData.error?.code || response.status,
					errorData.error?.message ||
						`Paginated request failed with status ${response.status}: ${response.statusText}`,
					{
						method: method || options.method || "GET",
						endpoint: path,
						requestId: requestId || undefined,
						retryable: [429, 500, 502, 503, 504].includes(response.status),
					},
				);
			}

			const result = await response.json();

			if (!result.success) {
				throw new RealtimeKitError(
					result.error?.code || 500,
					result.error?.message ||
						"Paginated request failed - API returned success: false",
					{
						method: method || options.method || "GET",
						endpoint: path,
						requestId: requestId || undefined,
					},
				);
			}

			// Handle different response structures from RealtimeKit API
			let responseData: unknown[] = [];

			if (Array.isArray(result.data)) {
				// Direct array response
				responseData = result.data;
			} else if (result.data && Array.isArray(result.data.sessions)) {
				// Nested sessions array (common for sessions endpoint)
				responseData = result.data.sessions;
			} else if (result.data && typeof result.data === "object") {
				// Check if any property contains an array
				for (const [_key, value] of Object.entries(result.data)) {
					if (Array.isArray(value)) {
						responseData = value;
						break;
					}
				}
			}

			return {
				data: responseData,
				paging: result.paging || {
					total_count: 0,
					start_offset: 0,
					end_offset: 0,
				},
			};
		} catch (error) {
			// Re-throw RealtimeKitError as-is
			if (error instanceof RealtimeKitError) {
				throw error;
			}

			// Handle network errors
			if (error instanceof TypeError && error.message.includes("fetch")) {
				throw new RealtimeKitError(
					0,
					`Network error in paginated request: ${error.message}`,
					{
						method: method || options.method || "GET",
						endpoint: path,
						retryable: true,
					},
				);
			}

			// Handle other unexpected errors
			throw new RealtimeKitError(
				500,
				`Unexpected error in paginated request: ${error instanceof Error ? error.message : "Unknown error"}`,
				{
					method: method || options.method || "GET",
					endpoint: path,
				},
			);
		}
	}

	/**
	 * Create a new meeting with optional configuration
	 *
	 * @param options - Meeting configuration options
	 * @param options.title - Optional meeting title
	 * @param options.preferred_region - Preferred region for the meeting (us-east-1, eu-central-1, etc.)
	 * @param options.record_on_start - Whether to start recording automatically when the meeting begins
	 * @param options.live_stream_on_start - Whether to start livestreaming automatically
	 * @param options.recording_config - Configuration for recording (storage, video/audio settings, etc.)
	 * @param options.ai_config - AI features configuration (transcription, summarization)
	 * @param options.persist_chat - Whether to save chat messages
	 * @param options.summarize_on_end - Whether to automatically generate a summary when the meeting ends
	 *
	 * @returns Promise resolving to the created meeting object
	 * @throws {RealtimeKitError} When the request fails or API returns an error
	 *
	 * @example
	 * ```typescript
	 * const meeting = await client.createMeeting({
	 *   title: "Team Standup",
	 *   record_on_start: true,
	 *   preferred_region: "us-east-1",
	 *   ai_config: {
	 *     transcription: { language: "en-US" },
	 *     summarization: { word_limit: 200 }
	 *   }
	 * });
	 * console.log('Meeting created:', meeting.id);
	 * ```
	 */
	async createMeeting(options: CreateMeetingOptions = {}): Promise<Meeting> {
		return this.request<Meeting>(
			"/meetings",
			{
				method: "POST",
				body: JSON.stringify(options),
			},
			"createMeeting",
		);
	}

	/**
	 * Get a meeting by ID
	 */
	async getMeeting(meetingId: string, name?: string): Promise<Meeting> {
		this.validateRequiredString(meetingId, "meetingId");
		this.validateUUID(meetingId, "meetingId");

		const queryParams = new URLSearchParams();
		if (name) {
			if (typeof name !== "string" || name.trim() === "") {
				throw new Error("name must be a non-empty string when provided");
			}
			queryParams.append("name", name);
		}
		const query = queryParams.toString();
		return this.request<Meeting>(
			`/meetings/${meetingId}${query ? `?${query}` : ""}`,
			{},
			"getMeeting",
		);
	}

	/**
	 * Update a meeting
	 */
	async updateMeeting(
		meetingId: string,
		options: Partial<UpdateMeetingOptions>,
	): Promise<Meeting> {
		this.validateRequiredString(meetingId, "meetingId");
		this.validateUUID(meetingId, "meetingId");

		if (!options || typeof options !== "object") {
			throw new Error("options is required and must be an object");
		}

		return this.request<Meeting>(
			`/meetings/${meetingId}`,
			{
				method: "PATCH",
				body: JSON.stringify(options),
			},
			"updateMeeting",
		);
	}

	/**
	 * Replace a meeting (PUT)
	 */
	async replaceMeeting(
		meetingId: string,
		options: CreateMeetingOptions,
	): Promise<Meeting> {
		this.validateRequiredString(meetingId, "meetingId");
		this.validateUUID(meetingId, "meetingId");

		if (!options || typeof options !== "object") {
			throw new Error("options is required and must be an object");
		}

		return this.request<Meeting>(
			`/meetings/${meetingId}`,
			{
				method: "PUT",
				body: JSON.stringify(options),
			},
			"replaceMeeting",
		);
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
		paging?: PagingInfo;
	}> {
		if (params) {
			this.validatePaginationParams(params);

			if (params.start_time) {
				this.validateDateString(params.start_time, "start_time");
			}
			if (params.end_time) {
				this.validateDateString(params.end_time, "end_time");
			}
			if (params.search && typeof params.search !== "string") {
				throw new Error("search must be a string");
			}
		}

		const queryParams = new URLSearchParams();
		if (params?.page_no)
			queryParams.append("page_no", params.page_no.toString());
		if (params?.per_page)
			queryParams.append("per_page", params.per_page.toString());
		if (params?.start_time) queryParams.append("start_time", params.start_time);
		if (params?.end_time) queryParams.append("end_time", params.end_time);
		if (params?.search) queryParams.append("search", params.search);

		const query = queryParams.toString();
		return this.requestPaginated<Meeting>(
			`/meetings${query ? `?${query}` : ""}`,
			{},
			"listMeetings",
		);
	}

	/**
	 * Add a participant to a meeting and generate an authentication token
	 *
	 * @param meetingId - The UUID of the meeting to add the participant to
	 * @param participant - Participant configuration
	 * @param participant.name - Optional display name for the participant
	 * @param participant.picture - Optional profile picture URL
	 * @param participant.preset_name - Meeting preset that defines participant permissions (e.g., "group_call_host", "group_call_participant")
	 * @param participant.custom_participant_id - Unique identifier for the participant (used for your own tracking)
	 *
	 * @returns Promise resolving to participant details including authentication token
	 * @throws {RealtimeKitError} When the request fails, meeting doesn't exist, or validation fails
	 * @throws {Error} When required parameters are missing or invalid
	 *
	 * @example
	 * ```typescript
	 * const participant = await client.addParticipant('meeting-uuid', {
	 *   name: "John Doe",
	 *   preset_name: "group_call_participant",
	 *   custom_participant_id: "user_123",
	 *   picture: "https://example.com/avatar.jpg"
	 * });
	 *
	 * // Use the token to join the meeting in your frontend
	 * console.log('Join with token:', participant.token);
	 * ```
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
		this.validateRequiredString(meetingId, "meetingId");
		this.validateUUID(meetingId, "meetingId");

		if (!participant || typeof participant !== "object") {
			throw new Error("participant is required and must be an object");
		}

		this.validateRequiredString(
			participant.preset_name,
			"participant.preset_name",
		);
		this.validateRequiredString(
			participant.custom_participant_id,
			"participant.custom_participant_id",
		);

		if (participant.name && typeof participant.name !== "string") {
			throw new Error("participant.name must be a string when provided");
		}
		if (participant.picture && typeof participant.picture !== "string") {
			throw new Error("participant.picture must be a string when provided");
		}

		return this.request(`/meetings/${meetingId}/participants`, {
			method: "POST",
			body: JSON.stringify(participant),
		});
	}

	/**
	 * Start recording a meeting with detailed configuration options
	 *
	 * @param options - Recording configuration
	 * @param options.meeting_id - UUID of the meeting to record
	 * @param options.max_seconds - Maximum recording duration in seconds (optional)
	 * @param options.storage_config - External storage configuration (AWS S3, Azure, GCS, etc.)
	 * @param options.video_config - Video encoding settings (codec, resolution, watermark)
	 * @param options.audio_config - Audio encoding settings (codec, channels)
	 * @param options.rtmp_out_config - RTMP streaming configuration for live output
	 * @param options.file_name_prefix - Custom prefix for the recording file name
	 * @param options.url - Custom webhook URL for recording events
	 * @param options.realtimekit_bucket_config - Use RealtimeKit's default storage
	 * @param options.interactive_config - Interactive features configuration
	 * @param options.allow_multiple_recordings - Whether to allow multiple simultaneous recordings
	 *
	 * @returns Promise resolving to the recording object with status and metadata
	 * @throws {RealtimeKitError} When the request fails or meeting doesn't exist
	 * @throws {Error} When required parameters are missing
	 *
	 * @example
	 * ```typescript
	 * const recording = await client.startRecording({
	 *   meeting_id: 'meeting-uuid',
	 *   max_seconds: 3600, // 1 hour
	 *   video_config: {
	 *     codec: 'H264',
	 *     width: 1920,
	 *     height: 1080
	 *   },
	 *   realtimekit_bucket_config: { enabled: true }
	 * });
	 *
	 * console.log('Recording started:', recording.id);
	 * ```
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
		this.validateRequiredString(recordingId, "recordingId");
		this.validateUUID(recordingId, "recordingId");

		return this.request(`/recordings/${recordingId}`, {
			method: "PUT",
			body: JSON.stringify({ action: "stop" }),
		});
	}

	/**
	 * Pause recording
	 */
	async pauseRecording(recordingId: string): Promise<Recording> {
		this.validateRequiredString(recordingId, "recordingId");
		this.validateUUID(recordingId, "recordingId");

		return this.request(`/recordings/${recordingId}`, {
			method: "PUT",
			body: JSON.stringify({ action: "pause" }),
		});
	}

	/**
	 * Resume recording
	 */
	async resumeRecording(recordingId: string): Promise<Recording> {
		this.validateRequiredString(recordingId, "recordingId");
		this.validateUUID(recordingId, "recordingId");

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
		this.validateRequiredString(meetingId, "meetingId");
		this.validateUUID(meetingId, "meetingId");

		if (options) {
			if (options.name && typeof options.name !== "string") {
				throw new Error("options.name must be a string when provided");
			}
			if (options.video_config) {
				if (
					options.video_config.height &&
					(!Number.isInteger(options.video_config.height) ||
						options.video_config.height <= 0)
				) {
					throw new Error("video_config.height must be a positive integer");
				}
				if (
					options.video_config.width &&
					(!Number.isInteger(options.video_config.width) ||
						options.video_config.width <= 0)
				) {
					throw new Error("video_config.width must be a positive integer");
				}
			}
		}

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
		this.validateRequiredString(meetingId, "meetingId");
		this.validateUUID(meetingId, "meetingId");

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
		this.validateRequiredString(meetingId, "meetingId");
		this.validateUUID(meetingId, "meetingId");

		return this.request(`/meetings/${meetingId}/active-session`);
	}

	/**
	 * Get active livestream for a meeting
	 */
	async getActiveLivestream(meetingId: string): Promise<{
		id: string;
		meeting_id: string;
		status: "LIVE" | "IDLE" | "ERRORED" | "INVOKED";
		name?: string;
		created_at: string;
		updated_at: string;
		disabled: boolean;
		ingest_server?: string;
		stream_key?: string;
		playback_url?: string;
		started_at?: string;
		viewer_count?: number;
	}> {
		this.validateRequiredString(meetingId, "meetingId");
		this.validateUUID(meetingId, "meetingId");

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
				const errorCode = (error as RealtimeKitError)?.code;
				// 404 means no active session, which is acceptable for stopping a meeting
				// 500 might indicate the session already ended or other server issues
				// We should not fail the entire stop operation for these cases
				if (errorCode === 404) {
					console.log("No active session to kick participants from (404)");
					results.participantsKicked = true;
				} else if (errorCode === 500) {
					console.warn(
						"Server error when kicking participants (500) - session may have already ended",
					);
					results.participantsKicked = true; // Don't fail the operation
					errors.push(
						"Server error when kicking participants (session may have already ended)",
					);
				} else {
					console.error("Failed to kick participants:", error);
					errors.push("Failed to kick participants");
					// Still mark as successful to not fail the entire operation
					results.participantsKicked = true;
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
				const errorCode = (error as RealtimeKitError)?.code;
				// 404 means no active session, 500 might mean session already ended
				if (errorCode === 404 || errorCode === 500) {
					console.log(`No active session for recordings check (${errorCode})`);
					results.recordingsStopped = true; // No active session means no recordings
				} else {
					console.error("Failed to check recordings:", error);
					errors.push("Failed to check recordings");
					// Don't fail the entire operation - assume no recordings to stop
					results.recordingsStopped = true;
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
				// 404 or 500 errors mean no active livestream or server issues
				const errorCode = (error as RealtimeKitError)?.code;
				if (errorCode === 404 || errorCode === 500) {
					console.log(`No active livestream to stop (${errorCode})`);
					results.livestreamsStopped = true;
				} else {
					console.error("Failed to stop livestream:", error);
					errors.push("Failed to stop livestream");
					// Don't fail the entire operation
					results.livestreamsStopped = true;
				}
			}

			const allSuccessful = Object.values(results).every((v) => v === true);
			const hasWarnings = errors.length > 0;

			return {
				success: allSuccessful,
				message: allSuccessful
					? hasWarnings
						? `Meeting stopped successfully with warnings: ${errors.join(", ")}`
						: "Meeting stopped successfully"
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
	}): Promise<{
		data: LivestreamObject[];
		paging?: PagingInfo;
	}> {
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
		return this.requestPaginated<LivestreamObject>(
			`/livestreams${query ? `?${query}` : ""}`,
		);
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
		paging?: PagingInfo;
	}> {
		if (!meetingId || typeof meetingId !== "string") {
			throw new Error("Valid meetingId is required");
		}

		const queryParams = new URLSearchParams();
		if (params?.page_no)
			queryParams.append("page_no", params.page_no.toString());
		if (params?.per_page)
			queryParams.append("per_page", params.per_page.toString());

		const query = queryParams.toString();
		return this.requestPaginated(
			`/meetings/${meetingId}/participants${query ? `?${query}` : ""}`,
		);
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
		paging?: PagingInfo;
	}> {
		const queryParams = new URLSearchParams();
		if (params?.meeting_id) queryParams.append("meeting_id", params.meeting_id);
		if (params?.page_no)
			queryParams.append("page_no", params.page_no.toString());
		if (params?.per_page)
			queryParams.append("per_page", params.per_page.toString());
		if (params?.status) queryParams.append("status", params.status);

		const query = queryParams.toString();
		return this.requestPaginated<Recording>(
			`/recordings${query ? `?${query}` : ""}`,
		);
	}

	/**
	 * Generate auth token for a participant to join a meeting
	 * This is an alias for addParticipant() that returns simplified response
	 */
	async generateAuthToken(params: {
		meetingId: string;
		participantName: string;
		presetName?: string;
		customParticipantId?: string;
		picture?: string;
	}): Promise<{
		token: string;
		participantId: string;
	}> {
		if (!params.meetingId || typeof params.meetingId !== "string") {
			throw new Error("Valid meetingId is required");
		}
		if (!params.participantName || typeof params.participantName !== "string") {
			throw new Error("Valid participantName is required");
		}

		const participant = await this.addParticipant(params.meetingId, {
			name: params.participantName,
			preset_name: params.presetName || "group_call_host",
			custom_participant_id:
				params.customParticipantId ||
				`participant_${Date.now()}_${crypto.randomUUID().slice(0, 9)}`,
			picture: params.picture,
		});

		return {
			token: participant.token,
			participantId: participant.id,
		};
	}

	/**
	 * Get sessions for an organization or meeting
	 */
	async getSessions(params?: {
		associated_id?: string;
		page_no?: number;
		per_page?: number;
		sort_by?: string;
		sort_order?: "ASC" | "DSC";
		start_time?: string;
		end_time?: string;
		participants?: string;
		status?: string;
		search?: string;
	}): Promise<{
		data: Array<SessionData>;
		paging?: PagingInfo;
	}> {
		try {
			const queryParams = new URLSearchParams();
			if (params?.associated_id)
				queryParams.append("associated_id", params.associated_id);
			if (params?.page_no)
				queryParams.append("page_no", params.page_no.toString());
			if (params?.per_page)
				queryParams.append("per_page", params.per_page.toString());
			if (params?.sort_by) queryParams.append("sort_by", params.sort_by);
			if (params?.sort_order)
				queryParams.append("sort_order", params.sort_order);
			if (params?.start_time)
				queryParams.append("start_time", params.start_time);
			if (params?.end_time) queryParams.append("end_time", params.end_time);
			if (params?.participants)
				queryParams.append("participants", params.participants);
			if (params?.status) queryParams.append("status", params.status);
			if (params?.search) queryParams.append("search", params.search);

			const query = queryParams.toString();
			const result = await this.requestPaginated<SessionRawData>(
				`/sessions${query ? `?${query}` : ""}`,
			);

			// Validate that result.data is an array before mapping
			if (!Array.isArray(result.data)) {
				console.warn("getSessions: API returned non-array data:", result.data);
				return {
					data: [],
					paging: result.paging || {
						total_count: 0,
						start_offset: 0,
						end_offset: 0,
					},
				};
			}

			// Normalize session data to handle different response field formats
			const normalizedSessions: SessionData[] = result.data.map(
				(session: SessionRawData): SessionData => ({
					id: session.id,
					status: session.status || "UNKNOWN",
					started_at: session.started_at || session.startedAt || "",
					ended_at: session.ended_at || session.endedAt || null,
					minutes_consumed:
						session.minutes_consumed || session.minutesConsumed || 0,
				}),
			);

			return {
				data: normalizedSessions,
				paging: result.paging,
			};
		} catch (error) {
			console.error("Error fetching sessions:", error);
			// Return empty result on error instead of throwing
			return {
				data: [],
				paging: {
					total_count: 0,
					start_offset: 0,
					end_offset: 0,
				},
			};
		}
	}

	/**
	 * Get chat messages for a session
	 */
	async getSessionChat(sessionId: string): Promise<{
		chatDownloadUrl: string;
		chatDownloadUrlExpiry: string;
	}> {
		if (!sessionId || typeof sessionId !== "string") {
			throw new Error("Valid sessionId is required");
		}

		try {
			const response = await this.request<ChatResponse>(
				`/sessions/${sessionId}/chat`,
			);

			// Handle different possible response structures
			// The request method already extracts data.data, so we should check response fields directly first
			let chatDownloadUrl = "";
			let chatDownloadUrlExpiry = "";

			// Check direct response fields first (most likely after request method processing)
			chatDownloadUrl =
				response.chat_download_url || response.chatDownloadUrl || "";
			chatDownloadUrlExpiry =
				response.chat_download_url_expiry ||
				response.chatDownloadUrlExpiry ||
				"";

			// Fallback to nested data structure if direct fields are empty
			if (!chatDownloadUrl && response.data) {
				chatDownloadUrl =
					response.data.chat_download_url ||
					response.data.chatDownloadUrl ||
					"";
				chatDownloadUrlExpiry =
					response.data.chat_download_url_expiry ||
					response.data.chatDownloadUrlExpiry ||
					"";
			}

			if (!chatDownloadUrl) {
				throw new Error("No chat download URL found in response");
			}

			return {
				chatDownloadUrl,
				chatDownloadUrlExpiry,
			};
		} catch (error) {
			console.error(`Error fetching chat for session ${sessionId}:`, error);
			throw error;
		}
	}

	/**
	 * CSV header field mapping for RealtimeKit chat export
	 */
	private static readonly CHAT_CSV_FIELDS = {
		ID: "id",
		PARTICIPANT_ID: "participantId",
		SESSION_ID: "sessionId",
		MEETING_ID: "meetingId",
		DISPLAY_NAME: "displayName",
		PINNED: "pinned",
		IS_EDITED: "isEdited",
		PAYLOAD_TYPE: "payloadType",
		PAYLOAD: "payload",
		CREATED_AT: "createdAt",
	} as const;

	/**
	 * Download and parse chat messages from CSV
	 * RealtimeKit CSV format: id,participantId,sessionId,meetingId,displayName,pinned,isEdited,payloadType,payload,createdAt
	 */
	async downloadChatMessages(
		downloadUrl: string,
	): Promise<ParsedChatMessage[]> {
		if (!downloadUrl || typeof downloadUrl !== "string") {
			throw new Error("Valid download URL is required");
		}

		try {
			const response = await fetch(downloadUrl);
			if (!response.ok) {
				throw new RealtimeKitError(
					response.status,
					`Failed to download chat messages: ${response.status} ${response.statusText}`,
					{
						method: "downloadChatMessages",
						endpoint: downloadUrl,
						retryable: [429, 500, 502, 503, 504].includes(response.status),
					},
				);
			}

			const csvText = await response.text();
			if (!csvText || typeof csvText !== "string") {
				throw new Error("Invalid CSV response: empty or non-string content");
			}

			const lines = csvText
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line.length > 0);

			if (lines.length === 0) {
				return [];
			}

			// Parse and validate header
			const headerFields = this.parseCSVLine(lines[0]);
			const indices = this.validateAndGetChatCsvIndices(headerFields);

			const messages: ParsedChatMessage[] = [];

			// Parse data rows (skip header)
			for (let i = 1; i < lines.length; i++) {
				try {
					const line = lines[i];
					if (!line) continue;

					const fields = this.parseCSVLine(line);
					const message = this.parseChatMessageRow(fields, indices, i);

					if (message) {
						messages.push(message);
					}
				} catch (error) {
					console.warn(
						`Skipping malformed CSV row ${i + 1}:`,
						error instanceof Error ? error.message : "Unknown error",
					);
				}
			}

			return messages;
		} catch (error) {
			if (error instanceof RealtimeKitError) {
				throw error;
			}

			throw new RealtimeKitError(
				500,
				`Error downloading chat messages: ${error instanceof Error ? error.message : "Unknown error"}`,
				{
					method: "downloadChatMessages",
					endpoint: downloadUrl,
				},
			);
		}
	}

	/**
	 * Validate CSV header and get field indices
	 */
	private validateAndGetChatCsvIndices(headerFields: string[]): ChatCsvIndices {
		const displayNameIndex = headerFields.indexOf(
			RealtimeKitClient.CHAT_CSV_FIELDS.DISPLAY_NAME,
		);
		const payloadIndex = headerFields.indexOf(
			RealtimeKitClient.CHAT_CSV_FIELDS.PAYLOAD,
		);
		const createdAtIndex = headerFields.indexOf(
			RealtimeKitClient.CHAT_CSV_FIELDS.CREATED_AT,
		);
		const payloadTypeIndex = headerFields.indexOf(
			RealtimeKitClient.CHAT_CSV_FIELDS.PAYLOAD_TYPE,
		);

		const missingFields: string[] = [];
		if (displayNameIndex === -1) missingFields.push("displayName");
		if (payloadIndex === -1) missingFields.push("payload");
		if (createdAtIndex === -1) missingFields.push("createdAt");
		if (payloadTypeIndex === -1) missingFields.push("payloadType");

		if (missingFields.length > 0) {
			throw new Error(
				`Required CSV fields not found: ${missingFields.join(", ")}. Available fields: ${headerFields.join(", ")}`,
			);
		}

		return {
			displayName: displayNameIndex,
			payload: payloadIndex,
			createdAt: createdAtIndex,
			payloadType: payloadTypeIndex,
		};
	}

	/**
	 * Parse a single chat message row from CSV fields
	 */
	private parseChatMessageRow(
		fields: string[],
		indices: ChatCsvIndices,
		rowNumber: number,
	): ParsedChatMessage | null {
		const maxIndex = Math.max(
			indices.displayName,
			indices.payload,
			indices.createdAt,
			indices.payloadType,
		);

		if (fields.length <= maxIndex) {
			throw new Error(
				`Row ${rowNumber} has insufficient fields (${fields.length}), expected at least ${maxIndex + 1}`,
			);
		}

		const payloadType = fields[indices.payloadType] || "";
		const message = fields[indices.payload] || "";
		const participantName = fields[indices.displayName] || "Unknown";
		const timestamp = fields[indices.createdAt] || "";

		// Only include text messages with actual content
		if (payloadType !== "TEXT_MESSAGE" || !message.trim()) {
			return null;
		}

		// Validate timestamp format
		if (timestamp && !this.isValidTimestamp(timestamp)) {
			console.warn(
				`Invalid timestamp format in row ${rowNumber}: ${timestamp}`,
			);
		}

		return {
			timestamp: timestamp.trim(),
			participantName: participantName.trim(),
			message: message.trim(),
		};
	}

	/**
	 * Validate timestamp format (basic ISO 8601 check)
	 */
	private isValidTimestamp(timestamp: string): boolean {
		try {
			const date = new Date(timestamp);
			return !Number.isNaN(date.getTime()) && timestamp.includes("T");
		} catch {
			return false;
		}
	}

	/**
	 * Retry a request with exponential backoff and jitter
	 *
	 * This method automatically retries failed requests that are marked as retryable
	 * (typically network errors and 5xx server errors). It uses exponential backoff
	 * with random jitter to avoid thundering herd problems.
	 *
	 * @param operation - The async operation to retry (should return a Promise)
	 * @param maxRetries - Maximum number of retry attempts (default: 3)
	 * @param baseDelay - Base delay in milliseconds for exponential backoff (default: 1000ms)
	 *
	 * @returns Promise resolving to the result of the successful operation
	 * @throws {RealtimeKitError} The final error if all retries are exhausted or error is not retryable
	 *
	 * @example
	 * ```typescript
	 * // Retry a meeting creation with custom retry settings
	 * const meeting = await client.retryRequest(
	 *   () => client.createMeeting({ title: "Important Meeting" }),
	 *   5,    // max 5 retries
	 *   2000  // start with 2 second delay
	 * );
	 *
	 * // Retry any operation
	 * const result = await client.retryRequest(async () => {
	 *   const response = await fetch('https://api.example.com/data');
	 *   return response.json();
	 * });
	 * ```
	 */
	async retryRequest<T>(
		operation: () => Promise<T>,
		maxRetries: number = 3,
		baseDelay: number = 1000,
	): Promise<T> {
		let lastError: Error;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error as Error;

				// Don't retry if it's not a RealtimeKitError or not retryable
				if (!(error instanceof RealtimeKitError) || !error.isRetryable) {
					throw error;
				}

				// Don't retry on the last attempt
				if (attempt === maxRetries) {
					throw error;
				}

				// Calculate delay with exponential backoff and jitter
				const delay = baseDelay * 2 ** attempt + Math.random() * 1000;
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		if (lastError) {
			throw lastError;
		}
		throw new Error("Operation failed after retries");
	}

	/**
	 * Wait for a meeting to reach a specific status with polling
	 *
	 * This method polls the meeting status until it reaches the target status
	 * or times out. Useful for waiting for meeting state changes after operations.
	 *
	 * @param meetingId - UUID of the meeting to monitor
	 * @param targetStatus - The status to wait for ("ACTIVE" or "INACTIVE")
	 * @param timeoutMs - Maximum time to wait in milliseconds (default: 30 seconds)
	 * @param pollIntervalMs - How often to check status in milliseconds (default: 1 second)
	 *
	 * @returns Promise resolving to the meeting object when target status is reached
	 * @throws {RealtimeKitError} When timeout is reached or other errors occur
	 *
	 * @example
	 * ```typescript
	 * // Wait for meeting to become active after creation
	 * const meeting = await client.createMeeting({ title: "My Meeting" });
	 * const activeMeeting = await client.waitForMeetingStatus(
	 *   meeting.id,
	 *   "ACTIVE",
	 *   60000 // wait up to 1 minute
	 * );
	 *
	 * console.log('Meeting is now active:', activeMeeting.status);
	 * ```
	 */
	async waitForMeetingStatus(
		meetingId: string,
		targetStatus: "ACTIVE" | "INACTIVE",
		timeoutMs: number = 30000,
		pollIntervalMs: number = 1000,
	): Promise<Meeting> {
		const startTime = Date.now();

		while (Date.now() - startTime < timeoutMs) {
			try {
				const meeting = await this.getMeeting(meetingId);
				if (meeting.status === targetStatus) {
					return meeting;
				}
			} catch (error) {
				// If it's a 404, the meeting might not exist yet, continue polling
				if (error instanceof RealtimeKitError && error.code !== 404) {
					throw error;
				}
			}

			await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
		}

		throw new RealtimeKitError(
			408,
			`Timeout waiting for meeting ${meetingId} to reach status ${targetStatus}`,
			{
				method: "waitForMeetingStatus",
				endpoint: `/meetings/${meetingId}`,
			},
		);
	}

	/**
	 * Wait for a recording to complete processing and become available for download
	 *
	 * Recordings go through several states: INVOKED → RECORDING → UPLOADING → UPLOADED.
	 * This method polls until the recording reaches UPLOADED status or fails.
	 *
	 * @param recordingId - UUID of the recording to monitor
	 * @param timeoutMs - Maximum time to wait in milliseconds (default: 5 minutes)
	 * @param pollIntervalMs - How often to check status in milliseconds (default: 5 seconds)
	 *
	 * @returns Promise resolving to the completed recording with download URLs
	 * @throws {RealtimeKitError} When timeout is reached, recording fails, or not found
	 *
	 * @example
	 * ```typescript
	 * // Start recording and wait for it to complete
	 * const recording = await client.startRecording({
	 *   meeting_id: 'meeting-uuid',
	 *   realtimekit_bucket_config: { enabled: true }
	 * });
	 *
	 * console.log('Recording started, waiting for completion...');
	 * const completedRecording = await client.waitForRecordingComplete(
	 *   recording.id,
	 *   600000 // wait up to 10 minutes
	 * );
	 *
	 * console.log('Recording ready:', completedRecording.download_url);
	 * ```
	 */
	async waitForRecordingComplete(
		recordingId: string,
		timeoutMs: number = 300000, // 5 minutes
		pollIntervalMs: number = 5000, // 5 seconds
	): Promise<Recording> {
		const startTime = Date.now();

		while (Date.now() - startTime < timeoutMs) {
			try {
				const recordings = await this.getRecordings();
				const recording = recordings.data.find((r) => r.id === recordingId);

				if (!recording) {
					throw new RealtimeKitError(
						404,
						`Recording ${recordingId} not found`,
						{
							method: "waitForRecordingComplete",
							endpoint: "/recordings",
						},
					);
				}

				if (recording.status === "UPLOADED") {
					return recording;
				}

				if (recording.status === "ERRORED") {
					throw new RealtimeKitError(
						500,
						`Recording ${recordingId} failed with error status`,
						{
							method: "waitForRecordingComplete",
							endpoint: "/recordings",
						},
					);
				}
			} catch (error) {
				if (error instanceof RealtimeKitError && error.code !== 404) {
					throw error;
				}
			}

			await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
		}

		throw new RealtimeKitError(
			408,
			`Timeout waiting for recording ${recordingId} to complete processing`,
			{
				method: "waitForRecordingComplete",
				endpoint: "/recordings",
			},
		);
	}

	/**
	 * Check if the client is properly configured
	 */
	isConfigured(): boolean {
		return !!(this.baseUrl && this.organizationId && this.apiKey);
	}

	/**
	 * Get client configuration info (without sensitive data)
	 */
	getClientInfo(): {
		baseUrl: string;
		hasOrganizationId: boolean;
		hasApiKey: boolean;
		isConfigured: boolean;
	} {
		return {
			baseUrl: this.baseUrl,
			hasOrganizationId: !!this.organizationId,
			hasApiKey: !!this.apiKey,
			isConfigured: this.isConfigured(),
		};
	}

	/**
	 * Generate high-quality recording configuration for podcasts and livestreams
	 *
	 * @param options - Recording quality options
	 * @param options.quality - Recording quality preset: "4k", "1080p", "720p", "podcast_audio"
	 * @param options.use_case - Use case: "podcast", "livestream", "interview"
	 * @param options.storage_config - Optional external storage configuration
	 * @param options.max_duration_hours - Maximum recording duration in hours (default: 4)
	 *
	 * @returns RecordingConfig optimized for high-quality local recording
	 *
	 * @example
	 * ```typescript
	 * // 4K recording for high-quality podcast
	 * const config = client.getHighQualityRecordingConfig({
	 *   quality: "4k",
	 *   use_case: "podcast",
	 *   max_duration_hours: 2
	 * });
	 *
	 * // Create meeting with 4K recording
	 * const meeting = await client.createMeeting({
	 *   title: "Podcast Episode 1",
	 *   record_on_start: true,
	 *   recording_config: config
	 * });
	 * ```
	 */
	getHighQualityRecordingConfig(options: {
		quality: "4k" | "1080p" | "720p" | "podcast_audio";
		use_case: "podcast" | "livestream" | "interview";
		storage_config?: StorageConfig;
		max_duration_hours?: number;
	}): RecordingConfig {
		const {
			quality,
			use_case,
			storage_config,
			max_duration_hours = 4,
		} = options;

		// Base configuration
		const config: RecordingConfig = {
			max_seconds: max_duration_hours * 3600, // Convert hours to seconds
			file_name_prefix: `${use_case}_${quality}_${new Date().toISOString().split("T")[0]}`,
		};

		// Configure video based on quality preset
		switch (quality) {
			case "4k":
				config.video_config = {
					codec: "H264",
					width: 3840,
					height: 2160,
					bitrate: 25000, // 25 Mbps for 4K
					frame_rate: 30,
					quality_preset: "ultra_hd",
					export_file: true,
				};
				break;
			case "1080p":
				config.video_config = {
					codec: "H264",
					width: 1920,
					height: 1080,
					bitrate: 8000, // 8 Mbps for 1080p
					frame_rate: 30,
					quality_preset: use_case === "podcast" ? "podcast" : "livestream",
					export_file: true,
				};
				break;
			case "720p":
				config.video_config = {
					codec: "H264",
					width: 1280,
					height: 720,
					bitrate: 5000, // 5 Mbps for 720p
					frame_rate: 30,
					quality_preset: "standard",
					export_file: true,
				};
				break;
			case "podcast_audio":
				// Audio-only configuration for podcast
				config.video_config = undefined;
				break;
		}

		// Configure audio based on use case
		switch (use_case) {
			case "podcast":
				config.audio_config = {
					codec: "AAC",
					channel: "stereo",
					bitrate: 320, // High-quality audio for podcast
					sample_rate: 48000, // Professional audio sample rate
					quality_preset: "podcast",
					export_file: true,
				};
				break;
			case "livestream":
				config.audio_config = {
					codec: "AAC",
					channel: "stereo",
					bitrate: 256, // Good quality for livestream
					sample_rate: 44100,
					quality_preset: "music",
					export_file: true,
				};
				break;
			case "interview":
				config.audio_config = {
					codec: "AAC",
					channel: "stereo",
					bitrate: 192, // Clear voice quality
					sample_rate: 44100,
					quality_preset: "voice",
					export_file: true,
				};
				break;
		}

		// Add storage configuration if provided
		if (storage_config) {
			config.storage_config = storage_config;
		} else {
			// Use RealtimeKit default storage for local recording
			config.realtimekit_bucket_config = { enabled: true };
		}

		return config;
	}

	/**
	 * Create a meeting optimized for podcast recording with 4K support
	 *
	 * @param options - Podcast meeting options
	 * @param options.title - Podcast episode title
	 * @param options.quality - Video quality: "4k", "1080p", "720p", "audio_only"
	 * @param options.duration_hours - Expected duration in hours (default: 2)
	 * @param options.auto_start_recording - Whether to start recording immediately (default: true)
	 * @param options.enable_transcription - Enable AI transcription (default: true)
	 * @param options.enable_summary - Enable AI summary (default: true)
	 *
	 * @returns Promise resolving to the created meeting optimized for podcast recording
	 *
	 * @example
	 * ```typescript
	 * // Create 4K podcast meeting
	 * const meeting = await client.createPodcastMeeting({
	 *   title: "Tech Talk Episode 5",
	 *   quality: "4k",
	 *   duration_hours: 1.5,
	 *   enable_transcription: true
	 * });
	 *
	 * console.log('Podcast meeting created:', meeting.id);
	 * ```
	 */
	async createPodcastMeeting(options: {
		title: string;
		quality?: "4k" | "1080p" | "720p" | "audio_only";
		duration_hours?: number;
		auto_start_recording?: boolean;
		enable_transcription?: boolean;
		enable_summary?: boolean;
	}): Promise<Meeting> {
		const {
			title,
			quality = "1080p",
			duration_hours = 2,
			auto_start_recording = true,
			enable_transcription = true,
			enable_summary = true,
		} = options;

		// Get high-quality recording configuration
		const recording_config = this.getHighQualityRecordingConfig({
			quality: quality === "audio_only" ? "podcast_audio" : quality,
			use_case: "podcast",
			max_duration_hours: duration_hours,
		});

		// Configure AI features for podcast
		const ai_config: AIConfig = {};
		if (enable_transcription) {
			ai_config.transcription = {
				language: "en-US",
				profanity_filter: false, // Allow natural speech for podcast
			};
		}
		if (enable_summary) {
			ai_config.summarization = {
				text_format: "markdown",
				summary_type: "interview", // Good for podcast format
				word_limit: 500,
			};
		}

		return this.createMeeting({
			title,
			preferred_region: "us-east-1", // Optimize for US-based recording
			record_on_start: auto_start_recording,
			recording_config,
			ai_config: Object.keys(ai_config).length > 0 ? ai_config : undefined,
			persist_chat: true, // Save chat for show notes
			summarize_on_end: enable_summary,
		});
	}

	/**
	 * Create a meeting optimized for livestreaming with high-quality recording
	 *
	 * @param options - Livestream meeting options
	 * @param options.title - Stream title
	 * @param options.quality - Video quality: "4k", "1080p", "720p"
	 * @param options.rtmp_url - RTMP endpoint for live streaming
	 * @param options.duration_hours - Expected duration in hours (default: 3)
	 * @param options.auto_start_recording - Whether to start recording immediately (default: true)
	 * @param options.auto_start_stream - Whether to start streaming immediately (default: false)
	 *
	 * @returns Promise resolving to the created meeting optimized for livestreaming
	 *
	 * @example
	 * ```typescript
	 * // Create 4K livestream meeting
	 * const meeting = await client.createLivestreamMeeting({
	 *   title: "Live Coding Session",
	 *   quality: "4k",
	 *   rtmp_url: "rtmps://live.youtube.com/live2/YOUR_KEY",
	 *   duration_hours: 2
	 * });
	 *
	 * console.log('Livestream meeting created:', meeting.id);
	 * ```
	 */
	async createLivestreamMeeting(options: {
		title: string;
		quality?: "4k" | "1080p" | "720p";
		rtmp_url?: string;
		duration_hours?: number;
		auto_start_recording?: boolean;
		auto_start_stream?: boolean;
	}): Promise<Meeting> {
		const {
			title,
			quality = "1080p",
			rtmp_url,
			duration_hours = 3,
			auto_start_recording = true,
			auto_start_stream = false,
		} = options;

		// Get high-quality recording configuration
		const recording_config = this.getHighQualityRecordingConfig({
			quality,
			use_case: "livestream",
			max_duration_hours: duration_hours,
		});

		// Add RTMP streaming configuration if provided
		if (rtmp_url) {
			recording_config.live_streaming_config = {
				rtmp_url,
			};
		}

		return this.createMeeting({
			title,
			preferred_region: "us-east-1", // Optimize for streaming
			record_on_start: auto_start_recording,
			live_stream_on_start: auto_start_stream,
			recording_config,
			persist_chat: true, // Save chat for engagement
		});
	}

	/**
	 * Create a meeting with simplified options for common use cases
	 *
	 * This is a convenience method that sets sensible defaults for most meeting scenarios.
	 * For advanced configuration, use the full `createMeeting()` method instead.
	 *
	 * @param title - Optional meeting title/name
	 * @param recordOnStart - Whether to automatically start recording when the meeting begins (default: false)
	 *
	 * @returns Promise resolving to the created meeting object
	 * @throws {RealtimeKitError} When the request fails or API returns an error
	 *
	 * @example
	 * ```typescript
	 * // Create a simple meeting
	 * const meeting = await client.createSimpleMeeting("Team Standup", true);
	 * console.log('Meeting created:', meeting.id);
	 *
	 * // Create without recording
	 * const meeting2 = await client.createSimpleMeeting("Client Call");
	 * ```
	 */
	async createSimpleMeeting(
		title?: string,
		recordOnStart: boolean = false,
	): Promise<Meeting> {
		return this.createMeeting({
			title,
			record_on_start: recordOnStart,
			preferred_region: "us-east-1", // Default to US East
		});
	}

	/**
	 * Join a meeting as a participant (convenience method)
	 *
	 * This combines adding a participant and generating their authentication token
	 * in a single call with reasonable defaults for common use cases.
	 *
	 * @param params - Join meeting parameters
	 * @param params.meetingId - UUID of the meeting to join
	 * @param params.participantName - Display name for the participant
	 * @param params.presetName - Meeting preset (default: "group_call_participant")
	 * @param params.picture - Optional profile picture URL
	 *
	 * @returns Promise resolving to join credentials and participant info
	 * @throws {RealtimeKitError} When the request fails or meeting doesn't exist
	 * @throws {Error} When required parameters are missing
	 *
	 * @example
	 * ```typescript
	 * // Join a meeting as a regular participant
	 * const joinInfo = await client.joinMeeting({
	 *   meetingId: 'meeting-uuid',
	 *   participantName: 'John Doe',
	 *   picture: 'https://example.com/avatar.jpg'
	 * });
	 *
	 * // Use in your frontend to join the meeting
	 * window.location.href = `/meeting/${meetingId}?token=${joinInfo.token}`;
	 *
	 * // Join as a host/moderator
	 * const hostInfo = await client.joinMeeting({
	 *   meetingId: 'meeting-uuid',
	 *   participantName: 'Jane Smith',
	 *   presetName: 'group_call_host'
	 * });
	 * ```
	 */
	async joinMeeting(params: {
		meetingId: string;
		participantName: string;
		presetName?: string;
		picture?: string;
	}): Promise<{
		token: string;
		participantId: string;
		meetingUrl?: string;
	}> {
		const result = await this.generateAuthToken({
			meetingId: params.meetingId,
			participantName: params.participantName,
			presetName: params.presetName || "group_call_participant",
			picture: params.picture,
		});

		return {
			token: result.token,
			participantId: result.participantId,
			// You could add a meetingUrl here if you have a frontend URL pattern
		};
	}

	/**
	 * Parse a CSV line handling quoted fields properly
	 */
	private parseCSVLine(line: string): string[] {
		if (typeof line !== "string") {
			throw new Error("CSV line must be a string");
		}

		const fields: string[] = [];
		let current = "";
		let inQuotes = false;
		let escapeNext = false;

		for (let i = 0; i < line.length; i++) {
			const char = line[i];

			if (escapeNext) {
				current += char;
				escapeNext = false;
				continue;
			}

			if (char === "\\" && inQuotes) {
				escapeNext = true;
				continue;
			}

			if (char === '"') {
				// Handle escaped quotes (double quotes)
				if (i + 1 < line.length && line[i + 1] === '"' && inQuotes) {
					current += '"';
					i++; // Skip the next quote
				} else {
					inQuotes = !inQuotes;
				}
			} else if (char === "," && !inQuotes) {
				fields.push(current);
				current = "";
			} else {
				current += char;
			}
		}

		// Don't forget the last field
		fields.push(current);

		// Remove surrounding quotes and validate
		return fields.map((field, index) => {
			if (typeof field !== "string") {
				throw new Error(`CSV field at index ${index} is not a string`);
			}
			return field.replace(/^"|"$/g, "").trim();
		});
	}

	/**
	 * Get session summary
	 */
	async getSessionSummary(sessionId: string): Promise<{
		sessionId: string;
		summaryDownloadUrl: string;
		summaryDownloadUrlExpiry: string;
	}> {
		if (!sessionId || typeof sessionId !== "string") {
			throw new Error("Valid sessionId is required");
		}

		const response = await this.request<{
			sessionId: string;
			summaryDownloadUrl: string;
			summaryDownloadUrlExpiry: string;
		}>(`/sessions/${sessionId}/summary`);
		return response;
	}

	/**
	 * Generate session summary
	 */
	async generateSessionSummary(sessionId: string): Promise<{
		message: string;
		status: string;
	}> {
		if (!sessionId || typeof sessionId !== "string") {
			throw new Error("Valid sessionId is required");
		}

		return this.request(`/sessions/${sessionId}/summary`, {
			method: "POST",
			body: JSON.stringify({}),
		});
	}

	/**
	 * Get session transcript download URL
	 */
	async getSessionTranscript(sessionId: string): Promise<{
		sessionId: string;
		transcript_download_url: string;
		transcript_download_url_expiry: string;
	}> {
		if (!sessionId || typeof sessionId !== "string") {
			throw new Error("Valid sessionId is required");
		}

		const response = await this.request<{
			sessionId: string;
			transcript_download_url: string;
			transcript_download_url_expiry: string;
		}>(`/sessions/${sessionId}/transcript`);
		return response;
	}
}

// Export a default instance for convenience
export const realtimeKitClient = new RealtimeKitClient();
