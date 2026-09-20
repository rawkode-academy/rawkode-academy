import "@testing-library/jest-dom/vitest";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { academyCgroups } from "@rawkodeacademy/design-system";
import HierarchyExplorer, {
	ControllerBadge,
} from "../components/articles/cgroups/HierarchyExplorer";
import CgroupTimeline from "../components/articles/cgroups/CgroupTimeline";
import PodCgroupMapper from "../components/articles/cgroups/PodCgroupMapper";
import CgroupTreeDiagram from "../components/articles/cgroups/CgroupTreeDiagram";

afterEach(() => {
	expect(fetch).not.toHaveBeenCalled();
	cleanup();
});

const controlledElement = (button: HTMLElement) => {
	const id = button.getAttribute("aria-controls");
	expect(id).toBeTruthy();
	const target = document.getElementById(id!);
	expect(target).not.toBeNull();
	return target!;
};

describe("Academy cgroups instructional controls", () => {
	it("preserves diagram geometry, labels and semantic node colors", () => {
		const { container } = render(<CgroupTreeDiagram />);
		const svg = screen.getByRole("img", { name: /cgroup hierarchy:/ });
		expect(svg).toHaveAttribute("viewBox", "0 0 780 420");
		expect(svg).toHaveClass(academyCgroups().diagramSvg!);
		expect(
			[...svg.querySelectorAll("path")].map((path) => path.getAttribute("d")),
		).toEqual([
			"M 390 64 V 90 H 205 V 116",
			"M 390 64 V 90 H 575 V 116",
			"M 205 160 V 190 H 105 V 220",
			"M 205 160 V 190 H 305 V 220",
			"M 575 160 V 220",
			"M 575 264 V 344",
		]);
		const nodes = [
			["/sys/fs/cgroup/", "neutral", "translate(305, 20)"],
			["system.slice/", "sky", "translate(120, 116)"],
			["user.slice/", "sky", "translate(490, 116)"],
			["nginx.service/", "amber", "translate(20, 220)"],
			["postgres.service/", "amber", "translate(220, 220)"],
			["user-1000.slice/", "sky", "translate(490, 220)"],
			["session-2.scope/", "amber", "translate(490, 344)"],
		] as const;
		for (const [label, tone, transform] of nodes) {
			const node = screen.getByText(label).parentElement!;
			expect(node).toHaveClass(academyCgroups({ tone }).diagramNode!);
			expect(node).toHaveAttribute("transform", transform);
			expect(node.querySelector("rect")).toHaveAttribute("width", "170");
			expect(node.querySelector("rect")).toHaveAttribute("height", "44");
		}
		expect(svg.querySelectorAll("text")).toHaveLength(7);
		expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
	});

	it("gives repeated diagrams distinct accessible titles", () => {
		render(
			<>
				<CgroupTreeDiagram />
				<CgroupTreeDiagram />
			</>,
		);
		const diagrams = screen.getAllByRole("img", { name: /cgroup hierarchy:/ });
		const ids = diagrams.map((svg) => svg.getAttribute("aria-labelledby"));
		expect(new Set(ids).size).toBe(2);
		for (const id of ids)
			expect(document.getElementById(id!)).toHaveTextContent("session-2.scope");
	});

	it("preserves v1 controller trees and disclosure state when switching versions", () => {
		render(<HierarchyExplorer />);
		for (const path of [
			"/sys/fs/cgroup/cpu/",
			"/sys/fs/cgroup/memory/",
			"/sys/fs/cgroup/blkio/",
		]) {
			expect(screen.getByText(path)).toBeVisible();
		}
		const directory = screen.getByRole("button", {
			name: "docker/ in /sys/fs/cgroup/cpu/",
		});
		expect(directory).toHaveAttribute("aria-expanded", "true");
		expect(directory.querySelector("svg")).toHaveAttribute(
			"data-expanded",
			"true",
		);
		fireEvent.click(directory);
		expect(controlledElement(directory)).not.toBeVisible();
		expect(directory.querySelector("svg")).toHaveAttribute(
			"data-expanded",
			"false",
		);
		fireEvent.click(screen.getByRole("button", { name: "cgroupsv2" }));
		expect(screen.getByRole("button", { name: "cgroupsv2" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.getByText("/sys/fs/cgroup/")).toBeVisible();
		expect(screen.getByText("The Unified Hierarchy")).toBeVisible();
		for (const name of ["cpu", "memory", "io", "pids", "cpuset"])
			expect(screen.getAllByText(name).length).toBeGreaterThan(0);
		fireEvent.click(screen.getByRole("button", { name: "cgroupsv1" }));
		expect(
			screen.getByRole("button", { name: "docker/ in /sys/fs/cgroup/cpu/" }),
		).toHaveAttribute("aria-expanded", "false");
	});

	it.each([
		"cpu",
		"memory",
		"io",
		"pids",
		"cpuset",
		"future-controller",
		"__proto__",
	])("names and styles controller %s", (name) => {
		const { container } = render(<ControllerBadge name={name} />);
		expect(screen.getByText(name)).toBeVisible();
		if (["future-controller", "__proto__"].includes(name))
			expect(container.firstChild).toHaveClass(
				academyCgroups({ tone: "neutral" }).badge!,
			);
	});

	it("uses unique disclosure IDs across widget instances", () => {
		const { container } = render(
			<>
				<HierarchyExplorer />
				<HierarchyExplorer />
				<PodCgroupMapper />
				<PodCgroupMapper />
			</>,
		);
		const ids = [...container.querySelectorAll("[id]")].map(
			(element) => element.id,
		);
		expect(new Set(ids).size).toBe(ids.length);
		container
			.querySelectorAll<HTMLButtonElement>("button[aria-controls]")
			.forEach(controlledElement);
	});

	it("reveals each of the 16 milestone details without a fixed-height overlay", () => {
		render(<CgroupTimeline />);
		const timeline = screen.getByRole("region", {
			name: "Timeline milestones",
		});
		const buttons = within(timeline).getAllByRole("button");
		expect(buttons).toHaveLength(16);
		for (const button of buttons) {
			fireEvent.click(button);
			expect(button).toHaveAttribute("aria-expanded", "true");
			expect(controlledElement(button)).toBeVisible();
			expect(controlledElement(button).textContent!.length).toBeGreaterThan(30);
			expect(controlledElement(button).textContent).not.toContain("`");
			fireEvent.click(button);
			expect(controlledElement(button)).not.toBeVisible();
		}
	});

	it("preserves the experimental mount flag without visible Markdown delimiters", () => {
		render(<CgroupTimeline />);
		const milestone = screen.getByRole("button", {
			name: "2016 Mar v2 declared stable",
		});
		fireEvent.click(milestone);
		expect(controlledElement(milestone)).toHaveTextContent(
			"experimental __DEVEL__sane_behavior mount flag",
		);
	});

	it("supports milestone arrow navigation, Home/End and Escape", () => {
		render(<CgroupTimeline />);
		const buttons = within(
			screen.getByRole("region", { name: "Timeline milestones" }),
		).getAllByRole("button");
		buttons[0]!.focus();
		fireEvent.keyDown(buttons[0]!, { key: "ArrowRight" });
		expect(buttons[1]).toHaveFocus();
		fireEvent.keyDown(buttons[1]!, { key: "ArrowLeft" });
		expect(buttons[0]).toHaveFocus();
		fireEvent.keyDown(buttons[0]!, { key: "End" });
		expect(buttons.at(-1)).toHaveFocus();
		fireEvent.click(buttons.at(-1)!);
		fireEvent.keyDown(buttons.at(-1)!, { key: "Escape" });
		expect(buttons.at(-1)).toHaveAttribute("aria-expanded", "false");
		fireEvent.keyDown(buttons.at(-1)!, { key: "Home" });
		expect(buttons[0]).toHaveFocus();
	});

	it.each([
		["Guaranteed", 'cpu: "500m"', "50000 100000", "268435456", "-997"],
		["Burstable", 'cpu: "250m"', "100000 100000", "536870912", "memory.low"],
		[
			"BestEffort",
			"# No resources section",
			"max 100000",
			"No memory limit",
			"1000",
		],
	])("preserves %s YAML, mapping and explanation", (label, yaml, cpu, memory, annotation) => {
		render(<PodCgroupMapper />);
		const button = screen.getByRole("button", { name: label });
		fireEvent.click(button);
		expect(button).toHaveAttribute("aria-pressed", "true");
		expect(controlledElement(button)).toBeVisible();
		expect(screen.getByLabelText("Pod specification YAML")).toHaveTextContent(
			yaml,
		);
		const mapping = screen.getByLabelText("cgroups v2 mapping");
		expect(mapping).toHaveTextContent(cpu);
		expect(mapping).toHaveTextContent(memory);
		expect(mapping).toHaveTextContent(annotation);
		expect(screen.getByRole("status")).toHaveTextContent(
			"Showing " + label + " pod mapping",
		);
	});

	it("rapid changes settle on the final QoS choice without stale timers", () => {
		vi.useFakeTimers();
		render(<PodCgroupMapper />);
		for (const label of ["Burstable", "BestEffort", "Guaranteed"])
			fireEvent.click(screen.getByRole("button", { name: label }));
		vi.runAllTimers();
		expect(screen.getByRole("button", { name: "Guaranteed" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		vi.useRealTimers();
	});

	it.each([
		"HierarchyExplorer",
		"CgroupTimeline",
		"PodCgroupMapper",
		"CgroupTreeDiagram",
	])("%s has no legacy utility or fixed palette styling", (name) => {
		const source = readFileSync(
			new URL(
				"../components/articles/cgroups/" + name + ".tsx",
				import.meta.url,
			),
			"utf8",
		);
		expect(source).toContain("academyCgroups");
		expect(source).not.toMatch(/className="|style=|<style|#[0-9a-fA-F]{6}/);
	});
});
