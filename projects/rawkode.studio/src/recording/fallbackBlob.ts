export interface RecordingFallbackChunk {
	chunk: Blob;
	chunkIndex: number;
}

export function createRecordingFallbackBlob(
	chunks: RecordingFallbackChunk[],
	contentType = "video/webm",
): Blob | null {
	if (chunks.length === 0) {
		return null;
	}

	return new Blob(
		[...chunks]
			.sort((left, right) => left.chunkIndex - right.chunkIndex)
			.map((row) => row.chunk),
		{ type: contentType },
	);
}
