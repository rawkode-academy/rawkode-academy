export interface RecordingUploadBuffer {
	chunks: Blob[];
	contentType: string;
	size: number;
}

export function createRecordingUploadBuffer(
	contentType = "video/webm",
): RecordingUploadBuffer {
	return {
		chunks: [],
		contentType,
		size: 0,
	};
}

export function appendRecordingUploadChunk(
	buffer: RecordingUploadBuffer,
	chunk: Blob,
	partSizeBytes: number,
): Blob[] {
	buffer.chunks.push(chunk);
	buffer.size += chunk.size;

	const parts: Blob[] = [];
	while (buffer.size >= partSizeBytes) {
		parts.push(takeRecordingUploadPart(buffer, partSizeBytes));
	}

	return parts;
}

export function flushRecordingUploadRemainder(
	buffer: RecordingUploadBuffer,
): Blob | null {
	if (buffer.size === 0) {
		return null;
	}

	return takeRecordingUploadPart(buffer, buffer.size);
}

function takeRecordingUploadPart(
	buffer: RecordingUploadBuffer,
	partSizeBytes: number,
): Blob {
	let remaining = partSizeBytes;
	const partChunks: Blob[] = [];

	while (remaining > 0) {
		const chunk = buffer.chunks.shift();
		if (!chunk) {
			throw new Error("Recording upload buffer underflow.");
		}

		if (chunk.size <= remaining) {
			partChunks.push(chunk);
			remaining -= chunk.size;
			continue;
		}

		partChunks.push(chunk.slice(0, remaining, buffer.contentType));
		buffer.chunks.unshift(chunk.slice(remaining, chunk.size, buffer.contentType));
		remaining = 0;
	}

	buffer.size -= partSizeBytes;
	return new Blob(partChunks, { type: buffer.contentType });
}
