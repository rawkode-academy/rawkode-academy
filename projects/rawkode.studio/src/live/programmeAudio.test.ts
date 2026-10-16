import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";
import { createProgrammeAudioMix } from "./programmeAudio";

class AudioTrack {
	kind = "audio";
	readyState = "live";
	stops = 0;
	stop() { this.stops += 1; }
}

class Stream {
	tracks: AudioTrack[];
	constructor(tracks: AudioTrack[] = []) { this.tracks = tracks; }
	getAudioTracks() { return this.tracks; }
	getTracks() { return this.tracks; }
}

class AudioSource {
	stream: Stream;
	connections: unknown[] = [];
	disconnects = 0;
	constructor(stream: Stream) { this.stream = stream; }
	connect(destination: unknown) { this.connections.push(destination); }
	disconnect() { this.disconnects += 1; }
}

const contexts: Context[] = [];
class Context {
	output = { stream: new Stream([new AudioTrack()]) };
	sources: AudioSource[] = [];
	closes = 0;
	resumes = 0;
	constructor() { contexts.push(this); }
	createMediaStreamDestination() { return this.output; }
	createMediaStreamSource(stream: Stream) {
		const source = new AudioSource(stream);
		this.sources.push(source);
		return source;
	}
	async resume() { this.resumes += 1; }
	async close() { this.closes += 1; }
}

const originalContext = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
const originalStream = Object.getOwnPropertyDescriptor(globalThis, "MediaStream");
function installMedia() {
	Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: Context });
	Object.defineProperty(globalThis, "MediaStream", { configurable: true, value: Stream });
	contexts.length = 0;
}
function media(...tracks: AudioTrack[]): MediaStream {
	return new Stream(tracks) as unknown as MediaStream;
}

afterEach(() => {
	for (const [name, descriptor] of [
		["AudioContext", originalContext], ["MediaStream", originalStream],
	] as const) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else Reflect.deleteProperty(globalThis, name);
	}
});

describe("programme audio", () => {
	it("mixes contributors into one track without doubling shared microphones", async () => {
		installMedia();
		const host = new AudioTrack();
		const guest = new AudioTrack();
		const ended = new AudioTrack();
		ended.readyState = "ended";
		const mix = createProgrammeAudioMix([media(host, ended), media(host, guest)]);
		const context = contexts[0]!;
		assert.equal(mix.stream.getAudioTracks().length, 1);
		assert.deepEqual(context.sources.map((source) => source.stream.tracks), [[host], [guest]]);
		assert.ok(context.sources.every((source) => source.connections[0] === context.output));
		await mix.resume();
		assert.equal(context.resumes, 1);
		mix.close();
	});

	it("keeps the output track stable when contributors join and leave", () => {
		installMedia();
		const mix = createProgrammeAudioMix([]);
		const outputTrack = mix.stream.getAudioTracks()[0];
		const host = new AudioTrack();
		const guest = new AudioTrack();
		mix.update([media(host)]);
		mix.update([media(host, guest)]);
		mix.update([media(guest)]);
		assert.equal(mix.stream.getAudioTracks()[0], outputTrack);
		assert.equal(contexts[0]!.sources.length, 2);
		assert.equal(contexts[0]!.sources[0]!.disconnects, 1);
		assert.equal(contexts[0]!.sources[1]!.disconnects, 0);
		assert.equal(host.stops, 0);
		assert.equal(guest.stops, 0);
		mix.close();
	});

	it("releases only its own resources when recording and live output share microphones", () => {
		installMedia();
		const host = new AudioTrack();
		const recording = createProgrammeAudioMix([media(host)]);
		const live = createProgrammeAudioMix([media(host)]);
		recording.close();
		recording.close();
		recording.update([media(new AudioTrack())]);
		assert.equal(contexts[0]!.closes, 1);
		assert.equal(contexts[0]!.sources[0]!.disconnects, 1);
		assert.equal(contexts[0]!.output.stream.tracks[0]!.stops, 1);
		assert.equal(contexts[1]!.closes, 0);
		assert.equal(contexts[1]!.output.stream.tracks[0]!.stops, 0);
		assert.equal(host.stops, 0);
		live.close();
	});

	it("cleans up the mixer if constructing an audio source fails", () => {
		installMedia();
		class FailingContext extends Context {
			createMediaStreamSource(): AudioSource { throw new Error("Cannot create source"); }
		}
		Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: FailingContext });
		const host = new AudioTrack();
		assert.throws(() => createProgrammeAudioMix([media(host)]), /Cannot create source/);
		assert.equal(contexts[0]!.closes, 1);
		assert.equal(contexts[0]!.output.stream.tracks[0]!.stops, 1);
		assert.equal(host.stops, 0);
	});
});
