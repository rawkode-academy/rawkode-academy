// Retro 8-bit style sound effects using Web Audio API

let audioContext: AudioContext | null = null;

function getContext(): AudioContext {
	if (!audioContext) {
		audioContext = new AudioContext();
	}
	return audioContext;
}

function playTone(
	frequency: number,
	duration: number,
	type: OscillatorType = "square",
	volume: number = 0.3,
	frequencyEnd?: number
) {
	const ctx = getContext();
	const oscillator = ctx.createOscillator();
	const gainNode = ctx.createGain();

	oscillator.type = type;
	oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

	if (frequencyEnd) {
		oscillator.frequency.linearRampToValueAtTime(frequencyEnd, ctx.currentTime + duration);
	}

	gainNode.gain.setValueAtTime(volume, ctx.currentTime);
	gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

	oscillator.connect(gainNode);
	gainNode.connect(ctx.destination);

	oscillator.start(ctx.currentTime);
	oscillator.stop(ctx.currentTime + duration);
}

function playNoise(duration: number, volume: number = 0.2) {
	const ctx = getContext();
	const bufferSize = ctx.sampleRate * duration;
	const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
	const data = buffer.getChannelData(0);

	for (let i = 0; i < bufferSize; i++) {
		data[i] = Math.random() * 2 - 1;
	}

	const noise = ctx.createBufferSource();
	const gainNode = ctx.createGain();
	const filter = ctx.createBiquadFilter();

	noise.buffer = buffer;
	filter.type = "highpass";
	filter.frequency.value = 1000;

	gainNode.gain.setValueAtTime(volume, ctx.currentTime);
	gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

	noise.connect(filter);
	filter.connect(gainNode);
	gainNode.connect(ctx.destination);

	noise.start(ctx.currentTime);
}

export const sfx = {
	// Player attacks with an insult
	playerAttack() {
		playTone(440, 0.1, "square", 0.2);
		setTimeout(() => playTone(550, 0.1, "square", 0.15), 50);
	},

	// Enemy attacks with an insult
	enemyAttack() {
		playTone(220, 0.1, "sawtooth", 0.2);
		setTimeout(() => playTone(180, 0.15, "sawtooth", 0.15), 50);
	},

	// Effective comeback - hit lands
	effectiveHit() {
		playTone(600, 0.08, "square", 0.25);
		playTone(800, 0.08, "square", 0.2);
		setTimeout(() => playTone(1000, 0.15, "square", 0.3), 80);
	},

	// Ineffective comeback - blocked/failed
	ineffectiveHit() {
		playTone(200, 0.15, "square", 0.2, 100);
		playNoise(0.1, 0.15);
	},

	// Victory fanfare
	victory() {
		const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
		notes.forEach((freq, i) => {
			setTimeout(() => playTone(freq, 0.2, "square", 0.25), i * 150);
		});
		setTimeout(() => {
			playTone(1047, 0.4, "square", 0.3);
			playTone(784, 0.4, "triangle", 0.2);
		}, 600);
	},

	// Defeat sound
	defeat() {
		playTone(400, 0.2, "square", 0.25, 200);
		setTimeout(() => playTone(300, 0.2, "square", 0.2, 150), 200);
		setTimeout(() => playTone(200, 0.4, "square", 0.15, 100), 400);
	},

	// Button click
	click() {
		playTone(800, 0.05, "square", 0.1);
	},
};
