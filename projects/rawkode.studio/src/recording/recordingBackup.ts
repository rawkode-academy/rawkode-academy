const databaseName = "rawkode-studio-recordings";
const storeName = "recording_chunks";

export interface RecordingBackup {
	contentType: string;
	db: IDBDatabase;
	failedMessage: string;
	id: string;
	writes: Promise<void>;
}

export interface RecordingBackupChunkRow {
	chunk: Blob;
	chunkIndex: number;
	recordingId: string;
}

export async function createRecordingBackup(
	contentType = "video/webm",
): Promise<RecordingBackup> {
	if (typeof indexedDB === "undefined") {
		throw new Error("Browser recording backup storage is unavailable.");
	}

	return {
		contentType,
		db: await openRecordingBackupDatabase(),
		failedMessage: "",
		id: crypto.randomUUID(),
		writes: Promise.resolve(),
	};
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

function openRecordingBackupDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(databaseName, 1);
		request.onerror = () => reject(request.error);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(storeName)) {
				db.createObjectStore(storeName, {
					keyPath: ["recordingId", "chunkIndex"],
				});
			}
		};
		request.onsuccess = () => resolve(request.result);
	});
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
	const transaction = backup.db.transaction(storeName, "readonly");
	const store = transaction.objectStore(storeName);
	const rows = await requestResult<RecordingBackupChunkRow[]>(
		store.getAll(recordingBackupRange(backup.id)),
	);
	await transactionComplete(transaction);
	return rows;
}

async function deleteRecordingBackupRows(
	backup: RecordingBackup,
): Promise<void> {
	const transaction = backup.db.transaction(storeName, "readwrite");
	const store = transaction.objectStore(storeName);
	store.delete(recordingBackupRange(backup.id));
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
