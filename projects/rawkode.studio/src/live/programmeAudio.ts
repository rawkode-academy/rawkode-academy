export interface ProgrammeAudioMix {
	stream: MediaStream;
	update: (streams: Iterable<MediaStream>) => void;
	resume: () => Promise<void>;
	close: () => void;
}

// WHIP carries one audio track. Keep that track stable as contributors join
// and leave, and never connect the mix to the operator's speakers.
export function createProgrammeAudioMix(
	streams: Iterable<MediaStream>,
): ProgrammeAudioMix {
	const context = new AudioContext();
	const sources = new Map<MediaStreamTrack, MediaStreamAudioSourceNode>();
	let destination: MediaStreamAudioDestinationNode | undefined;
	let closed = false;
	const close = () => {
		if (closed) return;
		closed = true;
		for (const source of sources.values()) source.disconnect();
		sources.clear();
		for (const track of destination?.stream.getTracks() ?? []) track.stop();
		void context.close().catch(() => undefined);
	};
	const update = (nextStreams: Iterable<MediaStream>) => {
		if (closed || !destination) return;
		const tracks = new Set(
			[...nextStreams].flatMap((stream) => stream.getAudioTracks())
				.filter((track) => track.readyState === "live"),
		);
		for (const [track, source] of sources) {
			if (tracks.has(track)) continue;
			source.disconnect();
			sources.delete(track);
		}
		for (const track of tracks) {
			if (sources.has(track)) continue;
			const source = context.createMediaStreamSource(new MediaStream([track]));
			source.connect(destination);
			sources.set(track, source);
		}
	};

	try {
		destination = context.createMediaStreamDestination();
		update(streams);
		return {
			stream: destination.stream,
			update,
			resume: () => context.resume(),
			close,
		};
	} catch (error) {
		close();
		throw error;
	}
}
