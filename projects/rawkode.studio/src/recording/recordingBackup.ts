const databaseName = "rawkode-studio-recordings";
const storeName = "recording_chunks";
const metadataStoreName = "recording_metadata";
const databaseVersion = 2;

export interface RecordingBackup {
	chunkCount: number;
	contentType: string;
	createdAt: number;
	db: IDBDatabase;
	failedMessage: string;
	id: string;
	sizeBytes: number;
	updatedAt: number;
	writes: Promise<void>;
}

export interface RecordingBackupChunkRow {
	chunk: Blob;
	chunkIndex: number;
	recordingId: string;
}

export interface RecordingBackupMetadataRow {
	chunkCount: number;
	contentType: string;
	createdAt: number;
	id: string;
	sizeBytes: number;
	updatedAt: number;
}

export interface RecordingBackupSummary {
	chunkCount: number;
	contentType: string;
	createdAt: number | null;
	id: string;
	isLegacy: boolean;
	sizeBytes: number | null;
	updatedAt: number | null;
}

export async function createRecordingBackup(
	contentType = "video/webm",
): Promise<RecordingBackup> {
	if (typeof indexedDB === "undefined") {
		throw new Error("Browser recording backup storage is unavailable.");
	}

	const now = Date.now();
	const backup: RecordingBackup = {
		chunkCount: 0,
		contentType,
		db: await openRecordingBackupDatabase(),
		createdAt: now,
		failedMessage: "",
		id: crypto.randomUUID(),
		sizeBytes: 0,
		updatedAt: now,
		writes: Promise.resolve(),
	};
	try {
		await putRecordingBackupMetadata(backup.db, toMetadataRow(backup));
		return backup;
	} catch (error) {
		backup.db.close();
		throw error;
	}
}

export function appendRecordingBackupChunk(
	backup: RecordingBackup,
	chunkIndex: number,
	chunk: Blob,
): Promise<void> {
	const write = backup.writes.then(() => {
		if (backup.failedMessage) {
			throw new Error(backup.failedMessage);
		}
		return putRecordingBackupChunk(backup, {
			chunk,
			chunkIndex,
			recordingId: backup.id,
		});
	});
	backup.writes = write.catch((error: unknown) => {
			backup.failedMessage =
				error instanceof Error
					? error.message
					: "Browser recording backup storage failed.";
	});
	return write;
}

export async function readRecordingBackupBlob(
	backup: RecordingBackup | undefined,
): Promise<Blob | null> {
	if (!backup) {
		return null;
	}
	const rows = await readRecordingBackupChunks(backup);
	if (rows.length === 0) {
		return null;
	}

	rows.sort((left, right) => left.chunkIndex - right.chunkIndex);
	return new Blob(rows.map((row) => row.chunk), {
		type: backup.contentType,
	});
}

export async function listRecordingBackups(): Promise<RecordingBackupSummary[]> {
	if (typeof indexedDB === "undefined") {
		return [];
	}

	const db = await openRecordingBackupDatabase();
	try {
		const transaction = db.transaction(
			[storeName, metadataStoreName],
			"readonly",
		);
		const metadataRequest = transaction
			.objectStore(metadataStoreName)
			.getAll() as IDBRequest<RecordingBackupMetadataRow[]>;
		const chunkKeysRequest = transaction
			.objectStore(storeName)
			.getAllKeys();
		const [metadataRows, chunkKeys] = await Promise.all([
			requestResult(metadataRequest),
			requestResult(chunkKeysRequest),
		]);
		await transactionComplete(transaction);
		return buildRecordingBackupSummaries(metadataRows, chunkKeys);
	} finally {
		db.close();
	}
}

export async function readPersistedRecordingBackupBlob(
	recordingId: string,
): Promise<Blob | null> {
	assertRecordingBackupId(recordingId);
	if (typeof indexedDB === "undefined") {
		throw new Error("Browser recording backup storage is unavailable.");
	}

	const db = await openRecordingBackupDatabase();
	try {
		const transaction = db.transaction(
			[storeName, metadataStoreName],
			"readonly",
		);
		const metadataRequest = transaction
			.objectStore(metadataStoreName)
			.get(recordingId) as IDBRequest<RecordingBackupMetadataRow | undefined>;
		const chunksRequest = transaction
			.objectStore(storeName)
			.getAll(recordingBackupRange(recordingId)) as IDBRequest<
			RecordingBackupChunkRow[]
		>;
		const [metadata, chunks] = await Promise.all([
			requestResult(metadataRequest),
			requestResult(chunksRequest),
		]);
		await transactionComplete(transaction);

		if (chunks.length === 0) {
			return null;
		}
		chunks.sort((left, right) => left.chunkIndex - right.chunkIndex);
		return new Blob(
			chunks.map((row) => row.chunk),
			{
				type: metadata?.contentType ?? chunks[0]?.chunk.type ?? "video/webm",
			},
		);
	} finally {
		db.close();
	}
}

export async function deletePersistedRecordingBackup(
	recordingId: string,
): Promise<void> {
	assertRecordingBackupId(recordingId);
	if (typeof indexedDB === "undefined") {
		throw new Error("Browser recording backup storage is unavailable.");
	}

	const db = await openRecordingBackupDatabase();
	try {
		await deleteRecordingBackupRows(db, recordingId);
	} finally {
		db.close();
	}
}

export async function readRecordingBackupChunks(
	backup: RecordingBackup | undefined,
): Promise<RecordingBackupChunkRow[]> {
	if (!backup) {
		return [];
	}

	await backup.writes.catch(() => undefined);
	return await getRecordingBackupRows(backup);
}

export async function deleteRecordingBackup(
	backup: RecordingBackup | undefined,
): Promise<void> {
	if (!backup) {
		return;
	}

	await backup.writes.catch(() => undefined);
	await deleteRecordingBackupRows(backup.db, backup.id);
	backup.db.close();
}

export async function closeRecordingBackup(
	backup: RecordingBackup | undefined,
): Promise<void> {
	if (!backup) {
		return;
	}

	await backup.writes.catch(() => undefined);
	backup.db.close();
}

export function buildRecordingBackupSummaries(
	metadataRows: RecordingBackupMetadataRow[],
	chunkKeys: IDBValidKey[],
): RecordingBackupSummary[] {
	const chunkCounts = new Map<string, number>();
	for (const key of chunkKeys) {
		if (!Array.isArray(key) || typeof key[0] !== "string") {
			continue;
		}
		chunkCounts.set(key[0], (chunkCounts.get(key[0]) ?? 0) + 1);
	}

	const summaries = new Map<string, RecordingBackupSummary>();
	for (const metadata of metadataRows) {
		const chunkCount = chunkCounts.get(metadata.id) ?? metadata.chunkCount;
		if (chunkCount === 0) {
			continue;
		}
		summaries.set(metadata.id, {
			chunkCount,
			contentType: metadata.contentType,
			createdAt: metadata.createdAt,
			id: metadata.id,
			isLegacy: false,
			sizeBytes: metadata.sizeBytes,
			updatedAt: metadata.updatedAt,
		});
	}

	for (const [id, chunkCount] of chunkCounts) {
		if (summaries.has(id)) {
			continue;
		}
		summaries.set(id, {
			chunkCount,
			contentType: "video/webm",
			createdAt: null,
			id,
			isLegacy: true,
			sizeBytes: null,
			updatedAt: null,
		});
	}

	return [...summaries.values()].sort(
		(left, right) =>
			(right.updatedAt ?? right.createdAt ?? 0) -
			(left.updatedAt ?? left.createdAt ?? 0),
	);
}

function openRecordingBackupDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(databaseName, databaseVersion);
		request.onerror = () => reject(request.error);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(storeName)) {
				db.createObjectStore(storeName, {
					keyPath: ["recordingId", "chunkIndex"],
				});
			}
			if (!db.objectStoreNames.contains(metadataStoreName)) {
				db.createObjectStore(metadataStoreName, { keyPath: "id" });
			}
		};
		request.onsuccess = () => {
			const db = request.result;
			db.onversionchange = () => db.close();
			resolve(db);
		};
	});
}

async function putRecordingBackupChunk(
	backup: RecordingBackup,
	row: RecordingBackupChunkRow,
): Promise<void> {
	const transaction = backup.db.transaction(
		[storeName, metadataStoreName],
		"readwrite",
	);
	const updatedAt = Date.now();
	const metadata = toMetadataRow({
		...backup,
		chunkCount: backup.chunkCount + 1,
		sizeBytes: backup.sizeBytes + row.chunk.size,
		updatedAt,
	});
	transaction.objectStore(storeName).put(row);
	transaction.objectStore(metadataStoreName).put(metadata);
	await transactionComplete(transaction);
	backup.chunkCount = metadata.chunkCount;
	backup.sizeBytes = metadata.sizeBytes;
	backup.updatedAt = metadata.updatedAt;
}

async function putRecordingBackupMetadata(
	db: IDBDatabase,
	metadata: RecordingBackupMetadataRow,
): Promise<void> {
	const transaction = db.transaction(metadataStoreName, "readwrite");
	transaction.objectStore(metadataStoreName).put(metadata);
	await transactionComplete(transaction);
}

async function getRecordingBackupRows(
	backup: RecordingBackup,
): Promise<RecordingBackupChunkRow[]> {
	const transaction = backup.db.transaction(storeName, "readonly");
	const store = transaction.objectStore(storeName);
	const rows = await requestResult<RecordingBackupChunkRow[]>(
		store.getAll(recordingBackupRange(backup.id)),
	);
	await transactionComplete(transaction);
	return rows;
}

async function deleteRecordingBackupRows(
	db: IDBDatabase,
	recordingId: string,
): Promise<void> {
	const transaction = db.transaction(
		[storeName, metadataStoreName],
		"readwrite",
	);
	transaction.objectStore(storeName).delete(recordingBackupRange(recordingId));
	transaction.objectStore(metadataStoreName).delete(recordingId);
	await transactionComplete(transaction);
}

function toMetadataRow(
	backup: Pick<
		RecordingBackup,
		"chunkCount" | "contentType" | "createdAt" | "id" | "sizeBytes" | "updatedAt"
	>,
): RecordingBackupMetadataRow {
	return {
		chunkCount: backup.chunkCount,
		contentType: backup.contentType,
		createdAt: backup.createdAt,
		id: backup.id,
		sizeBytes: backup.sizeBytes,
		updatedAt: backup.updatedAt,
	};
}

function assertRecordingBackupId(recordingId: string): void {
	if (!recordingId.trim()) {
		throw new Error("Recording backup id is required.");
	}
}

function recordingBackupRange(recordingId: string): IDBKeyRange {
	return IDBKeyRange.bound(
		[recordingId, 0],
		[recordingId, Number.MAX_SAFE_INTEGER],
	);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
	});
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.onerror = () => reject(transaction.error);
		transaction.onabort = () => reject(transaction.error);
		transaction.oncomplete = () => resolve();
	});
}
