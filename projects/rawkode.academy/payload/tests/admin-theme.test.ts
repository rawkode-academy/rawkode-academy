import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

// Parses app/(payload)/custom.css: token drift against the design system,
// complete ramps, and WCAG AA contrast for the real Payload usages.
const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8')
const css = await read('../app/(payload)/custom.css')
const panda = await read('../../../../packages/design-system/panda.config.ts')
const steps = [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000]

function block(selector: string): Record<string, string> {
	const start = css.indexOf(`${selector} {`)
	assert.ok(start >= 0, `${selector} block missing`)
	const body = css.slice(start, css.indexOf('}', start))
	return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]))
}
const light = block(':root')
const dark = block('html[data-theme="dark"]')

const rgb = (hex: string) => [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
const luminance = (hex: string) => {
	const [r, g, b] = rgb(hex).map(channel => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
	const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
	return (high + 0.05) / (low + 0.05)
}
// Payload's own mapping: light theme-N = color-N; dark inverts the status ramps.
const lightElevation = (step: number) => light[`--color-base-${step}`]
const darkElevation = (step: number) => dark[`--theme-elevation-${step}`]
const status = (name: string, step: number, mode: 'light' | 'dark') => light[`--color-${name}-${mode === 'light' ? step : 1000 - step}`]

function token(name: string): { base: string; dark: string } {
	const match = new RegExp(`\\b${name}: \\{\\s*value: \\{\\s*base: "(#[0-9a-f]{6})",\\s*_dark: "([^"]+)"`).exec(panda)
	assert.ok(match, `${name} token not found in panda.config.ts`)
	let darkValue = match[2]
	const reference = /^\{colors\.academyBase\.([\w-]+)\}$/.exec(darkValue)
	if (reference) darkValue = new RegExp(`"?${reference[1]}"?: \\{ value: "(#[0-9a-f]{6})" \\}`).exec(panda)![1]
	return { base: match[1], dark: darkValue }
}

test('mapped values match the design system tokens', () => {
	const pairs: [string, string, string][] = [
		['text', '--academy-text', '--academy-text'],
		['textSoft', '--academy-text-soft', '--academy-text-soft'],
		['textMuted', '--academy-text-muted', '--academy-text-muted'],
		['inputBorder', '--academy-input-border', '--academy-input-border'],
		['accent', '--academy-accent', '--academy-accent'],
		['accentForeground', '--academy-accent-foreground', '--academy-accent-foreground'],
		['panel', '--academy-panel', '--academy-panel'],
		['border', '--academy-border', '--academy-border'],
		['canvas', '--academy-canvas', '--academy-canvas'],
		['statusSpruce', '--academy-spruce', '--academy-spruce'],
		['statusAmber', '--academy-amber', '--academy-amber'],
		['statusRust', '--academy-rust', '--academy-rust'],
		['statusSky', '--academy-sky', '--academy-sky'],
		['statusViolet', '--academy-violet', '--academy-violet'],
	]
	for (const [name, lightVar, darkVar] of pairs) {
		const value = token(name)
		assert.equal(light[lightVar], value.base, `${name} light`)
		assert.equal(dark[darkVar], value.dark, `${name} dark`)
	}
	assert.equal(lightElevation(400), token('textMuted').base)
	assert.equal(darkElevation(400), token('textMuted').dark)
	assert.equal(lightElevation(800), token('text').base)
	assert.equal(dark['--theme-text'], token('text').dark)
	assert.equal(darkElevation(0), '#0a1220')
	assert.equal(status('success', 600, 'light'), token('statusSpruce').base)
	assert.equal(status('warning', 600, 'light'), token('statusAmber').base)
	assert.equal(status('error', 600, 'light'), token('statusRust').base)
})

test('ramps are complete and monotonic in both themes', () => {
	const lightRamp = steps.map(lightElevation)
	const darkRamp = steps.map(darkElevation)
	for (const ramp of [lightRamp, darkRamp])
		assert.ok(
			ramp.every(value => /^#[0-9a-f]{6}$/.test(value)),
			'all 21 steps defined',
		)
	for (let index = 1; index < steps.length; index += 1) {
		assert.ok(luminance(lightRamp[index]) <= luminance(lightRamp[index - 1]), `light step ${steps[index]} is not darker`)
		assert.ok(luminance(darkRamp[index]) >= luminance(darkRamp[index - 1]), `dark step ${steps[index]} is not lighter`)
	}
	for (const name of ['success', 'warning', 'error']) {
		for (const step of steps.slice(1, -1)) assert.match(light[`--color-${name}-${step}`] ?? '', /^#[0-9a-f]{6}$/, `${name}-${step}`)
	}
})

test('text, nav, status and controls meet WCAG AA in both themes', () => {
	for (const mode of ['light', 'dark'] as const) {
		const elevation = mode === 'light' ? lightElevation : darkElevation
		const vars = mode === 'light' ? light : { ...light, ...dark }
		for (const text of [400, 500, 800]) {
			for (const background of [0, 50]) assert.ok(contrast(elevation(text), elevation(background)) >= 4.5, `${mode} elevation-${text} on ${background}`)
		}
		assert.ok(contrast(mode === 'light' ? elevation(800) : dark['--theme-text'], elevation(0)) >= 7, `${mode} body text`)
		for (const name of ['success', 'warning', 'error']) {
			assert.ok(contrast(status(name, 600, mode), status(name, 100, mode)) >= 4.5, `${mode} ${name} 600 on 100`)
			assert.ok(contrast(status(name, 800, mode), status(name, 150, mode)) >= 4.5, `${mode} ${name} 800 on 150`)
			assert.ok(contrast(status(name, 800, mode), status(name, 100, mode)) >= 4.5, `${mode} ${name} pill`)
		}
		const inputBackground = mode === 'light' ? elevation(0) : dark['--theme-input-bg']
		assert.ok(contrast(vars['--academy-input-border'], inputBackground) >= 3, `${mode} input border`)
		assert.ok(contrast(elevation(500), inputBackground) >= 3, `${mode} input hover border`)
		assert.ok(contrast(elevation(800), elevation(0)) >= 3, `${mode} input focus ring`)
		assert.ok(contrast(vars['--academy-accent-foreground'], vars['--academy-accent']) >= 4.5, `${mode} primary button`)
		assert.ok(contrast(vars['--academy-accent-foreground'], vars['--academy-accent-hover']) >= 4.5, `${mode} primary button hover`)
		assert.ok(contrast(vars['--academy-accent'], elevation(0)) >= 3, `${mode} nav indicator`)
	}
})

test('primary buttons carry the accent, but disabled ones do not', () => {
	assert.match(css, /\.btn--style-primary \{\s*--bg-color: var\(--academy-accent\);/)
	const disabled = css.slice(css.indexOf('.btn--style-primary.btn--disabled'), css.indexOf('}', css.indexOf('.btn--style-primary.btn--disabled')))
	assert.match(disabled, /--bg-color: var\(--theme-elevation-150\)/)
	assert.match(disabled, /--hover-bg: var\(--theme-elevation-150\)/)
	assert.doesNotMatch(disabled, /accent/)
})

// Unlayered rules beat every rule in @layer payload-default, whatever its
// specificity, so a base override of a property that a Payload state rule
// changes (border on :focus and .error, toggle colour on :hover) silently
// removes that state. A later named layer has the same effect, so the CSS
// stays unlayered and these checks guard the states instead.
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '')
const rules = [...stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({ selector: match[1].trim(), body: match[2] }))
const rule = (selector: string) => rules.filter(item => item.selector.split(/,\s*/).includes(selector))

test('input borders keep Payload focus, hover and error states', () => {
	const control = /\b(input|textarea|select)\b|rs__control|checkbox-input__input|search-filter__input|item-search__input|block-search__input/
	for (const { selector, body } of rules.filter(item => control.test(item.selector))) {
		assert.doesNotMatch(body, /(^|[;\s])border(-[a-z]+)?\s*:/, `${selector} sets a border, which overrides Payload's :focus and .error borders`)
		assert.doesNotMatch(body, /(^|[;\s])background(-color)?\s*:/, `${selector} sets a background, which overrides Payload's .error background`)
	}
	for (const selector of ['.field-type input', '.field-type textarea', '.rs__control', '.checkbox-input__input', '.search-filter__input']) {
		assert.ok(
			rule(selector).some(item => /--theme-elevation-150:\s*var\(--academy-input-border\)/.test(item.body)),
			`${selector} must re-map --theme-elevation-150 to the AA input border`,
		)
	}
	for (const selector of ['.field-type textarea:focus-visible', '.rs__control--is-focused', '.search-filter__input:focus-visible']) {
		assert.ok(
			rule(selector).some(item => /outline:\s*2px solid var\(--theme-elevation-800\)/.test(item.body)),
			`${selector} needs a visible focus ring`,
		)
	}
})

test('nav group toggles keep hover and focus feedback', () => {
	for (const { body } of rule('.nav-group__toggle')) assert.doesNotMatch(body, /(^|[;\s])color\s*:/, 'base toggle colour would override :hover/:focus-visible')
	assert.ok(rule('.nav-group__toggle:focus-visible').some(item => /outline:\s*2px solid/.test(item.body)))
})

test('no layers, imports or !important; the accent never enters the status ramps', () => {
	assert.doesNotMatch(stripped, /@layer|@import|!important/)
	for (const accent of ['#c2185b', '#ff7ab6', '#a3134c']) {
		for (const [name, value] of Object.entries(light)) if (/^--color-(success|warning|error)-/.test(name)) assert.notEqual(value, accent)
	}
	assert.match(css, /--font-body: var\(--font-red-hat-text\)/)
})
