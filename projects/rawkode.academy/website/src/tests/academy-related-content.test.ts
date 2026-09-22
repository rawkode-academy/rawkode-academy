import { afterEach, describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import type { CollectionEntry } from "astro:content";
import AuthorAvatarGroup from "../components/common/AuthorAvatarGroup.vue";
import Container from "../components/ui/Container.vue";
import {
	academyAuthorGroup,
	academyContainer,
	academyRelatedContent,
} from "@rawkodeacademy/design-system";

const wrappers: VueWrapper[] = [];
afterEach(() => {
	for (const wrapper of wrappers.splice(0)) wrapper.unmount();
});
const authors = Array.from({ length: 5 }, (_, i) => ({
	id: `author-${i}`,
	collection: "people",
	data: {
		name: `Author ${i}`,
		avatarUrl: `https://example.test/author-${i}.jpg`,
	},
})) as CollectionEntry<"people">[];
const group = (
	props: {
		authors?: CollectionEntry<"people">[];
		maxDisplay?: number;
		showNames?: boolean;
		showActiveIndicator?: boolean;
		activeIndicatorLabel?: string;
	} = {},
) => {
	const wrapper = mount(AuthorAvatarGroup, { props: { authors, ...props } });
	wrappers.push(wrapper);
	return wrapper;
};

describe("honest author identity and overlapping groups", () => {
	it.each([
		1, 2, 3,
	])("keeps %i actual portraits and no fabricated activity", (count) => {
		const wrapper = group({ authors: authors.slice(0, count) });
		expect(wrapper.findAll("img")).toHaveLength(count);
		expect(wrapper.findAll("img").map((img) => img.attributes("src"))).toEqual(
			authors.slice(0, count).map((author) => author.data.avatarUrl),
		);
		expect(wrapper.find('[aria-label*="active"]').exists()).toBe(false);
		expect(wrapper.text()).not.toContain("+");
		const styles = academyAuthorGroup.raw();
		expect(styles.stack["& > * + *"]).toEqual({ marginInlineStart: "-3" });
		expect(
			wrapper
				.findAll("img")
				.map((img) => img.element.parentElement?.style.zIndex),
		).toEqual(Array.from({ length: count }, (_, i) => String(count - i)));
	});
	it("names overflow authors even when the visible names are disabled", () => {
		const wrapper = group({ showNames: false });
		expect(wrapper.findAll("img")).toHaveLength(3);
		expect(
			wrapper
				.get('[aria-label="2 additional authors: Author 3, Author 4"]')
				.text(),
		).toBe("+2");
	});
	it("supports an explicitly supplied activity signal and label", () => {
		const wrapper = group({
			showActiveIndicator: true,
			activeIndicatorLabel: "Presenting live",
		});
		expect(
			wrapper.findAll('[aria-label="Author 0: Presenting live"]'),
		).toHaveLength(1);
	});
	it("uses named initials instead of a fake identity image, including failed photos", async () => {
		const first = authors[0]!;
		const missing = {
			...first,
			data: { ...first.data, avatarUrl: undefined, name: "Ada Lovelace" },
		};
		const wrapper = group({ authors: [missing, authors[1]!] });
		expect(wrapper.get('[aria-label="Ada Lovelace"]').text()).toBe("AL");
		await wrapper.get("img").trigger("error");
		expect(wrapper.get('[aria-label="Author 1"]').text()).toBe("A1");
		expect(wrapper.findAll("img")).toHaveLength(0);
		expect(wrapper.html()).not.toContain("apple-touch-icon");
	});
	it("handles empty, zero-limit, negative, and fractional display counts", async () => {
		const wrapper = group({ authors: [], maxDisplay: 0 });
		expect(wrapper.find("img").exists()).toBe(false);
		expect(wrapper.text()).toBe("");
		await wrapper.setProps({ authors, maxDisplay: -2 });
		expect(wrapper.findAll("img")).toHaveLength(0);
		expect(wrapper.text()).toContain("+5");
		await wrapper.setProps({ maxDisplay: 1.9 });
		expect(wrapper.findAll("img")).toHaveLength(1);
	});
});

describe("explicit Container width and padding contracts", () => {
	it.each([
		["sm", "2xl"],
		["md", "4xl"],
		["lg", "6xl"],
		["xl", "academy-shell"],
		["2xl", "breakpoint-2xl"],
		["full", "full"],
	] as const)("defines %s width with a real Panda token", (size, maxWidth) => {
		expect(academyContainer.raw({ size }).maxWidth).toBe(maxWidth);
		const wrapper = mount(Container, {
			props: { size, class: "caller-class", id: "caller-id" },
			slots: { default: "Child content" },
		});
		wrappers.push(wrapper);
		expect(wrapper.classes()).toContain("caller-class");
		expect(wrapper.attributes("id")).toBe("caller-id");
		expect(wrapper.text()).toBe("Child content");
		expect(wrapper.classes()).toEqual(
			expect.arrayContaining(academyContainer({ size }).split(" ")),
		);
	});
	it.each([
		"none",
		"sm",
		"md",
		"lg",
	] as const)("defines %s padding", (padding) => {
		expect(academyContainer.raw({ padding }).paddingInline).toBeDefined();
	});
	it("uses the shared shell and gutter for xl/lg callers", () => {
		expect(academyContainer.raw({ size: "xl", padding: "lg" })).toMatchObject({
			width: "full",
			boxSizing: "border-box",
			maxWidth: "academy-shell",
			paddingInline: "academy-gutter",
		});
	});
});

describe("related editorial style contracts", () => {
	it("anchors duration inside the thumbnail without relying on legacy bottom-2", () => {
		expect(academyRelatedContent.raw().media).toMatchObject({
			position: "relative",
			aspectRatio: "video",
		});
		expect(academyRelatedContent.raw().duration).toMatchObject({
			position: "absolute",
			bottom: "2",
			right: "2",
			color: "academy.text",
			background: "academy.canvas",
		});
	});
	it("rules adjacent news items with semantic borders and uses Academy fonts", () => {
		const s = academyRelatedContent.raw();
		expect(s.newsList["& > li + li"]).toEqual({
			borderTop: "hairline",
			borderColor: "academy.border",
		});
		expect(s.heading.fontFamily).toBe("academy-display");
		expect(s.root.fontFamily).toBe("academy-text");
		expect(s.path._hover).toMatchObject({ background: "academy.ground" });
	});
});
