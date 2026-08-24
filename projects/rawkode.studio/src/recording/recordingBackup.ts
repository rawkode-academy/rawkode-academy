const databaseName = "rawkode-studio-recordings";
const databaseVersion = 2;
const storeName = "recording_chunks";
const metadataStoreName = "recording_metadata";

export type RecordingBackupIntegrity = "complete" | "gapped" | "unfinalized";

export interface RecordingBackup {
	contentType: string;
	createdAt: number;
	db: IDBDatabase;
	failedMessage: string;
	id: string;
	writes: Promise<void>;
}

export interface RecordingBackupChunkRow {
	chunk: Blob;
	chunkIndex: number;
	contentType?: string;
	createdAt?: number;
	recordingId: string;
}

export interface RecordingBackupMetadataRow {
	contentType: string;
	createdAt: number;
	errorMessage?: string;
	expectedChunkCount?: number;
	finalized: boolean;
	id: string;
}

export interface RecordingBackupArtifact {
	blob: Blob;
	chunkCount: number;
	contentType: string;
	createdAt: number;
	id: string;
	integrity: RecordingBackupIntegrity;
	size: number;
}

export interface RecordingBackupSummary {
	chunkCount: number;
	contentType: string;
	createdAt: number;
	id: string;
	integrity: RecordingBackupIntegrity;
	size: number;
}

export async function createRecordingBackup(
	contentType = "video/webm",
): Promise<RecordingBackup> {
	if (typeof indexedDB === "undefined") {
		throw new Error("Browser recording backup storage is unavailable.");
	}

	const createdAt = Date.now();
	const backup = {
		contentType,
		createdAt,
		db: await openRecordingBackupDatabase(),
		failedMessage: "",
		id: crypto.randomUUID(),
		writes: Promise.resolve(),
	};
	try {
		await putRecordingBackupMetadata(backup.db, {
			contentType,
			createdAt,
			finalized: false,
			id: backup.id,
		});
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
			contentType: backup.contentType,
			createdAt: backup.createdAt,
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

export async function listRecordingBackupArtifacts(): Promise<
	RecordingBackupSummary[]
> {
	const db = await openRecordingBackupDatabase();
	try {
		return summarizeRecordingBackupRows(
			await getAllRecordingBackupRows(db),
			await getAllRecordingBackupMetadata(db),
		);
	} finally {
		db.close();
	}
}

export async function readRecordingBackupArtifact(
	recordingId: string,
): Promise<RecordingBackupArtifact | null> {
	const db = await openRecordingBackupDatabase();
	try {
		const rows = await getRecordingBackupRowsById(db, recordingId);
		if (rows.length === 0) {
			return null;
		}
		const metadata = await getRecordingBackupMetadata(db, recordingId);
		const [summary] = summarizeRecordingBackupRows(rows, metadata ? [metadata] : []);
		if (!summary) {
			return null;
		}
		rows.sort((left, right) => left.chunkIndex - right.chunkIndex);
		return {
			...summary,
			blob: new Blob(
				rows.map((row) => row.chunk),
				{ type: summary.contentType },
			),
		};
	} finally {
		db.close();
	}
}

export async function deleteRecordingBackupArtifact(
	recordingId: string,
): Promise<void> {
	const db = await openRecordingBackupDatabase();
	try {
		await deleteRecordingBackupRowsById(db, recordingId);
	} finally {
		db.close();
	}
}

export function summarizeRecordingBackupRows(
	rows: readonly RecordingBackupChunkRow[],
	metadataRows: readonly RecordingBackupMetadataRow[] = [],
): RecordingBackupSummary[] {
	const metadataById = new Map(metadataRows.map((metadata) => [metadata.id, metadata]));
	const recordings = new Map<string, RecordingBackupChunkRow[]>();
	for (const row of rows) {
		const recordingRows = recordings.get(row.recordingId) ?? [];
		recordingRows.push(row);
		recordings.set(row.recordingId, recordingRows);
	}

	return [...recordings]
			.map(([id, recordingRows]) => {
				const metadata = metadataById.get(id);
				const chunkIndexes = recordingRows
					.map((row) => row.chunkIndex)
					.sort((left, right) => left - right);
				const inferredChunkCount = (chunkIndexes.at(-1) ?? -1) + 1;
				const expectedChunkCount = metadata?.expectedChunkCount ?? inferredChunkCount;
				const hasGaps = expectedChunkCount !== recordingRows.length ||
					chunkIndexes.some((chunkIndex, index) => chunkIndex !== index);
				const firstRow = recordingRows.reduce((earliest, row) =>
				row.chunkIndex < earliest.chunkIndex ? row : earliest,
			);
				return {
					chunkCount: recordingRows.length,
					contentType:
						metadata?.contentType || firstRow.contentType || firstRow.chunk.type || "video/webm",
					createdAt: metadata?.createdAt ?? recordingRows.reduce(
					(earliest, row) => Math.min(earliest, row.createdAt ?? 0),
					firstRow.createdAt ?? 0,
				),
					id,
					integrity: hasGaps
						? "gapped" as const
						: metadata?.finalized && !metadata.errorMessage
							? "complete" as const
							: "unfinalized" as const,
					size: recordingRows.reduce((size, row) => size + row.chunk.size, 0),
			};
		})
		.sort(
			(left, right) =>
				right.createdAt - left.createdAt || left.id.localeCompare(right.id),
		);
}

export async function finalizeRecordingBackup(
	backup: RecordingBackup | undefined,
	expectedChunkCount: number,
	errorMessage = "",
): Promise<void> {
	if (!backup) return;

	await backup.writes.catch(() => undefined);
	const persistedError = errorMessage || backup.failedMessage;
	await putRecordingBackupMetadata(backup.db, {
		contentType: backup.contentType,
		createdAt: backup.createdAt,
		errorMessage: persistedError || undefined,
		expectedChunkCount: Math.max(0, Math.floor(expectedChunkCount)),
		finalized: !persistedError,
		id: backup.id,
	});
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
	await deleteRecordingBackupRows(backup);
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

function openRecordingBackupDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		let wasBlocked = false;
		const request = indexedDB.open(databaseName, databaseVersion);
		request.onerror = () => reject(request.error);
		request.onblocked = () => {
			wasBlocked = true;
			reject(new Error(
				"Recording backup storage upgrade is blocked by another Studio tab. Close other Studio tabs and try again.",
			));
		};
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
			if (wasBlocked) {
				request.result.close();
				return;
			}
			request.result.onversionchange = () => request.result.close();
			resolve(request.result);
		};
	});
}

async function putRecordingBackupMetadata(
	db: IDBDatabase,
	row: RecordingBackupMetadataRow,
): Promise<void> {
	const transaction = db.transaction(metadataStoreName, "readwrite");
	transaction.objectStore(metadataStoreName).put(row);
	await transactionComplete(transaction);
}

async function getAllRecordingBackupMetadata(
	db: IDBDatabase,
): Promise<RecordingBackupMetadataRow[]> {
	const transaction = db.transaction(metadataStoreName, "readonly");
	const rows = await requestResult<RecordingBackupMetadataRow[]>(
		transaction.objectStore(metadataStoreName).getAll(),
	);
	await transactionComplete(transaction);
	return rows;
}

async function getRecordingBackupMetadata(
	db: IDBDatabase,
	recordingId: string,
): Promise<RecordingBackupMetadataRow | undefined> {
	const transaction = db.transaction(metadataStoreName, "readonly");
	const row = await requestResult<RecordingBackupMetadataRow | undefined>(
		transaction.objectStore(metadataStoreName).get(recordingId),
	);
	await transactionComplete(transaction);
	return row;
}

async function putRecordingBackupChunk(
	backup: RecordingBackup,
	row: RecordingBackupChunkRow,
): Promise<void> {
	const transaction = backup.db.transaction(storeName, "readwrite");
	const store = transaction.objectStore(storeName);
	store.put(row);
	await transactionComplete(transaction);
}

async function getRecordingBackupRows(
	backup: RecordingBackup,
): Promise<RecordingBackupChunkRow[]> {
	return await getRecordingBackupRowsById(backup.db, backup.id);
}

async function getAllRecordingBackupRows(
	db: IDBDatabase,
): Promise<RecordingBackupChunkRow[]> {
	const transaction = db.transaction(storeName, "readonly");
	const store = transaction.objectStore(storeName);
	const rows = await requestResult<RecordingBackupChunkRow[]>(store.getAll());
	await transactionComplete(transaction);
	return rows;
}

async function getRecordingBackupRowsById(
	db: IDBDatabase,
	recordingId: string,
): Promise<RecordingBackupChunkRow[]> {
	const transaction = db.transaction(storeName, "readonly");
	const store = transaction.objectStore(storeName);
	const rows = await requestResult<RecordingBackupChunkRow[]>(
		store.getAll(recordingBackupRange(recordingId)),
	);
	await transactionComplete(transaction);
	return rows;
}

async function deleteRecordingBackupRows(
	backup: RecordingBackup,
): Promise<void> {
	await deleteRecordingBackupRowsById(backup.db, backup.id);
}

async function deleteRecordingBackupRowsById(
	db: IDBDatabase,
	recordingId: string,
): Promise<void> {
	const transaction = db.transaction([storeName, metadataStoreName], "readwrite");
	const store = transaction.objectStore(storeName);
	store.delete(recordingBackupRange(recordingId));
	transaction.objectStore(metadataStoreName).delete(recordingId);
	await transactionComplete(transaction);
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
