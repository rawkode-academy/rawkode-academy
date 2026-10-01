/**
 * The homepage's living system: a small cluster drawn on the hero's 4rem
 * grid. Nodes and pods sit on grid intersections and talk over routes that
 * follow the grid lines. Break a pod, or a whole node, and the scheduler
 * places the work somewhere healthy while the readout says what happened.
 *
 * It is decoration with a point of view, so it never covers content (every
 * element marked `data-system-avoid` is kept clear), it stops drawing when
 * the hero is off screen or the tab is hidden, and with reduced motion it
 * renders still frames: no packets, no autonomous failures, instant moves.
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
const WORKLOADS = ["api", "web", "worker", "cache", "ingest", "auth"];

const pick = <T>(items: readonly T[]): T | undefined =>
	items[Math.floor(Math.random() * items.length)];

const hex = () =>
	Math.floor(Math.random() * 0xffff)
		.toString(16)
		.padStart(4, "0");
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

export function mountSystem(hero: HTMLElement) {
	const canvas = hero.querySelector<HTMLCanvasElement>("[data-system-canvas]");
	const readout = hero.querySelector<HTMLElement>("[data-system-status]");
	const summary = hero.querySelector<HTMLElement>("[data-system-summary]");
	const log = hero.querySelector<HTMLElement>("[data-system-log]");
	const announcer = hero.querySelector<HTMLElement>("[data-system-announce]");
	const context = canvas?.getContext("2d");
	if (!canvas || !context) return;

	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
	let palette: Palette;
	let width = 0;
	let height = 0;
	let cell = 64;
	let nodes: Node[] = [];
	let pods: Pod[] = [];
	let free: Point[] = [];
	let hovered: Pod | Node | undefined;
	let visible = true;
	let frame = 0;
	let last = performance.now();
	let lastInteraction = 0;
	let nextChaos = performance.now() + 6000;

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
			font:
				getComputedStyle(readout ?? hero).fontFamily ||
				"ui-monospace, monospace",
		};
	};

	const say = (message: string, announce = false) => {
		if (log) log.textContent = message;
		if (announce && announcer) announcer.textContent = message;
	};

	const updateSummary = () => {
		if (!summary) return;
		const running = pods.filter((pod) => pod.phase === "running").length;
		const ready = nodes.filter((node) => node.ready).length;
		summary.textContent = `${running}/${pods.length} pods ready · ${ready}/${nodes.length} nodes`;
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
			.sort((a, b) => load(a) - load(b) || Math.random() - 0.5);
		return candidates[0];
	};

	const placeNear = (node: Node): Point | undefined => {
		const options = free
			.filter((point) => !occupied(point))
			.map((point) => ({
				point,
				distance: Math.abs(point.x - node.x) + Math.abs(point.y - node.y),
			}))
			.filter(({ distance }) => distance > 0)
			.sort((a, b) => a.distance - b.distance)
			.slice(0, 5);
		return pick(options)?.point;
	};

	const spawn = (
		node: Node,
		at: Point,
		now: number,
		phase: PodPhase = "pending",
	): Pod => {
		const route = routeBetween(node, at, Math.random() > 0.5);
		return {
			...at,
			name: `${pick(WORKLOADS) ?? "app"}-${hex()}`,
			node,
			phase,
			since: now,
			route,
			link: phase === "running" ? 1 : 0,
			packet: Math.random() * routeLength(route),
			packetSpeed: 70 + Math.random() * 90,
		};
	};

	const layout = () => {
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
		const avoid = [...hero.querySelectorAll<HTMLElement>("[data-system-avoid]")]
			.flatMap(rectsOf)
			.filter((rect) => rect.width > 0 && rect.height > 0)
			.map((rect) => ({
				left: rect.left - bounds.left - cell * 0.35,
				right: rect.right - bounds.left + cell * 0.35,
				top: rect.top - bounds.top - cell * 0.35,
				bottom: rect.bottom - bounds.top + cell * 0.35,
			}));
		free = [];
		for (let y = cell; y < height * 0.8; y += cell) {
			for (let x = originX; x < width - cell * 0.4; x += cell) {
				if (x < cell * 0.4) continue;
				const blocked = avoid.some(
					(rect) =>
						x > rect.left && x < rect.right && y > rect.top && y < rect.bottom,
				);
				if (!blocked) free.push({ x, y });
			}
		}

		const now = performance.now();
		nodes = [];
		pods = [];
		if (free.length < 6) return;

		// Nodes go where the open lattice is densest, at least three cells
		// apart, so the cluster gathers in the space the layout leaves free.
		const nodeCount = Math.max(2, Math.min(5, Math.round(free.length / 14)));
		const reach = cell * 2.5;
		const density = new Map(
			free.map((point) => [
				point,
				free.filter(
					(other) =>
						Math.abs(other.x - point.x) + Math.abs(other.y - point.y) <= reach,
				).length + Math.random(),
			]),
		);
		const picks: Point[] = [];
		for (const point of [...free].sort(
			(a, b) => (density.get(b) ?? 0) - (density.get(a) ?? 0),
		)) {
			if (picks.length === nodeCount) break;
			const clear = picks.every(
				(pick) =>
					Math.abs(pick.x - point.x) + Math.abs(pick.y - point.y) >= cell * 3,
			);
			if (clear) picks.push(point);
		}
		nodes = picks.map((point, index) => ({
			...point,
			id: index,
			name: `node-${index + 1}`,
			ready: true,
			downAt: 0,
		}));

		const podCount = Math.min(30, Math.round(free.length * 0.32));
		for (let index = 0; index < podCount; index++) {
			const node = nodes[index % nodes.length];
			const at = node && placeNear(node);
			if (node && at) pods.push(spawn(node, at, now, "running"));
		}
		updateSummary();
		if (log && !log.textContent) say("Click a pod or a node to break it.");
	};

	const breakPod = (pod: Pod, now: number, announce: boolean) => {
		if (pod.phase !== "running") return;
		pod.phase = "failing";
		pod.since = now;
		say(`pod/${pod.name} OOMKilled on ${pod.node.name}`, announce);
		updateSummary();
	};

	const breakNode = (node: Node, now: number, announce: boolean) => {
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
		say(
			`${node.name} NotReady · evicting ${affected.length} ${affected.length === 1 ? "pod" : "pods"}`,
			announce,
		);
		updateSummary();
		// Bring the node back even when no animation frames are running.
		window.setTimeout(() => settle(), NODE_DOWN_MS + 50);
	};

	const step = (now: number, delta: number) => {
		const instant = reduced.matches;
		for (const node of nodes) {
			if (!node.ready && now - node.downAt > NODE_DOWN_MS) {
				node.ready = true;
				say(`${node.name} Ready`);
				updateSummary();
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
					const replacement = spawn(node, at, now);
					pods.push(replacement);
					say(`pod/${replacement.name} scheduled on ${node.name}`);
				}
			} else if (pod.phase === "terminating") {
				pod.link = instant ? 0 : 1 - ease(age / TERMINATE_MS);
				if (instant || age > TERMINATE_MS) pods.splice(pods.indexOf(pod), 1);
			} else if (pod.phase === "pending") {
				pod.link = instant ? 1 : ease(age / SCHEDULE_MS);
				if (instant || age > SCHEDULE_MS) {
					pod.phase = "running";
					pod.since = now;
					updateSummary();
				}
			} else if (pod.phase === "running" && !instant) {
				const length = routeLength(pod.route);
				pod.packet =
					(pod.packet + (pod.packetSpeed * delta) / 1000) % (length + 80);
			}
		}
		// With nobody at the controls, the cluster has the occasional bad day.
		if (!instant && now > nextChaos && now - lastInteraction > 8000) {
			nextChaos = now + 7000 + Math.random() * 5000;
			breakSomething(now, 0.25, false);
		}
	};

	// Takes down a node (with the given chance, and never the last one
	// standing) or else a single pod.
	const breakSomething = (
		now: number,
		nodeChance: number,
		announce: boolean,
	) => {
		const ready = nodes.filter((node) => node.ready);
		const node =
			ready.length > 1 && Math.random() < nodeChance ? pick(ready) : undefined;
		if (node) return breakNode(node, now, announce);
		const pod = pick(pods.filter((candidate) => candidate.phase === "running"));
		if (pod) breakPod(pod, now, announce);
	};

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
					: 0.28;
			context.setLineDash(failing ? [3, 4] : []);
			strokeRoute(pod.route, pod.link);
		}
		context.setLineDash([]);

		// Packets: a short bright segment travelling the route.
		if (!reduced.matches) {
			context.lineWidth = 2;
			context.lineCap = "round";
			for (const pod of pods) {
				if (pod.phase !== "running" || !pod.node.ready) continue;
				const length = routeLength(pod.route);
				if (pod.packet > length) continue;
				const head = along(pod.route, pod.packet);
				const tail = along(pod.route, Math.max(0, pod.packet - 14));
				context.strokeStyle = palette.text;
				context.globalAlpha = 0.75;
				context.beginPath();
				context.moveTo(tail.x, tail.y);
				// Follow the corner when the packet is turning it.
				const [, corner] = pod.route;
				const cornerAt = toCorner(pod.route);
				if (pod.packet - 14 < cornerAt && pod.packet > cornerAt)
					context.lineTo(corner.x, corner.y);
				context.lineTo(head.x, head.y);
				context.stroke();
			}
			context.lineCap = "butt";
			context.lineWidth = 1;
		}

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
				if (!reduced.matches && pulse > 0) {
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
			context.globalAlpha = 1;
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
		if (visible && !document.hidden && !reduced.matches)
			frame = requestAnimationFrame(tick);
	};

	const start = () => {
		if (frame) return;
		last = performance.now();
		frame = requestAnimationFrame(tick);
	};

	// Reduced motion renders on demand only.
	const settle = () => {
		if (reduced.matches) {
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
		const target = hit(pointer(event));
		if (!target) return;
		const now = performance.now();
		lastInteraction = now;
		if ("ready" in target) breakNode(target, now, true);
		else breakPod(target, now, true);
		settle();
		// Reduced motion has no animation frames to play out the failure.
		if (reduced.matches) window.setTimeout(settle, 0);
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
	if (readout) readout.hidden = false;
	canvas.dataset.ready = "";
	settle();
}
