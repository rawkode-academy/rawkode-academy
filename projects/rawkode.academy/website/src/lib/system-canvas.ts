/**
 * The homepage's living system: a small cluster drawn on the hero's 4rem
 * grid. Nodes and pods sit on grid intersections and talk over routes that
 * follow the grid lines. Break a pod, or a whole node, and the scheduler
 * places the work somewhere healthy.
 *
 * It is decoration with a point of view, so it never covers content (every
 * element marked `data-system-avoid` is kept clear) and it stops drawing when
 * the hero is off screen or the tab is hidden. It moves for five seconds
 * after load or the last pointer interaction, with one failure of its own so
 * the behaviour is seen once, then holds a still frame (WCAG 2.2.2). With
 * reduced motion it only ever renders still frames: a few packets at rest
 * on their routes, no autonomous failure, instant moves.
 */

type Point = { x: number; y: number };
/** Every route is one L: out along one grid line, then along the other. */
type Route = readonly [from: Point, corner: Point, to: Point];

interface Node extends Point {
	id: number;
	name: string;
	ready: boolean;
	downAt: number;
}

type PodPhase = "running" | "failing" | "terminating" | "pending";

interface Pod extends Point {
	name: string;
	node: Node;
	phase: PodPhase;
	since: number;
	route: Route;
	/** 0 → 1, how much of the route to its node is drawn. */
	link: number;
	packet: number;
	packetSpeed: number;
}

interface Palette {
	text: string;
	soft: string;
	muted: string;
	accent: string;
	ground: string;
	font: string;
}

const FAIL_MS = 650;
const TERMINATE_MS = 320;
const SCHEDULE_MS = 520;
const NODE_DOWN_MS = 4200;
/** How long the system moves after load or the last pointer interaction. */
const RUN_MS = 5000;
/** The first and only failure nobody asked for. */
const FIRST_FAILURE_MS = 1500;
/** Moving packets hand over to the still frame's packets at the end of a run. */
const HANDOVER_MS = 400;
/** A run may overrun to finish a failure that is still playing out. */
const OVERRUN_MS = NODE_DOWN_MS + 2000;
const STILL_PACKETS = 3;
const PACKET_LENGTH = 14;
const WORKLOADS = ["api", "web", "worker", "cache", "ingest", "auth"];

export interface SystemOptions {
	/** Lays the system out from a seeded generator, so a render repeats. */
	seed?: number;
	/** Holds still frames, as reduced motion does. */
	still?: boolean;
}

/** mulberry32: a small seeded generator, enough for a repeatable layout. */
const seeded = (seed: number) => {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 4;

const routeBetween = (
	from: Point,
	to: Point,
	horizontalFirst: boolean,
): Route =>
	horizontalFirst
		? [from, { x: to.x, y: from.y }, to]
		: [from, { x: from.x, y: to.y }, to];

const span = (a: Point, b: Point) => Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
const toCorner = ([from, corner]: Route) => span(from, corner);
const routeLength = (route: Route) =>
	toCorner(route) + span(route[1], route[2]);

const lerp = (a: Point, b: Point, t: number): Point => ({
	x: a.x + (b.x - a.x) * t,
	y: a.y + (b.y - a.y) * t,
});

/** The point `distance` pixels along a route. */
const along = (route: Route, distance: number): Point => {
	const [from, corner, to] = route;
	const first = toCorner(route);
	if (distance <= first)
		return lerp(from, corner, first === 0 ? 0 : distance / first);
	const second = span(corner, to);
	return lerp(
		corner,
		to,
		second === 0 ? 1 : Math.min(1, (distance - first) / second),
	);
};

export function mountSystem(hero: HTMLElement, options: SystemOptions = {}) {
	const canvas = hero.querySelector<HTMLCanvasElement>("[data-system-canvas]");
	const context = canvas?.getContext("2d");
	if (!canvas || !context) return;

	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
	const still = () => options.still === true || reduced.matches;
	let random = Math.random;
	const pick = <T>(items: readonly T[]): T | undefined =>
		items[Math.floor(random() * items.length)];
	const hex = () =>
		Math.floor(random() * 0xffff)
			.toString(16)
			.padStart(4, "0");
	let palette: Palette;
	let width = 0;
	let height = 0;
	let cell = 64;
	let nodes: Node[] = [];
	let pods: Pod[] = [];
	let free: Point[] = [];
	/** The copy's boxes, padded: nothing is placed or routed through them. */
	let avoid: { left: number; right: number; top: number; bottom: number }[] =
		[];
	let hovered: Pod | Node | undefined;
	let visible = true;
	let frame = 0;
	let last = performance.now();
	const startedAt = performance.now();
	let lastInteraction = 0;
	let failedOnce = false;

	const readPalette = () => {
		const style = getComputedStyle(hero);
		const token = (name: string, fallback: string) =>
			style.getPropertyValue(name).trim() || fallback;
		palette = {
			text: token("--colors-academy-ink-text", "#f4f7fb"),
			soft: token("--colors-academy-ink-text-soft", "#c5d0e0"),
			muted: token("--colors-academy-ink-text-muted", "#8fa0b8"),
			accent: token("--colors-academy-ink-accent", "#ff7ab6"),
			ground: token("--colors-academy-ink", "#0c1626"),
			font: token("--fonts-academy-mono", "ui-monospace, monospace"),
		};
	};

	const occupied = (point: Point) =>
		nodes.some((node) => node.x === point.x && node.y === point.y) ||
		pods.some(
			(pod) =>
				pod.phase !== "terminating" && pod.x === point.x && pod.y === point.y,
		);

	// The scheduler: the least loaded ready node, then the nearest free
	// intersection to it, with a little jitter so placements look organic.
	const schedule = (preferAwayFrom?: Node): Node | undefined => {
		const load = (node: Node) =>
			pods.filter((pod) => pod.node === node && pod.phase !== "terminating")
				.length;
		const candidates = nodes
			.filter((node) => node.ready && node !== preferAwayFrom)
			.sort((a, b) => load(a) - load(b) || random() - 0.5);
		return candidates[0];
	};

	// A route is clear when neither leg runs through the copy.
	const clear = (route: Route) =>
		[
			[route[0], route[1]],
			[route[1], route[2]],
		].every(([from, to]) =>
			avoid.every(
				(rect) =>
					!from ||
					!to ||
					Math.max(from.x, to.x) <= rect.left ||
					Math.min(from.x, to.x) >= rect.right ||
					Math.max(from.y, to.y) <= rect.top ||
					Math.min(from.y, to.y) >= rect.bottom,
			),
		);
	const routeTo = (node: Node, at: Point): Route | undefined => {
		const first = random() > 0.5;
		return [first, !first]
			.map((horizontalFirst) => routeBetween(node, at, horizontalFirst))
			.find(clear);
	};

	const placeNear = (node: Node): { at: Point; route: Route } | undefined => {
		const options = free
			.filter((point) => !occupied(point))
			.map((point) => ({
				point,
				distance: Math.abs(point.x - node.x) + Math.abs(point.y - node.y),
			}))
			.filter(({ distance }) => distance > 0)
			.sort((a, b) => a.distance - b.distance)
			.flatMap(({ point }) => {
				const route = routeTo(node, point);
				return route ? [{ at: point, route }] : [];
			})
			.slice(0, 5);
		return pick(options);
	};

	const spawn = (
		node: Node,
		{ at, route }: { at: Point; route: Route },
		now: number,
		phase: PodPhase = "pending",
	): Pod => ({
		...at,
		name: `${pick(WORKLOADS) ?? "app"}-${hex()}`,
		node,
		phase,
		since: now,
		route,
		link: phase === "running" ? 1 : 0,
		packet: random() * routeLength(route),
		packetSpeed: 70 + random() * 90,
	});

	const layout = () => {
		// A seeded layout repeats on every pass, a resize included.
		if (options.seed !== undefined) random = seeded(options.seed);
		const bounds = hero.getBoundingClientRect();
		width = bounds.width;
		height = bounds.height;
		const ratio = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(height * ratio);
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		cell =
			Number.parseFloat(getComputedStyle(document.documentElement).fontSize) *
				4 || 64;

		// The CSS grid is centred on the hero, so its lines sit half a cell
		// either side of the centre line.
		const originX = (((width / 2 - cell / 2) % cell) + cell) % cell;
		// Block-level text reserves only the glyphs it renders, not the rest of
		// its line box, so the system can live beside a short headline.
		const rectsOf = (element: HTMLElement) => {
			if (element.dataset.systemAvoid !== "text")
				return [element.getBoundingClientRect()];
			const range = document.createRange();
			range.selectNodeContents(element);
			return [...range.getClientRects()];
		};
		const pad = cell * 0.35;
		const boxes = [
			...hero.querySelectorAll<HTMLElement>("[data-system-avoid]"),
		].map((element) =>
			rectsOf(element)
				.filter((rect) => rect.width > 0 && rect.height > 0)
				.map((rect) => ({
					left: rect.left - bounds.left - pad,
					right: rect.right - bounds.left + pad,
					top: rect.top - bounds.top - pad,
					bottom: rect.bottom - bounds.top + pad,
				})),
		);
		avoid = boxes.flat();
		// The system lives beside the copy: on every intersection to the right
		// of the statement and the lede, from the first grid row to the last
		// one with room beneath it. Rows above, between and below the copy
		// start where its narrowest box ends, so nothing strays into the text
		// column.
		const column = Math.min(
			width,
			...boxes
				.filter((rects) => rects.length > 0)
				.map((rects) => Math.max(...rects.map((rect) => rect.right))),
		);
		// A row with half a cell clear under all of the copy is open across the
		// hero and may sit closer to its foot: on a phone, where the copy fills
		// the measure, that row is where the system lives.
		const under =
			avoid.length > 0
				? Math.max(...avoid.map((rect) => rect.bottom)) - pad + cell * 0.5
				: Number.POSITIVE_INFINITY;
		free = [];
		for (let y = cell; y <= height - cell * 0.4; y += cell) {
			const open = y >= under;
			if (!open && y > height - cell * 0.75) continue;
			for (let x = originX; x < width - cell * 0.4; x += cell) {
				if (x < cell * 0.4 || (!open && boxes.length > 0 && x < column))
					continue;
				const blocked = avoid.some(
					(rect) => x < rect.right && y > rect.top && y < rect.bottom,
				);
				if (!blocked) free.push({ x, y });
			}
		}

		const now = performance.now();
		nodes = [];
		pods = [];
		if (free.length < 4) return;

		// The first node goes where the open lattice is densest; each one
		// after it goes as far from the others as the lattice allows (at least
		// three cells), so the cluster spans the space the layout leaves free.
		const nodeCount = Math.max(2, Math.min(5, Math.round(free.length / 10)));
		const reach = cell * 2.5;
		const distance = (a: Point, b: Point) =>
			Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
		const density = new Map(
			free.map((point) => [
				point,
				free.filter((other) => distance(other, point) <= reach).length +
					random(),
			]),
		);
		const picks: Point[] = [];
		while (picks.length < nodeCount) {
			const next = free
				.filter((point) =>
					picks.every((pick) => distance(pick, point) >= cell * 3),
				)
				.map((point) => ({
					point,
					score:
						(density.get(point) ?? 0) +
						(picks.length
							? (Math.min(...picks.map((pick) => distance(pick, point))) /
									cell) *
								3
							: 0),
				}))
				.sort((a, b) => b.score - a.score)[0];
			if (!next) break;
			picks.push(next.point);
		}
		nodes = picks.map((point, index) => ({
			...point,
			id: index,
			name: `node-${index + 1}`,
			ready: true,
			downAt: 0,
		}));

		const podCount = Math.min(30, Math.round(free.length * 0.45));
		for (let index = 0; index < podCount; index++) {
			const node = nodes[index % nodes.length];
			const at = node && placeNear(node);
			if (node && at) pods.push(spawn(node, at, now, "running"));
		}
	};

	const breakPod = (pod: Pod, now: number) => {
		if (pod.phase !== "running") return;
		pod.phase = "failing";
		pod.since = now;
	};

	const breakNode = (node: Node, now: number) => {
		if (!node.ready) return;
		node.ready = false;
		node.downAt = now;
		const affected = pods.filter(
			(pod) => pod.node === node && pod.phase === "running",
		);
		affected.forEach((pod, index) => {
			pod.phase = "failing";
			pod.since = now + index * 90;
		});
		// Bring the node back even when no animation frames are running.
		window.setTimeout(() => settle(), NODE_DOWN_MS + 50);
	};

	const step = (now: number, delta: number) => {
		const instant = still();
		for (const node of nodes) {
			if (!node.ready && now - node.downAt > NODE_DOWN_MS) {
				node.ready = true;
			}
		}
		for (const pod of [...pods]) {
			const age = now - pod.since;
			if (pod.phase === "failing" && (instant || age > FAIL_MS)) {
				pod.phase = "terminating";
				pod.since = now;
				const node = schedule(pod.node.ready ? undefined : pod.node);
				const at = node && placeNear(node);
				if (node && at) {
					pods.push(spawn(node, at, now));
				}
			} else if (pod.phase === "terminating") {
				pod.link = instant ? 0 : 1 - ease(age / TERMINATE_MS);
				if (instant || age > TERMINATE_MS) pods.splice(pods.indexOf(pod), 1);
			} else if (pod.phase === "pending") {
				pod.link = instant ? 1 : ease(age / SCHEDULE_MS);
				if (instant || age > SCHEDULE_MS) {
					pod.phase = "running";
					pod.since = now;
				}
			} else if (pod.phase === "running" && !instant) {
				const length = routeLength(pod.route);
				pod.packet =
					(pod.packet + (pod.packetSpeed * delta) / 1000) % (length + 80);
			}
		}
		// One pod fails on its own, once, so the behaviour is seen. The rest
		// is the reader's doing.
		if (!instant && !failedOnce && now - startedAt > FIRST_FAILURE_MS) {
			failedOnce = true;
			const pod = pick(
				pods.filter((candidate) => candidate.phase === "running"),
			);
			if (pod) breakPod(pod, now);
		}
	};

	// A run lasts RUN_MS from load or the last pointer interaction, and
	// overruns only to finish a failure the reader started.
	const sinceActivity = (now: number) =>
		now - Math.max(startedAt, lastInteraction);
	const unsettled = () =>
		nodes.some((node) => !node.ready) ||
		pods.some((pod) => pod.phase !== "running");
	const running = (now: number) => {
		const elapsed = sinceActivity(now);
		return elapsed < RUN_MS || (unsettled() && elapsed < RUN_MS + OVERRUN_MS);
	};
	/** 0 while packets travel, 1 once the frame is still. */
	const stillness = (now: number) =>
		still()
			? 1
			: Math.min(
					1,
					Math.max(
						0,
						(sinceActivity(now) - (RUN_MS - HANDOVER_MS)) / HANDOVER_MS,
					),
				);

	const crisp = (value: number) => Math.round(value) + 0.5;

	const strokeRoute = (route: Route, progress: number) => {
		const [from, corner] = route;
		const total = routeLength(route) * progress;
		const end = along(route, total);
		context.beginPath();
		context.moveTo(crisp(from.x), crisp(from.y));
		if (total > toCorner(route))
			context.lineTo(crisp(corner.x), crisp(corner.y));
		context.lineTo(crisp(end.x), crisp(end.y));
		context.stroke();
	};

	const strokePacket = (route: Route, at: number) => {
		const head = along(route, at);
		const tail = along(route, Math.max(0, at - PACKET_LENGTH));
		const [, corner] = route;
		const cornerAt = toCorner(route);
		context.beginPath();
		context.moveTo(tail.x, tail.y);
		// Follow the corner when the packet is turning it.
		if (at - PACKET_LENGTH < cornerAt && at > cornerAt)
			context.lineTo(corner.x, corner.y);
		context.lineTo(head.x, head.y);
		context.stroke();
	};

	const draw = (now: number) => {
		context.clearRect(0, 0, width, height);
		context.lineWidth = 1;

		// Routes, from each node out to its pods.
		for (const pod of pods) {
			const failing = pod.phase === "failing" || !pod.node.ready;
			context.strokeStyle = failing ? palette.accent : palette.soft;
			context.globalAlpha = failing
				? 0.7
				: pod === hovered || pod.node === hovered
					? 0.6
					: 0.5;
			context.setLineDash(failing ? [3, 4] : []);
			strokeRoute(pod.route, pod.link);
		}
		context.setLineDash([]);

		// Packets: a short accent segment on the route. They travel while the
		// system runs; a still frame holds a few at rest, mid-route.
		const settled = stillness(now);
		const healthy = pods.filter(
			(pod) => pod.phase === "running" && pod.node.ready,
		);
		context.lineWidth = 2;
		context.lineCap = "round";
		context.strokeStyle = palette.accent;
		if (settled < 1) {
			context.globalAlpha = 0.9 * (1 - settled);
			for (const pod of healthy) {
				if (pod.packet <= routeLength(pod.route))
					strokePacket(pod.route, pod.packet);
			}
		}
		if (settled > 0) {
			context.globalAlpha = 0.9 * settled;
			const resting = healthy.filter((pod) => routeLength(pod.route) >= cell);
			const every = Math.max(1, Math.floor(resting.length / STILL_PACKETS));
			resting
				.filter((_, index) => index % every === 0)
				.slice(0, STILL_PACKETS)
				.forEach((pod) => {
					strokePacket(pod.route, routeLength(pod.route) / 2);
				});
		}
		context.lineCap = "butt";
		context.lineWidth = 1;

		// Pods.
		for (const pod of pods) {
			const age = now - pod.since;
			const size = 8;
			let alpha = 0.9;
			if (pod.phase === "terminating") alpha = 1 - ease(age / TERMINATE_MS);
			if (pod.phase === "pending") alpha = ease(age / SCHEDULE_MS);
			context.globalAlpha = alpha;
			if (pod.phase === "failing") {
				const pulse = Math.max(0, age) / FAIL_MS;
				context.fillStyle = palette.accent;
				context.fillRect(pod.x - size / 2, pod.y - size / 2, size, size);
				if (!still() && pulse > 0) {
					const ring = size + ease(pulse) * 36;
					context.globalAlpha = 1 - pulse;
					context.strokeStyle = palette.accent;
					context.strokeRect(
						crisp(pod.x - ring / 2),
						crisp(pod.y - ring / 2),
						Math.round(ring),
						Math.round(ring),
					);
				}
			} else {
				context.fillStyle = palette.ground;
				context.fillRect(pod.x - size / 2, pod.y - size / 2, size, size);
				context.strokeStyle =
					pod === hovered
						? palette.accent
						: pod.phase === "pending"
							? palette.text
							: palette.soft;
				if (pod.phase === "pending") context.setLineDash([2, 2]);
				context.strokeRect(
					crisp(pod.x - size / 2),
					crisp(pod.y - size / 2),
					size - 1,
					size - 1,
				);
				context.setLineDash([]);
			}
		}

		// Nodes.
		for (const node of nodes) {
			const size = 14;
			const accent = !node.ready || node === hovered;
			context.globalAlpha = accent ? 1 : 0.6;
			context.fillStyle = accent ? palette.accent : palette.text;
			context.fillRect(node.x - size / 2, node.y - size / 2, size, size);
			context.globalAlpha = accent ? 0.5 : 0.2;
			context.strokeStyle = accent ? palette.accent : palette.text;
			const ring = size + 12;
			context.strokeRect(
				crisp(node.x - ring / 2),
				crisp(node.y - ring / 2),
				ring - 1,
				ring - 1,
			);
		}

		// The label for whatever is under the pointer.
		const labelled = hovered;
		if (labelled) {
			const isNode = "ready" in labelled;
			const label = isNode
				? `${labelled.name} · ${labelled.ready ? "Ready" : "NotReady"}`
				: `pod/${labelled.name}`;
			context.globalAlpha = 1;
			context.font = `500 11px ${palette.font}`;
			context.fillStyle = palette.text;
			context.textBaseline = "middle";
			const x = labelled.x + (isNode ? 20 : 12);
			const metrics = context.measureText(label);
			const left =
				x + metrics.width + 8 > width
					? labelled.x - (isNode ? 20 : 12) - metrics.width
					: x;
			// An ink backing keeps the label legible over the lattice.
			context.fillStyle = palette.ground;
			context.fillRect(left - 4, labelled.y - 9, metrics.width + 8, 18);
			context.fillStyle = palette.text;
			context.fillText(label, left, labelled.y);
		}
		context.globalAlpha = 1;
	};

	const tick = (now: number) => {
		frame = 0;
		const delta = Math.min(64, now - last);
		last = now;
		step(now, delta);
		draw(now);
		// The last frame of a run is the still frame: stillness() is 1 by then.
		if (visible && !document.hidden && !still() && running(now))
			frame = requestAnimationFrame(tick);
	};

	const start = () => {
		if (frame) return;
		last = performance.now();
		frame = requestAnimationFrame(tick);
	};

	// Still frames render on demand only; otherwise this draws a frame and
	// keeps going for as long as the run lasts.
	const settle = () => {
		if (still()) {
			const now = performance.now();
			step(now, 0);
			draw(now);
		} else start();
	};

	const pointer = (event: PointerEvent | MouseEvent) => {
		const bounds = hero.getBoundingClientRect();
		return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
	};

	const hit = ({ x, y }: Point) => {
		const node = nodes.find(
			(candidate) =>
				Math.abs(candidate.x - x) < 16 && Math.abs(candidate.y - y) < 16,
		);
		if (node) return node;
		return pods.find(
			(pod) =>
				pod.phase === "running" &&
				Math.abs(pod.x - x) < 12 &&
				Math.abs(pod.y - y) < 12,
		);
	};

	const interactive = (target: EventTarget | null) =>
		target instanceof Element &&
		Boolean(
			target.closest("a, button, input, label, form, [data-system-avoid]"),
		);

	hero.addEventListener("pointermove", (event) => {
		if (event.pointerType === "touch") return;
		// Any pointer movement in the hero starts a fresh run.
		const resting = !running(performance.now());
		lastInteraction = performance.now();
		if (resting) settle();
		const next = interactive(event.target) ? undefined : hit(pointer(event));
		if (next !== hovered) {
			hovered = next;
			hero.style.cursor = next ? "pointer" : "";
			settle();
		}
	});
	hero.addEventListener("pointerleave", () => {
		hovered = undefined;
		hero.style.cursor = "";
		settle();
	});
	hero.addEventListener("click", (event) => {
		if (interactive(event.target)) return;
		const now = performance.now();
		lastInteraction = now;
		const target = hit(pointer(event));
		if (!target) return settle();
		if ("ready" in target) breakNode(target, now);
		else breakPod(target, now);
		settle();
		// Reduced motion has no animation frames to play out the failure.
		if (still()) window.setTimeout(settle, 0);
	});
	new IntersectionObserver(([entry]) => {
		visible = entry?.isIntersecting ?? true;
		if (visible) settle();
	}).observe(hero);
	document.addEventListener("visibilitychange", () => {
		if (!document.hidden) settle();
	});
	let resizeTimer = 0;
	new ResizeObserver(() => {
		window.clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(() => {
			layout();
			settle();
		}, 120);
	}).observe(hero);
	window.addEventListener("color-scheme-change", () => {
		readPalette();
		settle();
	});
	reduced.addEventListener("change", settle);

	readPalette();
	layout();
	canvas.dataset.ready = "";
	settle();
}
