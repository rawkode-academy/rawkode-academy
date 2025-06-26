// To parse this data:
//
//   import { Convert, Types } from "./file";
//
//   const types = Convert.toTypes(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

/**
 * The configuration that is contained inside the file `biome.json`
 */
export interface Types {
	/**
	 * A field for the [JSON schema](https://json-schema.org/) specification
	 */
	$schema?: null | string;
	/**
	 * Specific configuration for assists
	 */
	assist?: AssistConfiguration | null;
	/**
	 * Specific configuration for the Css language
	 */
	css?: CSSConfiguration | null;
	/**
	 * A list of paths to other JSON files, used to extends the current configuration.
	 */
	extends?: string[] | null | string;
	/**
	 * The configuration of the filesystem
	 */
	files?: FilesConfiguration | null;
	/**
	 * The configuration of the formatter
	 */
	formatter?: FormatterConfiguration | null;
	/**
	 * Specific configuration for the GraphQL language
	 */
	graphql?: GraphqlConfiguration | null;
	/**
	 * Specific configuration for the GraphQL language
	 */
	grit?: GritConfiguration | null;
	/**
	 * Specific configuration for the HTML language
	 */
	html?: HTMLConfiguration | null;
	/**
	 * Specific configuration for the JavaScript language
	 */
	javascript?: JSConfiguration | null;
	/**
	 * Specific configuration for the Json language
	 */
	json?: JSONConfiguration | null;
	/**
	 * The configuration for the linter
	 */
	linter?: LinterConfiguration | null;
	/**
	 * A list of granular patterns that should be applied only to a sub set of files
	 */
	overrides?: OverridePattern[] | null;
	/**
	 * List of plugins to load.
	 */
	plugins?: string[] | null;
	/**
	 * Indicates whether this configuration file is at the root of a Biome project. By default,
	 * this is `true`.
	 */
	root?: boolean | null;
	/**
	 * The configuration of the VCS integration
	 */
	vcs?: VcsConfiguration | null;
}

export interface AssistConfiguration {
	/**
	 * Whether Biome should fail in CLI if the assist were not applied to the code.
	 */
	actions?: Actions | null;
	/**
	 * Whether Biome should enable assist via LSP and CLI.
	 */
	enabled?: boolean | null;
	/**
	 * A list of glob patterns. Biome will include files/folders that will match these patterns.
	 */
	includes?: string[] | null;
}

export interface Actions {
	/**
	 * It enables the assist actions recommended by Biome. `true` by default.
	 */
	recommended?: boolean | null;
	source?: Source | null;
}

/**
 * A list of rules that belong to this group
 */
export interface Source {
	/**
	 * Provides a code action to sort the imports and exports in the file using a built-in or
	 * custom order.
	 */
	organizeImports?:
		| RuleAssistWithOptionsForOptions
		| RuleAssistPlainConfiguration
		| null;
	/**
	 * It enables the recommended rules for this group
	 */
	recommended?: boolean | null;
	/**
	 * Enforce attribute sorting in JSX elements.
	 */
	useSortedAttributes?:
		| RuleAssistWithOptionsForNull
		| RuleAssistPlainConfiguration
		| null;
	/**
	 * Sorts the keys of a JSON object in natural order
	 */
	useSortedKeys?:
		| RuleAssistWithOptionsForNull
		| RuleAssistPlainConfiguration
		| null;
	/**
	 * Enforce ordering of CSS properties and nested rules.
	 */
	useSortedProperties?:
		| RuleAssistWithOptionsForNull
		| RuleAssistPlainConfiguration
		| null;
}

export interface RuleAssistWithOptionsForOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RuleAssistPlainConfiguration;
	/**
	 * Rule's options
	 */
	options: Options;
}

/**
 * The severity of the emitted diagnostics by the rule
 */
export enum RuleAssistPlainConfiguration {
	Off = "off",
	On = "on",
}

/**
 * Rule's options
 */
export interface Options {
	groups?: Array<Array<ImportMatcher | string> | null | ImportMatcher | string>;
}

export interface ImportMatcher {
	source?: string[] | null | string;
	type?: boolean | null;
	[property: string]: any;
}

export interface RuleAssistWithOptionsForNull {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RuleAssistPlainConfiguration;
	/**
	 * Rule's options
	 */
	options: null;
}

/**
 * Options applied to CSS files
 */
export interface CSSConfiguration {
	/**
	 * CSS assist options
	 */
	assist?: CSSAssistConfiguration | null;
	/**
	 * CSS formatter options
	 */
	formatter?: CSSFormatterConfiguration | null;
	/**
	 * CSS globals
	 */
	globals?: string[] | null;
	/**
	 * CSS linter options
	 */
	linter?: CSSLinterConfiguration | null;
	/**
	 * CSS parsing options
	 */
	parser?: CSSParserConfiguration | null;
}

/**
 * Options that changes how the CSS assist behaves
 */
export interface CSSAssistConfiguration {
	/**
	 * Control the assist for CSS files.
	 */
	enabled?: boolean | null;
}

/**
 * Options that changes how the CSS formatter behaves
 */
export interface CSSFormatterConfiguration {
	/**
	 * Control the formatter for CSS (and its super languages) files.
	 */
	enabled?: boolean | null;
	/**
	 * The indent style applied to CSS (and its super languages) files.
	 */
	indentStyle?: IndentStyle | null;
	/**
	 * The size of the indentation applied to CSS (and its super languages) files. Default to 2.
	 */
	indentWidth?: number | null;
	/**
	 * The type of line ending applied to CSS (and its super languages) files.
	 */
	lineEnding?: LineEnding | null;
	/**
	 * What's the max width of a line applied to CSS (and its super languages) files. Defaults
	 * to 80.
	 */
	lineWidth?: number | null;
	/**
	 * The type of quotes used in CSS code. Defaults to double.
	 */
	quoteStyle?: QuoteStyle | null;
}

/**
 * Tab
 *
 * Space
 */
export enum IndentStyle {
	Space = "space",
	Tab = "tab",
}

/**
 * Line Feed only (\n), common on Linux and macOS as well as inside git repos
 *
 * Carriage Return + Line Feed characters (\r\n), common on Windows
 *
 * Carriage Return character only (\r), used very rarely
 */
export enum LineEnding {
	CR = "cr",
	CRLF = "crlf",
	LF = "lf",
}

export enum QuoteStyle {
	Double = "double",
	Single = "single",
}

/**
 * Options that changes how the CSS linter behaves
 */
export interface CSSLinterConfiguration {
	/**
	 * Control the linter for CSS files.
	 */
	enabled?: boolean | null;
}

/**
 * Options that changes how the CSS parser behaves
 */
export interface CSSParserConfiguration {
	/**
	 * Allow comments to appear on incorrect lines in `.css` files
	 */
	allowWrongLineComments?: boolean | null;
	/**
	 * Enables parsing of CSS Modules specific features.
	 */
	cssModules?: boolean | null;
}

/**
 * The configuration of the filesystem
 */
export interface FilesConfiguration {
	/**
	 * Set of file and folder names that should be unconditionally ignored by Biome's scanner.
	 *
	 * Biome maintains an internal list of default ignore entries, which is based on user
	 * feedback and which may change in any release. This setting allows overriding this
	 * internal list completely.
	 *
	 * This is considered an advanced feature that users _should_ not need to tweak themselves,
	 * but they can as a last resort. This setting can only be configured in root
	 * configurations, and is ignored in nested configs.
	 *
	 * Entries must be file or folder *names*. Specific paths and globs are not supported.
	 *
	 * Examples where this may be useful:
	 *
	 * ```jsonc { "files": { "experimentalScannerIgnores": [ // You almost certainly don't want
	 * to scan your `.git` // folder, which is why it's already ignored by default: ".git",
	 *
	 * // But the scanner does scan `node_modules` by default. If // you *really* don't want
	 * this, you can ignore it like // this: "node_modules",
	 *
	 * // But it's probably better to ignore a specific dependency. // For instance, one that
	 * happens to be particularly slow to // scan: "RedisCommander.d.ts", ], } } ```
	 *
	 * Please be aware that rules relying on the module graph or type inference information may
	 * be negatively affected if dependencies of your project aren't (fully) scanned.
	 */
	experimentalScannerIgnores?: string[] | null;
	/**
	 * Tells Biome to not emit diagnostics when handling files that doesn't know
	 */
	ignoreUnknown?: boolean | null;
	/**
	 * A list of glob patterns. Biome will handle only those files/folders that will match these
	 * patterns.
	 */
	includes?: string[] | null;
	/**
	 * The maximum allowed size for source code files in bytes. Files above this limit will be
	 * ignored for performance reasons. Defaults to 1 MiB
	 */
	maxSize?: number | null;
}

/**
 * Generic options applied to all files
 */
export interface FormatterConfiguration {
	/**
	 * The attribute position style in HTML-ish languages. Defaults to auto.
	 */
	attributePosition?: AttributePosition | null;
	/**
	 * Put the `>` of a multi-line HTML or JSX element at the end of the last line instead of
	 * being alone on the next line (does not apply to self closing elements).
	 */
	bracketSameLine?: boolean | null;
	/**
	 * Whether to insert spaces around brackets in object literals. Defaults to true.
	 */
	bracketSpacing?: boolean | null;
	enabled?: boolean | null;
	/**
	 * Whether to expand arrays and objects on multiple lines. When set to `auto`, object
	 * literals are formatted on multiple lines if the first property has a newline, and array
	 * literals are formatted on a single line if it fits in the line. When set to `always`,
	 * these literals are formatted on multiple lines, regardless of length of the list. When
	 * set to `never`, these literals are formatted on a single line if it fits in the line.
	 * When formatting `package.json`, Biome will use `always` unless configured otherwise.
	 * Defaults to "auto".
	 */
	expand?: Expand | null;
	/**
	 * Stores whether formatting should be allowed to proceed if a given file has syntax errors
	 */
	formatWithErrors?: boolean | null;
	/**
	 * A list of glob patterns. The formatter will include files/folders that will match these
	 * patterns.
	 */
	includes?: string[] | null;
	/**
	 * The indent style.
	 */
	indentStyle?: IndentStyle | null;
	/**
	 * The size of the indentation, 2 by default
	 */
	indentWidth?: number | null;
	/**
	 * The type of line ending.
	 */
	lineEnding?: LineEnding | null;
	/**
	 * What's the max width of a line. Defaults to 80.
	 */
	lineWidth?: number | null;
	/**
	 * Use any `.editorconfig` files to configure the formatter. Configuration in `biome.json`
	 * will override `.editorconfig` configuration.
	 *
	 * Default: `true`.
	 */
	useEditorconfig?: boolean | null;
}

export enum AttributePosition {
	Auto = "auto",
	Multiline = "multiline",
}

/**
 * Objects are expanded when the first property has a leading newline. Arrays are always
 * expanded if they are shorter than the line width.
 *
 * Objects and arrays are always expanded.
 *
 * Objects and arrays are never expanded, if they are shorter than the line width.
 */
export enum Expand {
	Always = "always",
	Auto = "auto",
	Never = "never",
}

/**
 * Options applied to GraphQL files
 */
export interface GraphqlConfiguration {
	/**
	 * Assist options
	 */
	assist?: GraphqlAssistConfiguration | null;
	/**
	 * GraphQL formatter options
	 */
	formatter?: GraphqlFormatterConfiguration | null;
	linter?: GraphqlLinterConfiguration | null;
}

/**
 * Options that changes how the GraphQL linter behaves
 */
export interface GraphqlAssistConfiguration {
	/**
	 * Control the formatter for GraphQL files.
	 */
	enabled?: boolean | null;
}

/**
 * Options that changes how the GraphQL formatter behaves
 */
export interface GraphqlFormatterConfiguration {
	/**
	 * Whether to insert spaces around brackets in object literals. Defaults to true.
	 */
	bracketSpacing?: boolean | null;
	/**
	 * Control the formatter for GraphQL files.
	 */
	enabled?: boolean | null;
	/**
	 * The indent style applied to GraphQL files.
	 */
	indentStyle?: IndentStyle | null;
	/**
	 * The size of the indentation applied to GraphQL files. Default to 2.
	 */
	indentWidth?: number | null;
	/**
	 * The type of line ending applied to GraphQL files.
	 */
	lineEnding?: LineEnding | null;
	/**
	 * What's the max width of a line applied to GraphQL files. Defaults to 80.
	 */
	lineWidth?: number | null;
	/**
	 * The type of quotes used in GraphQL code. Defaults to double.
	 */
	quoteStyle?: QuoteStyle | null;
}

/**
 * Options that change how the GraphQL linter behaves.
 */
export interface GraphqlLinterConfiguration {
	/**
	 * Control the formatter for GraphQL files.
	 */
	enabled?: boolean | null;
}

/**
 * Options applied to GritQL files
 */
export interface GritConfiguration {
	/**
	 * Assist options
	 */
	assist?: GritAssistConfiguration | null;
	/**
	 * Formatting options
	 */
	formatter?: GritFormatterConfiguration | null;
	/**
	 * Formatting options
	 */
	linter?: GritLinterConfiguration | null;
}

export interface GritAssistConfiguration {
	/**
	 * Control the assist functionality for Grit files.
	 */
	enabled?: boolean | null;
}

export interface GritFormatterConfiguration {
	/**
	 * Control the formatter for Grit files.
	 */
	enabled?: boolean | null;
	/**
	 * The indent style applied to Grit files.
	 */
	indentStyle?: IndentStyle | null;
	/**
	 * The size of the indentation applied to Grit files. Default to 2.
	 */
	indentWidth?: number | null;
	/**
	 * The type of line ending applied to Grit files.
	 */
	lineEnding?: LineEnding | null;
	/**
	 * What's the max width of a line applied to Grit files. Defaults to 80.
	 */
	lineWidth?: number | null;
}

export interface GritLinterConfiguration {
	/**
	 * Control the linter for Grit files.
	 */
	enabled?: boolean | null;
}

/**
 * Options applied to HTML files
 */
export interface HTMLConfiguration {
	/**
	 * HTML formatter options
	 */
	formatter?: HTMLFormatterConfiguration | null;
	/**
	 * HTML parsing options
	 */
	parser?: null;
}

/**
 * Options that changes how the HTML formatter behaves
 */
export interface HTMLFormatterConfiguration {
	/**
	 * The attribute position style in HTML elements. Defaults to auto.
	 */
	attributePosition?: AttributePosition | null;
	/**
	 * Whether to hug the closing bracket of multiline HTML tags to the end of the last line,
	 * rather than being alone on the following line. Defaults to false.
	 */
	bracketSameLine?: boolean | null;
	/**
	 * Control the formatter for HTML (and its super languages) files.
	 */
	enabled?: boolean | null;
	/**
	 * Whether to indent the `<script>` and `<style>` tags for HTML (and its super languages).
	 * Defaults to false.
	 */
	indentScriptAndStyle?: boolean | null;
	/**
	 * The indent style applied to HTML (and its super languages) files.
	 */
	indentStyle?: IndentStyle | null;
	/**
	 * The size of the indentation applied to HTML (and its super languages) files. Default to 2.
	 */
	indentWidth?: number | null;
	/**
	 * The type of line ending applied to HTML (and its super languages) files.
	 */
	lineEnding?: LineEnding | null;
	/**
	 * What's the max width of a line applied to HTML (and its super languages) files. Defaults
	 * to 80.
	 */
	lineWidth?: number | null;
	/**
	 * Whether void elements should be self-closed. Defaults to never.
	 */
	selfCloseVoidElements?: SelfCloseVoidElements | null;
	/**
	 * Whether to account for whitespace sensitivity when formatting HTML (and its super
	 * languages). Defaults to "css".
	 */
	whitespaceSensitivity?: WhitespaceSensitivity | null;
}

/**
 * The `/` inside void elements is removed by the formatter
 *
 * The `/` inside void elements is always added
 */
export enum SelfCloseVoidElements {
	Always = "always",
	Never = "never",
}

/**
 * The formatter considers whitespace significant for elements that have an "inline" display
 * style by default in browser's user agent style sheets.
 *
 * Leading and trailing whitespace in content is considered significant for all elements.
 *
 * The formatter should leave at least one whitespace character if whitespace is present.
 * Otherwise, if there is no whitespace, it should not add any after `>` or before `<`. In
 * other words, if there's no whitespace, the text content should hug the tags.
 *
 * Example of text hugging the tags: ```html <b >content</b > ```
 *
 * Whitespace is considered insignificant. The formatter is free to remove or add whitespace
 * as it sees fit.
 */
export enum WhitespaceSensitivity {
	CSS = "css",
	Ignore = "ignore",
	Strict = "strict",
}

/**
 * A set of options applied to the JavaScript files
 */
export interface JSConfiguration {
	/**
	 * Assist options
	 */
	assist?: JSAssistConfiguration | null;
	/**
	 * Formatting options
	 */
	formatter?: JSFormatterConfiguration | null;
	/**
	 * A list of global bindings that should be ignored by the analyzers
	 *
	 * If defined here, they should not emit diagnostics.
	 */
	globals?: string[] | null;
	/**
	 * Indicates the type of runtime or transformation used for interpreting JSX.
	 */
	jsxRuntime?: JsxRuntime | null;
	/**
	 * Linter options
	 */
	linter?: JSLinterConfiguration | null;
	/**
	 * Parsing options
	 */
	parser?: JSParserConfiguration | null;
}

/**
 * Assist options specific to the JavaScript assist
 */
export interface JSAssistConfiguration {
	/**
	 * Control the assist for JavaScript (and its super languages) files.
	 */
	enabled?: boolean | null;
}

/**
 * Formatting options specific to the JavaScript files
 */
export interface JSFormatterConfiguration {
	/**
	 * Whether to add non-necessary parentheses to arrow functions. Defaults to "always".
	 */
	arrowParentheses?: ArrowParentheses | null;
	/**
	 * The attribute position style in JSX elements. Defaults to auto.
	 */
	attributePosition?: AttributePosition | null;
	/**
	 * Whether to hug the closing bracket of multiline HTML/JSX tags to the end of the last
	 * line, rather than being alone on the following line. Defaults to false.
	 */
	bracketSameLine?: boolean | null;
	/**
	 * Whether to insert spaces around brackets in object literals. Defaults to true.
	 */
	bracketSpacing?: boolean | null;
	/**
	 * Control the formatter for JavaScript (and its super languages) files.
	 */
	enabled?: boolean | null;
	/**
	 * Whether to expand arrays and objects on multiple lines. When set to `auto`, object
	 * literals are formatted on multiple lines if the first property has a newline, and array
	 * literals are formatted on a single line if it fits in the line. When set to `always`,
	 * these literals are formatted on multiple lines, regardless of length of the list. When
	 * set to `never`, these literals are formatted on a single line if it fits in the line.
	 * When formatting `package.json`, Biome will use `always` unless configured otherwise.
	 * Defaults to "auto".
	 */
	expand?: Expand | null;
	/**
	 * The indent style applied to JavaScript (and its super languages) files.
	 */
	indentStyle?: IndentStyle | null;
	/**
	 * The size of the indentation applied to JavaScript (and its super languages) files.
	 * Default to 2.
	 */
	indentWidth?: number | null;
	/**
	 * The type of quotes used in JSX. Defaults to double.
	 */
	jsxQuoteStyle?: QuoteStyle | null;
	/**
	 * The type of line ending applied to JavaScript (and its super languages) files.
	 */
	lineEnding?: LineEnding | null;
	/**
	 * What's the max width of a line applied to JavaScript (and its super languages) files.
	 * Defaults to 80.
	 */
	lineWidth?: number | null;
	/**
	 * When properties in objects are quoted. Defaults to asNeeded.
	 */
	quoteProperties?: QuoteProperties | null;
	/**
	 * The type of quotes used in JavaScript code. Defaults to double.
	 */
	quoteStyle?: QuoteStyle | null;
	/**
	 * Whether the formatter prints semicolons for all statements or only in for statements
	 * where it is necessary because of ASI.
	 */
	semicolons?: ArrowParentheses | null;
	/**
	 * Print trailing commas wherever possible in multi-line comma-separated syntactic
	 * structures. Defaults to "all".
	 */
	trailingCommas?: TrailingCommas | null;
}

export enum ArrowParentheses {
	Always = "always",
	AsNeeded = "asNeeded",
}

export enum QuoteProperties {
	AsNeeded = "asNeeded",
	Preserve = "preserve",
}

/**
 * Trailing commas wherever possible (including function parameters and calls).
 *
 * Trailing commas where valid in ES5 (objects, arrays, etc.). No trailing commas in type
 * parameters in TypeScript.
 *
 * No trailing commas.
 */
export enum TrailingCommas {
	All = "all",
	Es5 = "es5",
	None = "none",
}

/**
 * Indicates a modern or native JSX environment, that doesn't require special handling by
 * Biome.
 *
 * Indicates a classic React environment that requires the `React` import.
 *
 * Corresponds to the `react` value for the `jsx` option in TypeScript's `tsconfig.json`.
 *
 * This option should only be necessary if you cannot upgrade to a React version that
 * supports the new JSX runtime. For more information about the old vs. new JSX runtime,
 * please see:
 * <https://legacy.reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html>
 */
export enum JsxRuntime {
	ReactClassic = "reactClassic",
	Transparent = "transparent",
}

/**
 * Linter options specific to the JavaScript linter
 */
export interface JSLinterConfiguration {
	/**
	 * Control the linter for JavaScript (and its super languages) files.
	 */
	enabled?: boolean | null;
}

/**
 * Options that changes how the JavaScript parser behaves
 */
export interface JSParserConfiguration {
	/**
	 * Enables parsing of Grit metavariables. Defaults to `false`.
	 */
	gritMetavariables?: boolean | null;
	/**
	 * When enabled, files like `.js`/`.mjs`/`.cjs` may contain JSX syntax.
	 *
	 * Defaults to `true`.
	 */
	jsxEverywhere?: boolean | null;
	/**
	 * It enables the experimental and unsafe parsing of parameter decorators
	 *
	 * These decorators belong to an old proposal, and they are subject to change.
	 */
	unsafeParameterDecoratorsEnabled?: boolean | null;
}

/**
 * Options applied to JSON files
 */
export interface JSONConfiguration {
	/**
	 * Assist options
	 */
	assist?: JSONAssistConfiguration | null;
	/**
	 * Formatting options
	 */
	formatter?: JSONFormatterConfiguration | null;
	/**
	 * Linting options
	 */
	linter?: JSONLinterConfiguration | null;
	/**
	 * Parsing options
	 */
	parser?: JSONParserConfiguration | null;
}

/**
 * Linter options specific to the JSON linter
 */
export interface JSONAssistConfiguration {
	/**
	 * Control the assist for JSON (and its super languages) files.
	 */
	enabled?: boolean | null;
}

export interface JSONFormatterConfiguration {
	/**
	 * Whether to insert spaces around brackets in object literals. Defaults to true.
	 */
	bracketSpacing?: boolean | null;
	/**
	 * Control the formatter for JSON (and its super languages) files.
	 */
	enabled?: boolean | null;
	/**
	 * Whether to expand arrays and objects on multiple lines. When set to `auto`, object
	 * literals are formatted on multiple lines if the first property has a newline, and array
	 * literals are formatted on a single line if it fits in the line. When set to `always`,
	 * these literals are formatted on multiple lines, regardless of length of the list. When
	 * set to `never`, these literals are formatted on a single line if it fits in the line.
	 * When formatting `package.json`, Biome will use `always` unless configured otherwise.
	 * Defaults to "auto".
	 */
	expand?: Expand | null;
	/**
	 * The indent style applied to JSON (and its super languages) files.
	 */
	indentStyle?: IndentStyle | null;
	/**
	 * The size of the indentation applied to JSON (and its super languages) files. Default to 2.
	 */
	indentWidth?: number | null;
	/**
	 * The type of line ending applied to JSON (and its super languages) files.
	 */
	lineEnding?: LineEnding | null;
	/**
	 * What's the max width of a line applied to JSON (and its super languages) files. Defaults
	 * to 80.
	 */
	lineWidth?: number | null;
	/**
	 * Print trailing commas wherever possible in multi-line comma-separated syntactic
	 * structures. Defaults to "none".
	 */
	trailingCommas?: TrailingCommas2 | null;
}

/**
 * The formatter will remove the trailing commas.
 *
 * The trailing commas are allowed and advised only in JSONC files. Trailing commas are
 * removed from JSON files.
 */
export enum TrailingCommas2 {
	All = "all",
	None = "none",
}

/**
 * Linter options specific to the JSON linter
 */
export interface JSONLinterConfiguration {
	/**
	 * Control the linter for JSON (and its super languages) files.
	 */
	enabled?: boolean | null;
}

/**
 * Options that changes how the JSON parser behaves
 */
export interface JSONParserConfiguration {
	/**
	 * Allow parsing comments in `.json` files
	 */
	allowComments?: boolean | null;
	/**
	 * Allow parsing trailing commas in `.json` files
	 */
	allowTrailingCommas?: boolean | null;
}

export interface LinterConfiguration {
	/**
	 * An object where the keys are the names of the domains, and the values are `all`,
	 * `recommended`, or `none`.
	 */
	domains?: { [key: string]: RuleDomainValue } | null;
	/**
	 * if `false`, it disables the feature and the linter won't be executed. `true` by default
	 */
	enabled?: boolean | null;
	/**
	 * A list of glob patterns. The analyzer will handle only those files/folders that will
	 * match these patterns.
	 */
	includes?: string[] | null;
	/**
	 * List of rules
	 */
	rules?: Rules | null;
}

/**
 * Enables all the rules that belong to this domain
 *
 * Disables all the rules that belong to this domain
 *
 * It enables only the recommended rules for this domain
 */
export enum RuleDomainValue {
	All = "all",
	None = "none",
	Recommended = "recommended",
}

export interface Rules {
	a11y?: A11Y | RulePlainConfiguration | null;
	complexity?: Complexity | RulePlainConfiguration | null;
	correctness?: Correctness | RulePlainConfiguration | null;
	nursery?: Nursery | RulePlainConfiguration | null;
	performance?: Performance | RulePlainConfiguration | null;
	/**
	 * It enables the lint rules recommended by Biome. `true` by default.
	 */
	recommended?: boolean | null;
	security?: Security | RulePlainConfiguration | null;
	style?: Style | RulePlainConfiguration | null;
	suspicious?: Suspicious | RulePlainConfiguration | null;
}

/**
 * A list of rules that belong to this group
 */
export interface A11Y {
	/**
	 * Enforce that the accessKey attribute is not used on any HTML element.
	 */
	noAccessKey?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce that aria-hidden="true" is not set on focusable elements.
	 */
	noAriaHiddenOnFocusable?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforce that elements that do not support ARIA roles, states, and properties do not have
	 * those attributes.
	 */
	noAriaUnsupportedElements?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforce that autoFocus prop is not used on elements.
	 */
	noAutofocus?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforces that no distracting elements are used.
	 */
	noDistractingElements?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * The scope prop should be used only on \<th> elements.
	 */
	noHeaderScope?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce that non-interactive ARIA roles are not assigned to interactive HTML elements.
	 */
	noInteractiveElementToNoninteractiveRole?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforce that a label element or component has a text label and an associated input.
	 */
	noLabelWithoutControl?:
		| RuleWithNoLabelWithoutControlOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforce that interactive ARIA roles are not assigned to non-interactive HTML elements.
	 */
	noNoninteractiveElementToInteractiveRole?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforce that tabIndex is not assigned to non-interactive HTML elements.
	 */
	noNoninteractiveTabindex?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Prevent the usage of positive integers on tabIndex property
	 */
	noPositiveTabindex?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce img alt prop does not contain the word "image", "picture", or "photo".
	 */
	noRedundantAlt?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce explicit role property is not the same as implicit/default role property on an
	 * element.
	 */
	noRedundantRoles?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce that static, visible elements (such as \<div>) that have click handlers use the
	 * valid role attribute.
	 */
	noStaticElementInteractions?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforces the usage of the title element for the svg element.
	 */
	noSvgWithoutTitle?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * It enables the recommended rules for this group
	 */
	recommended?: boolean | null;
	/**
	 * Enforce that all elements that require alternative text have meaningful information to
	 * relay back to the end user.
	 */
	useAltText?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce that anchors have content and that the content is accessible to screen readers.
	 */
	useAnchorContent?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce that tabIndex is assigned to non-interactive HTML elements with
	 * aria-activedescendant.
	 */
	useAriaActivedescendantWithTabindex?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforce that elements with ARIA roles must have all required ARIA attributes for that
	 * role.
	 */
	useAriaPropsForRole?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce that ARIA properties are valid for the roles that are supported by the element.
	 */
	useAriaPropsSupportedByRole?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforces the usage of the attribute type for the element button
	 */
	useButtonType?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Elements with an interactive role and interaction handlers must be focusable.
	 */
	useFocusableInteractive?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow a missing generic family keyword within font families.
	 */
	useGenericFontNames?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce that heading elements (h1, h2, etc.) have content and that the content is
	 * accessible to screen readers. Accessible means that it is not hidden using the
	 * aria-hidden prop.
	 */
	useHeadingContent?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce that html element has lang attribute.
	 */
	useHtmlLang?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforces the usage of the attribute title for the element iframe.
	 */
	useIframeTitle?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce onClick is accompanied by at least one of the following: onKeyUp, onKeyDown,
	 * onKeyPress.
	 */
	useKeyWithClickEvents?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce onMouseOver / onMouseOut are accompanied by onFocus / onBlur.
	 */
	useKeyWithMouseEvents?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforces that audio and video elements must have a track for captions.
	 */
	useMediaCaption?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * It detects the use of role attributes in JSX elements and suggests using semantic
	 * elements instead.
	 */
	useSemanticElements?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce that all anchors are valid, and they are navigable elements.
	 */
	useValidAnchor?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Ensures that ARIA properties aria-* are all valid.
	 */
	useValidAriaProps?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Elements with ARIA roles must use a valid, non-abstract ARIA role.
	 */
	useValidAriaRole?:
		| RuleWithValidAriaRoleOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforce that ARIA state and property values are valid.
	 */
	useValidAriaValues?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Use valid values for the autocomplete attribute on input elements.
	 */
	useValidAutocomplete?:
		| RuleWithUseValidAutocompleteOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Ensure that the attribute passed to the lang attribute is a correct ISO language and/or
	 * country.
	 */
	useValidLang?: RuleWithNoOptions | RulePlainConfiguration | null;
}

export interface RuleWithFixNoOptions {
	/**
	 * The kind of the code actions emitted by the rule
	 */
	fix?: FixKind | null;
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
}

/**
 * The rule doesn't emit code actions.
 *
 * The rule emits a code action that is safe to apply. Usually these fixes don't change the
 * semantic of the program.
 *
 * The rule emits a code action that is _unsafe_ to apply. Usually these fixes remove
 * comments, or change the semantic of the program.
 */
export enum FixKind {
	None = "none",
	Safe = "safe",
	Unsafe = "unsafe",
}

/**
 * The severity of the emitted diagnostics by the rule
 *
 * Enables the rule using the default severity of the rule
 *
 * Enables the rule, and it will emit a diagnostic with information severity
 *
 * Enables the rule, and it will emit a diagnostic with warning severity
 *
 * Enables the rule, and it will emit a diagnostic with error severity
 *
 * It disables all the rules of this group
 *
 * It enables all the rules of this group, with their default severity
 *
 * It enables all the rules of this group, and set their severity to "info"
 *
 * It enables all the rules of this group, and set their severity to "warn"
 *
 * It enables all the rules of this group, and set their severity to "error+"
 */
export enum RulePlainConfiguration {
	Error = "error",
	Info = "info",
	Off = "off",
	On = "on",
	Warn = "warn",
}

export interface RuleWithNoLabelWithoutControlOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: NoLabelWithoutControlOptions;
}

/**
 * Rule's options
 */
export interface NoLabelWithoutControlOptions {
	/**
	 * Array of component names that should be considered the same as an `input` element.
	 */
	inputComponents?: string[];
	/**
	 * Array of attributes that should be treated as the `label` accessible text content.
	 */
	labelAttributes?: string[];
	/**
	 * Array of component names that should be considered the same as a `label` element.
	 */
	labelComponents?: string[];
}

export interface RuleWithNoOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
}

export interface RuleWithValidAriaRoleOptions {
	/**
	 * The kind of the code actions emitted by the rule
	 */
	fix?: FixKind | null;
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: ValidAriaRoleOptions;
}

/**
 * Rule's options
 */
export interface ValidAriaRoleOptions {
	allowInvalidRoles?: string[];
	ignoreNonDom?: boolean;
}

export interface RuleWithUseValidAutocompleteOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: UseValidAutocompleteOptions;
}

/**
 * Rule's options
 */
export interface UseValidAutocompleteOptions {
	/**
	 * `input` like custom components that should be checked.
	 */
	inputComponents?: string[];
}

/**
 * A list of rules that belong to this group
 */
export interface Complexity {
	/**
	 * Disallow unclear usage of consecutive space characters in regular expression literals
	 */
	noAdjacentSpacesInRegex?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow the use of arguments.
	 */
	noArguments?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow primitive type aliases and misleading types.
	 */
	noBannedTypes?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow comma operator.
	 */
	noCommaOperator?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow empty type parameters in type aliases and interfaces.
	 */
	noEmptyTypeParameters?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow functions that exceed a given Cognitive Complexity score.
	 */
	noExcessiveCognitiveComplexity?:
		| RuleWithComplexityOptions
		| RulePlainConfiguration
		| null;
	/**
	 * This rule enforces a maximum depth to nested describe() in test files.
	 */
	noExcessiveNestedTestSuites?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow unnecessary boolean casts
	 */
	noExtraBooleanCast?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow to use unnecessary callback on flatMap.
	 */
	noFlatMapIdentity?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Prefer for...of statement instead of Array.forEach.
	 */
	noForEach?: RuleWithNoForEachOptions | RulePlainConfiguration | null;
	/**
	 * This rule reports when a class has no non-static members, such as for a class used
	 * exclusively as a static namespace.
	 */
	noStaticOnlyClass?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow this and super in static contexts.
	 */
	noThisInStatic?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unnecessary catch clauses.
	 */
	noUselessCatch?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unnecessary constructors.
	 */
	noUselessConstructor?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Avoid using unnecessary continue.
	 */
	noUselessContinue?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow empty exports that don't change anything in a module file.
	 */
	noUselessEmptyExport?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unnecessary escape sequence in regular expression literals.
	 */
	noUselessEscapeInRegex?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unnecessary fragments
	 */
	noUselessFragments?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unnecessary labels.
	 */
	noUselessLabel?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unnecessary nested block statements.
	 */
	noUselessLoneBlockStatements?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow renaming import, export, and destructured assignments to the same name.
	 */
	noUselessRename?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unnecessary concatenation of string or template literals.
	 */
	noUselessStringConcat?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unnecessary String.raw function in template string literals without any escape
	 * sequence.
	 */
	noUselessStringRaw?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow useless case in switch statements.
	 */
	noUselessSwitchCase?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow ternary operators when simpler alternatives exist.
	 */
	noUselessTernary?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow useless this aliasing.
	 */
	noUselessThisAlias?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow using any or unknown as type constraint.
	 */
	noUselessTypeConstraint?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow initializing variables to undefined.
	 */
	noUselessUndefinedInitialization?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow the use of void operators, which is not a familiar operator.
	 */
	noVoid?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * It enables the recommended rules for this group
	 */
	recommended?: boolean | null;
	/**
	 * Use arrow functions over function expressions.
	 */
	useArrowFunction?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Use Date.now() to get the number of milliseconds since the Unix Epoch.
	 */
	useDateNow?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Promotes the use of .flatMap() when map().flat() are used together.
	 */
	useFlatMap?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce the usage of a literal access to properties over computed property access.
	 */
	useLiteralKeys?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow parseInt() and Number.parseInt() in favor of binary, octal, and hexadecimal
	 * literals
	 */
	useNumericLiterals?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce using concise optional chain instead of chained logical expressions.
	 */
	useOptionalChain?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce the use of the regular expression literals instead of the RegExp constructor if
	 * possible.
	 */
	useRegexLiterals?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow number literal object member names which are not base 10 or use underscore as
	 * separator.
	 */
	useSimpleNumberKeys?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Discard redundant terms from logical expressions.
	 */
	useSimplifiedLogicExpression?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforce the use of while loops instead of for loops when the initializer and update
	 * expressions are not needed.
	 */
	useWhile?: RuleWithFixNoOptions | RulePlainConfiguration | null;
}

export interface RuleWithComplexityOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: ComplexityOptions;
}

/**
 * Rule's options
 *
 * Options for the rule `noExcessiveCognitiveComplexity`.
 */
export interface ComplexityOptions {
	/**
	 * The maximum complexity score that we allow. Anything higher is considered excessive.
	 */
	maxAllowedComplexity?: number;
}

export interface RuleWithNoForEachOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: NoForEachOptions;
}

/**
 * Rule's options
 */
export interface NoForEachOptions {
	/**
	 * A list of variable names allowed for `forEach` calls.
	 */
	allowedIdentifiers?: string[];
}

/**
 * A list of rules that belong to this group
 */
export interface Correctness {
	/**
	 * Prevent passing of children as props.
	 */
	noChildrenProp?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow constant expressions in conditions
	 */
	noConstantCondition?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow the use of Math.min and Math.max to clamp a value where the result itself is
	 * constant.
	 */
	noConstantMathMinMaxClamp?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Prevents from having const variables being re-assigned.
	 */
	noConstAssign?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow returning a value from a constructor.
	 */
	noConstructorReturn?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow empty character classes in regular expression literals.
	 */
	noEmptyCharacterClassInRegex?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallows empty destructuring patterns.
	 */
	noEmptyPattern?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow calling global object properties as functions
	 */
	noGlobalObjectCalls?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow function and var declarations that are accessible outside their block.
	 */
	noInnerDeclarations?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Ensure that builtins are correctly instantiated.
	 */
	noInvalidBuiltinInstantiation?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Prevents the incorrect use of super() inside classes. It also checks whether a call
	 * super() is missing from classes that extends other constructors.
	 */
	noInvalidConstructorSuper?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow non-standard direction values for linear gradient functions.
	 */
	noInvalidDirectionInLinearGradient?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallows invalid named grid areas in CSS Grid Layouts.
	 */
	noInvalidGridAreas?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow the use of @import at-rules in invalid positions.
	 */
	noInvalidPositionAtImportRule?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow the use of variables and function parameters before their declaration
	 */
	noInvalidUseBeforeDeclaration?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow missing var function for css variables.
	 */
	noMissingVarFunction?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Forbid the use of Node.js builtin modules.
	 */
	noNodejsModules?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow \8 and \9 escape sequences in string literals.
	 */
	noNonoctalDecimalEscape?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow literal numbers that lose precision
	 */
	noPrecisionLoss?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Restrict imports of private exports.
	 */
	noPrivateImports?:
		| RuleWithNoPrivateImportsOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Prevent the usage of the return value of React.render.
	 */
	noRenderReturnValue?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow assignments where both sides are exactly the same.
	 */
	noSelfAssign?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow returning a value from a setter
	 */
	noSetterReturn?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow comparison of expressions modifying the string case with non-compliant value.
	 */
	noStringCaseMismatch?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow lexical declarations in switch clauses.
	 */
	noSwitchDeclarations?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow the use of dependencies that aren't specified in the package.json.
	 */
	noUndeclaredDependencies?:
		| RuleWithNoUndeclaredDependenciesOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Prevents the usage of variables that haven't been declared inside the document.
	 */
	noUndeclaredVariables?:
		| RuleWithUndeclaredVariablesOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow unknown CSS value functions.
	 */
	noUnknownFunction?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unknown media feature names.
	 */
	noUnknownMediaFeatureName?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unknown properties.
	 */
	noUnknownProperty?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unknown pseudo-class selectors.
	 */
	noUnknownPseudoClass?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unknown pseudo-element selectors.
	 */
	noUnknownPseudoElement?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unknown type selectors.
	 */
	noUnknownTypeSelector?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unknown CSS units.
	 */
	noUnknownUnit?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unmatchable An+B selectors.
	 */
	noUnmatchableAnbSelector?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unreachable code
	 */
	noUnreachable?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Ensures the super() constructor is called exactly once on every code  path in a class
	 * constructor before this is accessed if the class has a superclass
	 */
	noUnreachableSuper?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow control flow statements in finally blocks.
	 */
	noUnsafeFinally?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow the use of optional chaining in contexts where the undefined value is not
	 * allowed.
	 */
	noUnsafeOptionalChaining?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unused function parameters.
	 */
	noUnusedFunctionParameters?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow unused imports.
	 */
	noUnusedImports?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unused labels.
	 */
	noUnusedLabels?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unused private class members
	 */
	noUnusedPrivateClassMembers?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow unused variables.
	 */
	noUnusedVariables?:
		| RuleWithNoUnusedVariablesOptions
		| RulePlainConfiguration
		| null;
	/**
	 * This rules prevents void elements (AKA self-closing elements) from having children.
	 */
	noVoidElementsWithChildren?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow returning a value from a function with the return type 'void'
	 */
	noVoidTypeReturn?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * It enables the recommended rules for this group
	 */
	recommended?: boolean | null;
	/**
	 * Enforce all dependencies are correctly specified in a React hook.
	 */
	useExhaustiveDependencies?:
		| RuleWithUseExhaustiveDependenciesOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforce that all React hooks are being called from the Top Level component functions.
	 */
	useHookAtTopLevel?:
		| RuleWithDeprecatedHooksOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforce file extensions for relative imports.
	 */
	useImportExtensions?:
		| RuleWithUseImportExtensionsOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Require calls to isNaN() when checking for NaN.
	 */
	useIsNan?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow missing key props in iterators/collection literals.
	 */
	useJsxKeyInIterable?:
		| RuleWithUseJsxKeyInIterableOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforce "for" loop update clause moving the counter in the right direction.
	 */
	useValidForDirection?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * This rule checks that the result of a typeof expression is compared to a valid value.
	 */
	useValidTypeof?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Require generator functions to contain yield.
	 */
	useYield?: RuleWithNoOptions | RulePlainConfiguration | null;
}

export interface RuleWithNoPrivateImportsOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: NoPrivateImportsOptions;
}

/**
 * Rule's options
 *
 * Options for the rule `noPrivateImports`.
 */
export interface NoPrivateImportsOptions {
	/**
	 * The default visibility to assume for symbols without visibility tag.
	 *
	 * Default: **public**.
	 */
	defaultVisibility?: Visibility;
}

/**
 * The default visibility to assume for symbols without visibility tag.
 *
 * Default: **public**.
 */
export enum Visibility {
	Package = "package",
	Private = "private",
	Public = "public",
}

export interface RuleWithNoUndeclaredDependenciesOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: NoUndeclaredDependenciesOptions;
}

/**
 * Rule's options
 */
export interface NoUndeclaredDependenciesOptions {
	/**
	 * If set to `false`, then the rule will show an error when `devDependencies` are imported.
	 * Defaults to `true`.
	 */
	devDependencies?: string[] | boolean;
	/**
	 * If set to `false`, then the rule will show an error when `optionalDependencies` are
	 * imported. Defaults to `true`.
	 */
	optionalDependencies?: string[] | boolean;
	/**
	 * If set to `false`, then the rule will show an error when `peerDependencies` are imported.
	 * Defaults to `true`.
	 */
	peerDependencies?: string[] | boolean;
}

export interface RuleWithUndeclaredVariablesOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: UndeclaredVariablesOptions;
}

/**
 * Rule's options
 */
export interface UndeclaredVariablesOptions {
	/**
	 * Check undeclared types.
	 */
	checkTypes?: boolean;
	[property: string]: any;
}

export interface RuleWithNoUnusedVariablesOptions {
	/**
	 * The kind of the code actions emitted by the rule
	 */
	fix?: FixKind | null;
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: NoUnusedVariablesOptions;
}

/**
 * Rule's options
 */
export interface NoUnusedVariablesOptions {
	/**
	 * Whether to ignore unused variables from an object destructuring with a spread.
	 */
	ignoreRestSiblings?: boolean;
}

export interface RuleWithUseExhaustiveDependenciesOptions {
	/**
	 * The kind of the code actions emitted by the rule
	 */
	fix?: FixKind | null;
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: UseExhaustiveDependenciesOptions;
}

/**
 * Rule's options
 *
 * Options for the rule `useExhaustiveDependencies`
 */
export interface UseExhaustiveDependenciesOptions {
	/**
	 * List of hooks of which the dependencies should be validated.
	 */
	hooks?: Hook[];
	/**
	 * Whether to report an error when a hook has no dependencies array.
	 */
	reportMissingDependenciesArray?: boolean;
	/**
	 * Whether to report an error when a dependency is listed in the dependencies array but
	 * isn't used. Defaults to true.
	 */
	reportUnnecessaryDependencies?: boolean;
}

export interface Hook {
	/**
	 * The "position" of the closure function, starting from zero.
	 *
	 * For example, for React's `useEffect()` hook, the closure index is 0.
	 */
	closureIndex?: number | null;
	/**
	 * The "position" of the array of dependencies, starting from zero.
	 *
	 * For example, for React's `useEffect()` hook, the dependencies index is 1.
	 */
	dependenciesIndex?: number | null;
	/**
	 * The name of the hook.
	 */
	name?: string;
	/**
	 * Whether the result of the hook is stable.
	 *
	 * Set to `true` to mark the identity of the hook's return value as stable, or use a
	 * number/an array of numbers to mark the "positions" in the return array as stable.
	 *
	 * For example, for React's `useRef()` hook the value would be `true`, while for
	 * `useState()` it would be `[1]`.
	 */
	stableResult?: number[] | boolean | null;
}

export interface RuleWithDeprecatedHooksOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: DeprecatedHooksOptions;
}

/**
 * Rule's options
 *
 * Options for the `useHookAtTopLevel` rule have been deprecated, since we now use the React
 * hook naming convention to determine whether a function is a hook.
 */
export interface DeprecatedHooksOptions {}

export interface RuleWithUseImportExtensionsOptions {
	/**
	 * The kind of the code actions emitted by the rule
	 */
	fix?: FixKind | null;
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: UseImportExtensionsOptions;
}

/**
 * Rule's options
 */
export interface UseImportExtensionsOptions {
	/**
	 * If `true`, the suggested extension is always `.js` regardless of what extension the
	 * source file has in your project.
	 */
	forceJsExtensions?: boolean;
}

export interface RuleWithUseJsxKeyInIterableOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: UseJsxKeyInIterableOptions;
}

/**
 * Rule's options
 */
export interface UseJsxKeyInIterableOptions {
	/**
	 * Set to `true` to check shorthand fragments (`<></>`)
	 */
	checkShorthandFragments?: boolean;
}

/**
 * A list of rules that belong to this group
 */
export interface Nursery {
	/**
	 * Disallow await inside loops.
	 */
	noAwaitInLoop?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow bitwise operators.
	 */
	noBitwiseOperators?:
		| RuleWithNoBitwiseOperatorsOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow expressions where the operation doesn't affect the value
	 */
	noConstantBinaryExpression?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow destructuring props inside JSX components in Solid projects.
	 */
	noDestructuredProps?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Require Promise-like statements to be handled appropriately.
	 */
	noFloatingPromises?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow the use of __dirname and __filename in the global scope.
	 */
	noGlobalDirnameFilename?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow the use of the !important style.
	 */
	noImportantStyles?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Prevent import cycles.
	 */
	noImportCycles?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallows defining React components inside other components.
	 */
	noNestedComponentDefinitions?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow use event handlers on non-interactive elements.
	 */
	noNoninteractiveElementInteractions?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow the use of process global.
	 */
	noProcessGlobal?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow assigning to React component props.
	 */
	noReactPropAssign?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow the use of configured elements.
	 */
	noRestrictedElements?:
		| RuleWithNoRestrictedElementsOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow usage of sensitive data such as API keys and tokens.
	 */
	noSecrets?: RuleWithNoSecretsOptions | RulePlainConfiguration | null;
	/**
	 * Disallow variable declarations from shadowing variables declared in the outer scope.
	 */
	noShadow?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Prevents the use of the TypeScript directive @ts-ignore.
	 */
	noTsIgnore?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unknown at-rules.
	 */
	noUnknownAtRule?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Warn when importing non-existing exports.
	 */
	noUnresolvedImports?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Prevent duplicate polyfills from Polyfill.io.
	 */
	noUnwantedPolyfillio?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow useless backreferences in regular expression literals that always match an empty
	 * string.
	 */
	noUselessBackrefInRegex?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unnecessary escapes in string literals.
	 */
	noUselessEscapeInString?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow the use of useless undefined.
	 */
	noUselessUndefined?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * It enables the recommended rules for this group
	 */
	recommended?: boolean | null;
	/**
	 * Enforce that getters and setters for the same property are adjacent in class and object
	 * definitions.
	 */
	useAdjacentGetterSetter?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Require the consistent declaration of object literals. Defaults to explicit definitions.
	 */
	useConsistentObjectDefinition?:
		| RuleWithUseConsistentObjectDefinitionOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Use static Response methods instead of new Response() constructor when possible.
	 */
	useConsistentResponse?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Require switch-case statements to be exhaustive.
	 */
	useExhaustiveSwitchCases?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforce types in functions, methods, variables, and parameters.
	 */
	useExplicitType?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Require that all exports are declared after all non-export statements.
	 */
	useExportsLast?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce using Solid's \<For /> component for mapping an array to JSX elements.
	 */
	useForComponent?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Ensure the preconnect attribute is used when using Google Fonts.
	 */
	useGoogleFontPreconnect?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Prefer Array#{indexOf,lastIndexOf}() over Array#{findIndex,findLastIndex}() when looking
	 * for the index of an item.
	 */
	useIndexOf?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce consistent return values in iterable callbacks.
	 */
	useIterableCallbackReturn?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforces the use of with { type: "json" } for JSON module imports.
	 */
	useJsonImportAttribute?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce specifying the name of GraphQL operations.
	 */
	useNamedOperation?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Validates that all enum values are capitalized.
	 */
	useNamingConvention?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce the use of numeric separators in numeric literals.
	 */
	useNumericSeparators?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Prefer object spread over Object.assign() when constructing new objects.
	 */
	useObjectSpread?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce the consistent use of the radix argument when using parseInt().
	 */
	useParseIntRadix?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce marking members as readonly if they are never modified outside the constructor.
	 */
	useReadonlyClassProperties?:
		| RuleWithReadonlyClassPropertiesOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforce JSDoc comment lines to start with a single asterisk, except for the first one.
	 */
	useSingleJsDocAsterisk?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce the sorting of CSS utility classes.
	 */
	useSortedClasses?:
		| RuleWithUtilityClassSortingOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Require a description parameter for the Symbol().
	 */
	useSymbolDescription?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Prevent the usage of static string literal id attribute on elements.
	 */
	useUniqueElementIds?: RuleWithNoOptions | RulePlainConfiguration | null;
}

export interface RuleWithNoBitwiseOperatorsOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: NoBitwiseOperatorsOptions;
}

/**
 * Rule's options
 */
export interface NoBitwiseOperatorsOptions {
	/**
	 * Allows a list of bitwise operators to be used as exceptions.
	 */
	allow?: string[];
}

export interface RuleWithNoRestrictedElementsOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: NoRestrictedElementsOptions;
}

/**
 * Rule's options
 */
export interface NoRestrictedElementsOptions {
	/**
	 * Elements to restrict. Each key is the element name, and the value is the message to show
	 * when the element is used.
	 */
	elements?: { [key: string]: string };
}

export interface RuleWithNoSecretsOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: NoSecretsOptions;
}

/**
 * Rule's options
 */
export interface NoSecretsOptions {
	/**
	 * Set entropy threshold (default is 41).
	 */
	entropyThreshold?: number | null;
}

export interface RuleWithUseConsistentObjectDefinitionOptions {
	/**
	 * The kind of the code actions emitted by the rule
	 */
	fix?: FixKind | null;
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: UseConsistentObjectDefinitionOptions;
}

/**
 * Rule's options
 */
export interface UseConsistentObjectDefinitionOptions {
	/**
	 * The preferred syntax to enforce.
	 */
	syntax?: ObjectPropertySyntax;
}

/**
 * The preferred syntax to enforce.
 *
 * `{foo: foo}`
 *
 * `{foo}`
 */
export enum ObjectPropertySyntax {
	Explicit = "explicit",
	Shorthand = "shorthand",
}

export interface RuleWithReadonlyClassPropertiesOptions {
	/**
	 * The kind of the code actions emitted by the rule
	 */
	fix?: FixKind | null;
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: ReadonlyClassPropertiesOptions;
}

/**
 * Rule's options
 */
export interface ReadonlyClassPropertiesOptions {
	/**
	 * When `true`, the keywords `public`, `protected`, and `private` are analyzed by the rule.
	 */
	checkAllProperties?: boolean;
}

export interface RuleWithUtilityClassSortingOptions {
	/**
	 * The kind of the code actions emitted by the rule
	 */
	fix?: FixKind | null;
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: UtilityClassSortingOptions;
}

/**
 * Rule's options
 */
export interface UtilityClassSortingOptions {
	/**
	 * Additional attributes that will be sorted.
	 */
	attributes?: string[] | null;
	/**
	 * Names of the functions or tagged templates that will be sorted.
	 */
	functions?: string[] | null;
}

/**
 * A list of rules that belong to this group
 */
export interface Performance {
	/**
	 * Disallow the use of spread (...) syntax on accumulators.
	 */
	noAccumulatingSpread?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow the use of barrel file.
	 */
	noBarrelFile?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow the use of the delete operator.
	 */
	noDelete?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow accessing namespace imports dynamically.
	 */
	noDynamicNamespaceImportAccess?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Prevent usage of \<img> element in a Next.js project.
	 */
	noImgElement?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow the use of namespace imports.
	 */
	noNamespaceImport?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Avoid re-export all.
	 */
	noReExportAll?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * It enables the recommended rules for this group
	 */
	recommended?: boolean | null;
	/**
	 * Require regex literals to be declared at the top level.
	 */
	useTopLevelRegex?: RuleWithNoOptions | RulePlainConfiguration | null;
}

/**
 * A list of rules that belong to this group
 */
export interface Security {
	/**
	 * Disallow target="_blank" attribute without rel="noopener".
	 */
	noBlankTarget?: RuleWithNoBlankTargetOptions | RulePlainConfiguration | null;
	/**
	 * Prevent the usage of dangerous JSX props
	 */
	noDangerouslySetInnerHtml?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Report when a DOM element or a component uses both children and dangerouslySetInnerHTML
	 * prop.
	 */
	noDangerouslySetInnerHtmlWithChildren?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow the use of global eval().
	 */
	noGlobalEval?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * It enables the recommended rules for this group
	 */
	recommended?: boolean | null;
}

export interface RuleWithNoBlankTargetOptions {
	/**
	 * The kind of the code actions emitted by the rule
	 */
	fix?: FixKind | null;
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: NoBlankTargetOptions;
}

/**
 * Rule's options
 */
export interface NoBlankTargetOptions {
	/**
	 * List of domains where `target="_blank"` is allowed without `rel="noopener"`.
	 */
	allowDomains?: string[];
	/**
	 * Whether `noreferrer` is allowed in addition to `noopener`.
	 */
	allowNoReferrer?: boolean;
}

/**
 * A list of rules that belong to this group
 */
export interface Style {
	/**
	 * Disallow use of CommonJs module system in favor of ESM style imports.
	 */
	noCommonJs?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow default exports.
	 */
	noDefaultExport?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow a lower specificity selector from coming after a higher specificity selector.
	 */
	noDescendingSpecificity?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow using a callback in asynchronous tests and hooks.
	 */
	noDoneCallback?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow TypeScript enum.
	 */
	noEnum?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow exporting an imported variable.
	 */
	noExportedImports?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Prevent usage of \<head> element in a Next.js project.
	 */
	noHeadElement?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow implicit true values on JSX boolean attributes
	 */
	noImplicitBoolean?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow type annotations for variables, parameters, and class properties initialized
	 * with a literal expression.
	 */
	noInferrableTypes?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow the use of TypeScript's namespaces.
	 */
	noNamespace?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow negation in the condition of an if statement if it has an else clause.
	 */
	noNegationElse?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow nested ternary expressions.
	 */
	noNestedTernary?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow non-null assertions using the ! postfix operator.
	 */
	noNonNullAssertion?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow reassigning function parameters.
	 */
	noParameterAssign?:
		| RuleWithNoParameterAssignOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow the use of parameter properties in class constructors.
	 */
	noParameterProperties?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow the use of process.env.
	 */
	noProcessEnv?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * This rule allows you to specify global variable names that you don’t want to use in your
	 * application.
	 */
	noRestrictedGlobals?:
		| RuleWithRestrictedGlobalsOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow specified modules when loaded by import or require.
	 */
	noRestrictedImports?:
		| RuleWithRestrictedImportsOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow user defined types.
	 */
	noRestrictedTypes?:
		| RuleWithNoRestrictedTypesOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow the use of constants which its value is the upper-case version of its name.
	 */
	noShoutyConstants?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce the use of String.slice() over String.substr() and String.substring().
	 */
	noSubstr?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow template literals if interpolation and special-character handling are not needed
	 */
	noUnusedTemplateLiteral?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow else block when the if block breaks early.
	 */
	noUselessElse?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow use of @value rule in css modules.
	 */
	noValueAtRule?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow the use of yoda expressions.
	 */
	noYodaExpression?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * It enables the recommended rules for this group
	 */
	recommended?: boolean | null;
	/**
	 * Disallow Array constructors.
	 */
	useArrayLiterals?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce the use of as const over literal type and type annotation.
	 */
	useAsConstAssertion?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Use at() instead of integer index access.
	 */
	useAtIndex?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Requires following curly brace conventions.
	 */
	useBlockStatements?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce using else if instead of nested if in else clauses.
	 */
	useCollapsedElseIf?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce using single if instead of nested if clauses.
	 */
	useCollapsedIf?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce declaring components only within modules that export React Components exclusively.
	 */
	useComponentExportOnlyModules?:
		| RuleWithUseComponentExportOnlyModulesOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Require consistently using either T\[] or Array\<T>
	 */
	useConsistentArrayType?:
		| RuleWithConsistentArrayTypeOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforce the use of new for all builtins, except String, Number and Boolean.
	 */
	useConsistentBuiltinInstantiation?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * This rule enforces consistent use of curly braces inside JSX attributes and JSX children.
	 */
	useConsistentCurlyBraces?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Require consistent accessibility modifiers on class properties and methods.
	 */
	useConsistentMemberAccessibility?:
		| RuleWithConsistentMemberAccessibilityOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Require const declarations for variables that are only assigned once.
	 */
	useConst?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce default function parameters and optional function parameters to be last.
	 */
	useDefaultParameterLast?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Require the default clause in switch statements.
	 */
	useDefaultSwitchClause?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Require specifying the reason argument when using @deprecated directive
	 */
	useDeprecatedReason?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Require that each enum member value be explicitly initialized.
	 */
	useEnumInitializers?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce explicitly comparing the length, size, byteLength or byteOffset property of a
	 * value.
	 */
	useExplicitLengthCheck?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow the use of Math.pow in favor of the ** operator.
	 */
	useExponentiationOperator?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Promotes the use of export type for types.
	 */
	useExportType?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce naming conventions for JavaScript and TypeScript filenames.
	 */
	useFilenamingConvention?:
		| RuleWithFilenamingConventionOptions
		| RulePlainConfiguration
		| null;
	/**
	 * This rule recommends a for-of loop when in a for loop, the index used to extract an item
	 * from the iterated array.
	 */
	useForOf?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * This rule enforces the use of \<>...\</> over \<Fragment>...\</Fragment>.
	 */
	useFragmentSyntax?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Promotes the use of import type for types.
	 */
	useImportType?: RuleWithImportTypeOptions | RulePlainConfiguration | null;
	/**
	 * Require all enum members to be literal values.
	 */
	useLiteralEnumMembers?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce naming conventions for everything across a codebase.
	 */
	useNamingConvention?:
		| RuleWithNamingConventionOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Promotes the usage of node:assert/strict over node:assert.
	 */
	useNodeAssertStrict?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforces using the node: protocol for Node.js builtin modules.
	 */
	useNodejsImportProtocol?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Use the Number properties instead of global ones.
	 */
	useNumberNamespace?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Prevent extra closing tags for components without children.
	 */
	useSelfClosingElements?:
		| RuleWithUseSelfClosingElementsOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Require assignment operator shorthand where possible.
	 */
	useShorthandAssign?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce using function types instead of object type with call signatures.
	 */
	useShorthandFunctionType?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow multiple variable declarations in the same variable statement
	 */
	useSingleVarDeclarator?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Prefer template literals over string concatenation.
	 */
	useTemplate?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Require new when throwing an error.
	 */
	useThrowNewError?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow throwing non-Error values.
	 */
	useThrowOnlyError?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce the use of String.trimStart() and String.trimEnd() over String.trimLeft() and
	 * String.trimRight().
	 */
	useTrimStartEnd?: RuleWithFixNoOptions | RulePlainConfiguration | null;
}

export interface RuleWithNoParameterAssignOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: NoParameterAssignOptions;
}

/**
 * Rule's options
 *
 * Options for the rule `NoParameterAssign`
 */
export interface NoParameterAssignOptions {
	/**
	 * Whether to report an error when a dependency is listed in the dependencies array but
	 * isn't used. Defaults to `allow`.
	 */
	propertyAssignment?: PropertyAssignmentMode;
}

/**
 * Whether to report an error when a dependency is listed in the dependencies array but
 * isn't used. Defaults to `allow`.
 *
 * Specifies whether property assignments on function parameters are allowed or denied.
 *
 * Allows property assignments on function parameters. This is the default behavior,
 * enabling flexibility in parameter usage.
 *
 * Disallows property assignments on function parameters. Enforces stricter immutability to
 * prevent unintended side effects.
 */
export enum PropertyAssignmentMode {
	Allow = "allow",
	Deny = "deny",
}

export interface RuleWithRestrictedGlobalsOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: RestrictedGlobalsOptions;
}

/**
 * Rule's options
 *
 * Options for the rule `noRestrictedGlobals`.
 */
export interface RestrictedGlobalsOptions {
	/**
	 * A list of names that should trigger the rule
	 */
	deniedGlobals?: { [key: string]: string };
}

export interface RuleWithRestrictedImportsOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: RestrictedImportsOptions;
}

/**
 * Rule's options
 *
 * Options for the rule `noRestrictedImports`.
 */
export interface RestrictedImportsOptions {
	/**
	 * A list of import paths that should trigger the rule.
	 */
	paths?: { [key: string]: CustomRestrictedImportOptions | string };
}

/**
 * Additional options to configure the message and allowed/disallowed import names.
 */
export interface CustomRestrictedImportOptions {
	/**
	 * Names of the exported members that allowed to be not be used.
	 */
	allowImportNames?: string[];
	/**
	 * Names of the exported members that should not be used.
	 */
	importNames?: string[];
	/**
	 * The message to display when this module is imported.
	 */
	message?: string;
}

export interface RuleWithNoRestrictedTypesOptions {
	/**
	 * The kind of the code actions emitted by the rule
	 */
	fix?: FixKind | null;
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: NoRestrictedTypesOptions;
}

/**
 * Rule's options
 */
export interface NoRestrictedTypesOptions {
	types?: { [key: string]: CustomRestrictedTypeOptions | string };
}

export interface CustomRestrictedTypeOptions {
	message?: string;
	use?: null | string;
}

export interface RuleWithUseComponentExportOnlyModulesOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: UseComponentExportOnlyModulesOptions;
}

/**
 * Rule's options
 */
export interface UseComponentExportOnlyModulesOptions {
	/**
	 * Allows the export of constants. This option is for environments that support it, such as
	 * [Vite](https://vitejs.dev/)
	 */
	allowConstantExport?: boolean;
	/**
	 * A list of names that can be additionally exported from the module This option is for
	 * exports that do not hinder [React Fast
	 * Refresh](https://github.com/facebook/react/tree/main/packages/react-refresh), such as
	 * [`meta` in Remix](https://remix.run/docs/en/main/route/meta)
	 */
	allowExportNames?: string[];
}

export interface RuleWithConsistentArrayTypeOptions {
	/**
	 * The kind of the code actions emitted by the rule
	 */
	fix?: FixKind | null;
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: ConsistentArrayTypeOptions;
}

/**
 * Rule's options
 */
export interface ConsistentArrayTypeOptions {
	syntax?: ConsistentArrayType;
}

/**
 * `ItemType[]`
 *
 * `Array<ItemType>`
 */
export enum ConsistentArrayType {
	Generic = "generic",
	Shorthand = "shorthand",
}

export interface RuleWithConsistentMemberAccessibilityOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: ConsistentMemberAccessibilityOptions;
}

/**
 * Rule's options
 */
export interface ConsistentMemberAccessibilityOptions {
	accessibility?: Accessibility;
}

export enum Accessibility {
	Explicit = "explicit",
	NoPublic = "noPublic",
	None = "none",
}

export interface RuleWithFilenamingConventionOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: FilenamingConventionOptions;
}

/**
 * Rule's options
 *
 * Rule's options.
 */
export interface FilenamingConventionOptions {
	/**
	 * Allowed cases for file names.
	 */
	filenameCases?: FilenameCase[];
	/**
	 * Regular expression to enforce
	 */
	match?: null | string;
	/**
	 * If `false`, then non-ASCII characters are allowed.
	 */
	requireAscii?: boolean;
	/**
	 * If `false`, then consecutive uppercase are allowed in _camel_ and _pascal_ cases. This
	 * does not affect other [Case].
	 */
	strictCase?: boolean;
}

/**
 * Supported cases for file names.
 *
 * camelCase
 *
 * Match an export name
 *
 * kebab-case
 *
 * PascalCase
 *
 * snake_case
 */
export enum FilenameCase {
	CamelCase = "camelCase",
	Export = "export",
	KebabCase = "kebab-case",
	PascalCase = "PascalCase",
	SnakeCase = "snake_case",
}

export interface RuleWithImportTypeOptions {
	/**
	 * The kind of the code actions emitted by the rule
	 */
	fix?: FixKind | null;
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: ImportTypeOptions;
}

/**
 * Rule's options
 *
 * Rule's options.
 */
export interface ImportTypeOptions {
	style: Style2;
}

/**
 * Rule's options.
 *
 * Use the best fitting style according to the situation
 *
 * Always use inline type keywords
 *
 * Always separate types in a dedicated `import type`
 */
export enum Style2 {
	Auto = "auto",
	InlineType = "inlineType",
	SeparatedType = "separatedType",
}

export interface RuleWithNamingConventionOptions {
	/**
	 * The kind of the code actions emitted by the rule
	 */
	fix?: FixKind | null;
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: NamingConventionOptions;
}

/**
 * Rule's options
 *
 * Rule's options.
 */
export interface NamingConventionOptions {
	/**
	 * Custom conventions.
	 */
	conventions?: Convention[];
	/**
	 * If `false`, then non-ASCII characters are allowed.
	 */
	requireAscii?: boolean;
	/**
	 * If `false`, then consecutive uppercase are allowed in _camel_ and _pascal_ cases. This
	 * does not affect other [Case].
	 */
	strictCase?: boolean;
}

export interface Convention {
	/**
	 * String cases to enforce
	 */
	formats?: Format[];
	/**
	 * Regular expression to enforce
	 */
	match?: null | string;
	/**
	 * Declarations concerned by this convention
	 */
	selector?: Selector;
}

/**
 * Supported cases.
 */
export enum Format {
	CamelCase = "camelCase",
	ConstantCase = "CONSTANT_CASE",
	PascalCase = "PascalCase",
	SnakeCase = "snake_case",
}

/**
 * Declarations concerned by this convention
 */
export interface Selector {
	/**
	 * Declaration kind
	 */
	kind?: Kind;
	/**
	 * Modifiers used on the declaration
	 */
	modifiers?: RestrictedModifier[];
	/**
	 * Scope of the declaration
	 */
	scope?: Scope;
}

/**
 * Declaration kind
 *
 * All kinds
 *
 * All type definitions: classes, enums, interfaces, and type aliases
 *
 * Named function declarations and expressions
 *
 * TypeScript namespaces, import and export namespaces
 *
 * TypeScript namespaces
 *
 * All function parameters, but parameter properties
 *
 * All generic type parameters
 *
 * All class members: properties, methods, getters, and setters
 *
 * All class properties, including parameter properties
 *
 * All object literal members: properties, methods, getters, and setters
 *
 * All members defined in type alaises and interfaces
 *
 * All getters defined in type alaises and interfaces
 *
 * All properties defined in type alaises and interfaces
 *
 * All setters defined in type alaises and interfaces
 *
 * All methods defined in type alaises and interfaces
 */
export enum Kind {
	Any = "any",
	CatchParameter = "catchParameter",
	Class = "class",
	ClassGetter = "classGetter",
	ClassMember = "classMember",
	ClassMethod = "classMethod",
	ClassProperty = "classProperty",
	ClassSetter = "classSetter",
	Const = "const",
	Enum = "enum",
	EnumMember = "enumMember",
	ExportAlias = "exportAlias",
	ExportNamespace = "exportNamespace",
	Function = "function",
	FunctionParameter = "functionParameter",
	ImportAlias = "importAlias",
	ImportNamespace = "importNamespace",
	IndexParameter = "indexParameter",
	Interface = "interface",
	Let = "let",
	Namespace = "namespace",
	NamespaceLike = "namespaceLike",
	ObjectLiteralGetter = "objectLiteralGetter",
	ObjectLiteralMember = "objectLiteralMember",
	ObjectLiteralMethod = "objectLiteralMethod",
	ObjectLiteralProperty = "objectLiteralProperty",
	ObjectLiteralSetter = "objectLiteralSetter",
	TypeAlias = "typeAlias",
	TypeGetter = "typeGetter",
	TypeLike = "typeLike",
	TypeMember = "typeMember",
	TypeMethod = "typeMethod",
	TypeParameter = "typeParameter",
	TypeProperty = "typeProperty",
	TypeSetter = "typeSetter",
	Using = "using",
	Var = "var",
	Variable = "variable",
}

export enum RestrictedModifier {
	Abstract = "abstract",
	Private = "private",
	Protected = "protected",
	Readonly = "readonly",
	Static = "static",
}

/**
 * Scope of the declaration
 */
export enum Scope {
	Any = "any",
	Global = "global",
}

export interface RuleWithUseSelfClosingElementsOptions {
	/**
	 * The kind of the code actions emitted by the rule
	 */
	fix?: FixKind | null;
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: UseSelfClosingElementsOptions;
}

/**
 * Rule's options
 *
 * Options for the `useSelfClosingElements` rule.
 */
export interface UseSelfClosingElementsOptions {
	ignoreHtmlElements?: boolean;
}

/**
 * A list of rules that belong to this group
 */
export interface Suspicious {
	/**
	 * Use standard constants instead of approximated literals.
	 */
	noApproximativeNumericConstant?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Discourage the usage of Array index in keys.
	 */
	noArrayIndexKey?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow assignments in expressions.
	 */
	noAssignInExpressions?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallows using an async function as a Promise executor.
	 */
	noAsyncPromiseExecutor?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow reassigning exceptions in catch clauses.
	 */
	noCatchAssign?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow reassigning class members.
	 */
	noClassAssign?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Prevent comments from being inserted as text nodes
	 */
	noCommentText?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow comparing against -0
	 */
	noCompareNegZero?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow labeled statements that are not loops.
	 */
	noConfusingLabels?:
		| RuleWithNoConfusingLabelsOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow void type outside of generic or return types.
	 */
	noConfusingVoidType?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow the use of console.
	 */
	noConsole?: RuleWithNoConsoleOptions | RulePlainConfiguration | null;
	/**
	 * Disallow TypeScript const enum
	 */
	noConstEnum?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Prevents from having control characters and some escape sequences that match control
	 * characters in regular expression literals.
	 */
	noControlCharactersInRegex?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow the use of debugger
	 */
	noDebugger?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow direct assignments to document.cookie.
	 */
	noDocumentCookie?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Prevents importing next/document outside of pages/_document.jsx in Next.js projects.
	 */
	noDocumentImportInPage?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Require the use of === and !==.
	 */
	noDoubleEquals?:
		| RuleWithNoDoubleEqualsOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow duplicate @import rules.
	 */
	noDuplicateAtImportRules?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow duplicate case labels.
	 */
	noDuplicateCase?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow duplicate class members.
	 */
	noDuplicateClassMembers?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow duplicate custom properties within declaration blocks.
	 */
	noDuplicateCustomProperties?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow duplicate conditions in if-else-if chains
	 */
	noDuplicateElseIf?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * No duplicated fields in GraphQL operations.
	 */
	noDuplicateFields?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow duplicate names within font families.
	 */
	noDuplicateFontNames?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Prevents JSX properties to be assigned multiple times.
	 */
	noDuplicateJsxProps?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow two keys with the same name inside objects.
	 */
	noDuplicateObjectKeys?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow duplicate function parameter name.
	 */
	noDuplicateParameters?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow duplicate properties within declaration blocks.
	 */
	noDuplicateProperties?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow duplicate selectors within keyframe blocks.
	 */
	noDuplicateSelectorsKeyframeBlock?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * A describe block should not contain duplicate hooks.
	 */
	noDuplicateTestHooks?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow CSS empty blocks.
	 */
	noEmptyBlock?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow empty block statements and static blocks.
	 */
	noEmptyBlockStatements?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow the declaration of empty interfaces.
	 */
	noEmptyInterface?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow variables from evolving into any type through reassignments.
	 */
	noEvolvingTypes?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow the any type usage.
	 */
	noExplicitAny?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow using export or module.exports in files containing tests
	 */
	noExportsInTest?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Prevents the wrong usage of the non-null assertion operator (!) in TypeScript files.
	 */
	noExtraNonNullAssertion?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow fallthrough of switch clauses.
	 */
	noFallthroughSwitchClause?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow focused tests.
	 */
	noFocusedTests?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow reassigning function declarations.
	 */
	noFunctionAssign?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow assignments to native objects and read-only global variables.
	 */
	noGlobalAssign?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Use Number.isFinite instead of global isFinite.
	 */
	noGlobalIsFinite?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Use Number.isNaN instead of global isNaN.
	 */
	noGlobalIsNan?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Prevent using the next/head module in pages/_document.js on Next.js projects.
	 */
	noHeadImportInDocument?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow use of implicit any type on variable declarations.
	 */
	noImplicitAnyLet?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow invalid !important within keyframe declarations
	 */
	noImportantInKeyframe?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow assigning to imported bindings
	 */
	noImportAssign?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallows the use of irregular whitespace characters.
	 */
	noIrregularWhitespace?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow labels that share a name with a variable
	 */
	noLabelVar?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow characters made with multiple code points in character class syntax.
	 */
	noMisleadingCharacterClass?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforce proper usage of new and constructor.
	 */
	noMisleadingInstantiator?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Checks that the assertion function, for example expect, is placed inside an it() function
	 * call.
	 */
	noMisplacedAssertion?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow shorthand assign when variable appears on both sides.
	 */
	noMisrefactoredShorthandAssign?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow octal escape sequences in string literals
	 */
	noOctalEscape?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow direct use of Object.prototype builtins.
	 */
	noPrototypeBuiltins?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Prevents React-specific JSX properties from being used.
	 */
	noReactSpecificProps?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow variable, function, class, and type redeclarations in the same scope.
	 */
	noRedeclare?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Prevents from having redundant "use strict".
	 */
	noRedundantUseStrict?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow comparisons where both sides are exactly the same.
	 */
	noSelfCompare?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow identifiers from shadowing restricted names.
	 */
	noShadowRestrictedNames?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow shorthand properties that override related longhand properties.
	 */
	noShorthandPropertyOverrides?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow disabled tests.
	 */
	noSkippedTests?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Prevents the use of sparse arrays (arrays with holes).
	 */
	noSparseArray?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * It detects possible "wrong" semicolons inside JSX elements.
	 */
	noSuspiciousSemicolonInJsx?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow template literal placeholder syntax in regular strings.
	 */
	noTemplateCurlyInString?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow then property.
	 */
	noThenProperty?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow unsafe declaration merging between interfaces and classes.
	 */
	noUnsafeDeclarationMerging?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Disallow using unsafe negation.
	 */
	noUnsafeNegation?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow the use of var
	 */
	noVar?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Disallow with statements in non-strict contexts.
	 */
	noWith?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * It enables the recommended rules for this group
	 */
	recommended?: boolean | null;
	/**
	 * Disallow the use of overload signatures that are not next to each other.
	 */
	useAdjacentOverloadSignatures?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Ensure async functions utilize await.
	 */
	useAwait?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce default clauses in switch statements to be last
	 */
	useDefaultSwitchClauseLast?:
		| RuleWithNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforce passing a message value when creating a built-in error.
	 */
	useErrorMessage?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce get methods to always return a value.
	 */
	useGetterReturn?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforces the use of a recommended display strategy with Google Fonts.
	 */
	useGoogleFontDisplay?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Require for-in loops to include an if statement.
	 */
	useGuardForIn?: RuleWithNoOptions | RulePlainConfiguration | null;
	/**
	 * Use Array.isArray() instead of instanceof Array.
	 */
	useIsArray?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Require using the namespace keyword over the module keyword to declare TypeScript
	 * namespaces.
	 */
	useNamespaceKeyword?: RuleWithFixNoOptions | RulePlainConfiguration | null;
	/**
	 * Enforce using the digits argument with Number#toFixed().
	 */
	useNumberToFixedDigitsArgument?:
		| RuleWithFixNoOptions
		| RulePlainConfiguration
		| null;
	/**
	 * Enforce the use of the directive "use strict" in script files.
	 */
	useStrictMode?: RuleWithFixNoOptions | RulePlainConfiguration | null;
}

export interface RuleWithNoConfusingLabelsOptions {
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: NoConfusingLabelsOptions;
}

/**
 * Rule's options
 *
 * Options for the rule `noConfusingLabels`
 */
export interface NoConfusingLabelsOptions {
	/**
	 * A list of (non-confusing) labels that should be allowed
	 */
	allowedLabels?: string[];
}

export interface RuleWithNoConsoleOptions {
	/**
	 * The kind of the code actions emitted by the rule
	 */
	fix?: FixKind | null;
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: NoConsoleOptions;
}

/**
 * Rule's options
 */
export interface NoConsoleOptions {
	/**
	 * Allowed calls on the console object.
	 */
	allow: string[];
}

export interface RuleWithNoDoubleEqualsOptions {
	/**
	 * The kind of the code actions emitted by the rule
	 */
	fix?: FixKind | null;
	/**
	 * The severity of the emitted diagnostics by the rule
	 */
	level: RulePlainConfiguration;
	/**
	 * Rule's options
	 */
	options?: NoDoubleEqualsOptions;
}

/**
 * Rule's options
 */
export interface NoDoubleEqualsOptions {
	/**
	 * If `true`, an exception is made when comparing with `null`, as it's often relied on to
	 * check both for `null` or `undefined`.
	 *
	 * If `false`, no such exception will be made.
	 */
	ignoreNull?: boolean;
}

export interface OverridePattern {
	/**
	 * Specific configuration for the Json language
	 */
	assist?: OverrideAssistConfiguration | null;
	/**
	 * Specific configuration for the CSS language
	 */
	css?: CSSConfiguration | null;
	/**
	 * Specific configuration for the filesystem
	 */
	files?: OverrideFilesConfiguration | null;
	/**
	 * Specific configuration for the Json language
	 */
	formatter?: OverrideFormatterConfiguration | null;
	/**
	 * Specific configuration for the Graphql language
	 */
	graphql?: GraphqlConfiguration | null;
	/**
	 * Specific configuration for the GritQL language
	 */
	grit?: GritConfiguration | null;
	/**
	 * Specific configuration for the GritQL language
	 */
	html?: HTMLConfiguration | null;
	/**
	 * A list of glob patterns. Biome will include files/folders that will match these patterns.
	 */
	includes?: string[] | null;
	/**
	 * Specific configuration for the JavaScript language
	 */
	javascript?: JSConfiguration | null;
	/**
	 * Specific configuration for the Json language
	 */
	json?: JSONConfiguration | null;
	/**
	 * Specific configuration for the Json language
	 */
	linter?: OverrideLinterConfiguration | null;
	/**
	 * Specific configuration for additional plugins
	 */
	plugins?: string[] | null;
}

export interface OverrideAssistConfiguration {
	/**
	 * List of actions
	 */
	actions?: Actions | null;
	/**
	 * if `false`, it disables the feature and the assist won't be executed. `true` by default
	 */
	enabled?: boolean | null;
}

export interface OverrideFilesConfiguration {
	/**
	 * File size limit in bytes
	 */
	maxSize?: number | null;
}

export interface OverrideFormatterConfiguration {
	/**
	 * The attribute position style.
	 */
	attributePosition?: AttributePosition | null;
	/**
	 * Put the `>` of a multi-line HTML or JSX element at the end of the last line instead of
	 * being alone on the next line (does not apply to self closing elements).
	 */
	bracketSameLine?: boolean | null;
	/**
	 * Whether to insert spaces around brackets in object literals. Defaults to true.
	 */
	bracketSpacing?: boolean | null;
	enabled?: boolean | null;
	/**
	 * Whether to expand arrays and objects on multiple lines. When set to `auto`, object
	 * literals are formatted on multiple lines if the first property has a newline, and array
	 * literals are formatted on a single line if it fits in the line. When set to `always`,
	 * these literals are formatted on multiple lines, regardless of length of the list. When
	 * set to `never`, these literals are formatted on a single line if it fits in the line.
	 * When formatting `package.json`, Biome will use `always` unless configured otherwise.
	 * Defaults to "auto".
	 */
	expand?: Expand | null;
	/**
	 * Stores whether formatting should be allowed to proceed if a given file has syntax errors
	 */
	formatWithErrors?: boolean | null;
	/**
	 * The size of the indentation, 2 by default (deprecated, use `indent-width`)
	 */
	indentSize?: number | null;
	/**
	 * The indent style.
	 */
	indentStyle?: IndentStyle | null;
	/**
	 * The size of the indentation, 2 by default
	 */
	indentWidth?: number | null;
	/**
	 * The type of line ending.
	 */
	lineEnding?: LineEnding | null;
	/**
	 * What's the max width of a line. Defaults to 80.
	 */
	lineWidth?: number | null;
}

export interface OverrideLinterConfiguration {
	/**
	 * List of rules
	 */
	domains?: { [key: string]: RuleDomainValue } | null;
	/**
	 * if `false`, it disables the feature and the linter won't be executed. `true` by default
	 */
	enabled?: boolean | null;
	/**
	 * List of rules
	 */
	rules?: Rules | null;
}

/**
 * Set of properties to integrate Biome with a VCS software.
 */
export interface VcsConfiguration {
	/**
	 * The kind of client.
	 */
	clientKind?: VcsClientKind | null;
	/**
	 * The main branch of the project
	 */
	defaultBranch?: null | string;
	/**
	 * Whether Biome should integrate itself with the VCS client
	 */
	enabled?: boolean | null;
	/**
	 * The folder where Biome should check for VCS files. By default, Biome will use the same
	 * folder where `biome.json` was found.
	 *
	 * If Biome can't find the configuration, it will attempt to use the current working
	 * directory. If no current working directory can't be found, Biome won't use the VCS
	 * integration, and a diagnostic will be emitted
	 */
	root?: null | string;
	/**
	 * Whether Biome should use the VCS ignore file. When [true], Biome will ignore the files
	 * specified in the ignore file.
	 */
	useIgnoreFile?: boolean | null;
}

/**
 * Integration with the git client as VCS
 */
export enum VcsClientKind {
	Git = "git",
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
	public static toTypes(json: string): Types {
		return cast(JSON.parse(json), r("Types"));
	}

	public static typesToJson(value: Types): string {
		return JSON.stringify(uncast(value, r("Types")), null, 2);
	}
}

function invalidValue(typ: any, val: any, key: any, parent: any = ""): never {
	const prettyTyp = prettyTypeName(typ);
	const parentText = parent ? ` on ${parent}` : "";
	const keyText = key ? ` for key "${key}"` : "";
	throw Error(
		`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`,
	);
}

function prettyTypeName(typ: any): string {
	if (Array.isArray(typ)) {
		if (typ.length === 2 && typ[0] === undefined) {
			return `an optional ${prettyTypeName(typ[1])}`;
		} else {
			return `one of [${typ
				.map((a) => {
					return prettyTypeName(a);
				})
				.join(", ")}]`;
		}
	} else if (typeof typ === "object" && typ.literal !== undefined) {
		return typ.literal;
	} else {
		return typeof typ;
	}
}

function jsonToJSProps(typ: any): any {
	if (typ.jsonToJS === undefined) {
		const map: any = {};
		typ.props.forEach((p: any) => (map[p.json] = { key: p.js, typ: p.typ }));
		typ.jsonToJS = map;
	}
	return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
	if (typ.jsToJSON === undefined) {
		const map: any = {};
		typ.props.forEach((p: any) => (map[p.js] = { key: p.json, typ: p.typ }));
		typ.jsToJSON = map;
	}
	return typ.jsToJSON;
}

function transform(
	val: any,
	typ: any,
	getProps: any,
	key: any = "",
	parent: any = "",
): any {
	function transformPrimitive(typ: string, val: any): any {
		if (typeof typ === typeof val) return val;
		return invalidValue(typ, val, key, parent);
	}

	function transformUnion(typs: any[], val: any): any {
		// val must validate against one typ in typs
		const l = typs.length;
		for (let i = 0; i < l; i++) {
			const typ = typs[i];
			try {
				return transform(val, typ, getProps);
			} catch (_) {}
		}
		return invalidValue(typs, val, key, parent);
	}

	function transformEnum(cases: string[], val: any): any {
		if (cases.indexOf(val) !== -1) return val;
		return invalidValue(
			cases.map((a) => {
				return l(a);
			}),
			val,
			key,
			parent,
		);
	}

	function transformArray(typ: any, val: any): any {
		// val must be an array with no invalid elements
		if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
		return val.map((el) => transform(el, typ, getProps));
	}

	function transformDate(val: any): any {
		if (val === null) {
			return null;
		}
		const d = new Date(val);
		if (isNaN(d.valueOf())) {
			return invalidValue(l("Date"), val, key, parent);
		}
		return d;
	}

	function transformObject(
		props: { [k: string]: any },
		additional: any,
		val: any,
	): any {
		if (val === null || typeof val !== "object" || Array.isArray(val)) {
			return invalidValue(l(ref || "object"), val, key, parent);
		}
		const result: any = {};
		Object.getOwnPropertyNames(props).forEach((key) => {
			const prop = props[key];
			const v = Object.prototype.hasOwnProperty.call(val, key)
				? val[key]
				: undefined;
			result[prop.key] = transform(v, prop.typ, getProps, key, ref);
		});
		Object.getOwnPropertyNames(val).forEach((key) => {
			if (!Object.prototype.hasOwnProperty.call(props, key)) {
				result[key] = transform(val[key], additional, getProps, key, ref);
			}
		});
		return result;
	}

	if (typ === "any") return val;
	if (typ === null) {
		if (val === null) return val;
		return invalidValue(typ, val, key, parent);
	}
	if (typ === false) return invalidValue(typ, val, key, parent);
	let ref: any = undefined;
	while (typeof typ === "object" && typ.ref !== undefined) {
		ref = typ.ref;
		typ = typeMap[typ.ref];
	}
	if (Array.isArray(typ)) return transformEnum(typ, val);
	if (typeof typ === "object") {
		return typ.hasOwnProperty("unionMembers")
			? transformUnion(typ.unionMembers, val)
			: typ.hasOwnProperty("arrayItems")
				? transformArray(typ.arrayItems, val)
				: typ.hasOwnProperty("props")
					? transformObject(getProps(typ), typ.additional, val)
					: invalidValue(typ, val, key, parent);
	}
	// Numbers can be parsed by Date but shouldn't be.
	if (typ === Date && typeof val !== "number") return transformDate(val);
	return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
	return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
	return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
	return { literal: typ };
}

function a(typ: any) {
	return { arrayItems: typ };
}

function u(...typs: any[]) {
	return { unionMembers: typs };
}

function o(props: any[], additional: any) {
	return { props, additional };
}

function m(additional: any) {
	return { props: [], additional };
}

function r(name: string) {
	return { ref: name };
}

const typeMap: any = {
	Types: o(
		[
			{ json: "$schema", js: "$schema", typ: u(undefined, u(null, "")) },
			{
				json: "assist",
				js: "assist",
				typ: u(undefined, u(r("AssistConfiguration"), null)),
			},
			{
				json: "css",
				js: "css",
				typ: u(undefined, u(r("CSSConfiguration"), null)),
			},
			{ json: "extends", js: "extends", typ: u(undefined, u(a(""), null, "")) },
			{
				json: "files",
				js: "files",
				typ: u(undefined, u(r("FilesConfiguration"), null)),
			},
			{
				json: "formatter",
				js: "formatter",
				typ: u(undefined, u(r("FormatterConfiguration"), null)),
			},
			{
				json: "graphql",
				js: "graphql",
				typ: u(undefined, u(r("GraphqlConfiguration"), null)),
			},
			{
				json: "grit",
				js: "grit",
				typ: u(undefined, u(r("GritConfiguration"), null)),
			},
			{
				json: "html",
				js: "html",
				typ: u(undefined, u(r("HTMLConfiguration"), null)),
			},
			{
				json: "javascript",
				js: "javascript",
				typ: u(undefined, u(r("JSConfiguration"), null)),
			},
			{
				json: "json",
				js: "json",
				typ: u(undefined, u(r("JSONConfiguration"), null)),
			},
			{
				json: "linter",
				js: "linter",
				typ: u(undefined, u(r("LinterConfiguration"), null)),
			},
			{
				json: "overrides",
				js: "overrides",
				typ: u(undefined, u(a(r("OverridePattern")), null)),
			},
			{ json: "plugins", js: "plugins", typ: u(undefined, u(a(""), null)) },
			{ json: "root", js: "root", typ: u(undefined, u(true, null)) },
			{
				json: "vcs",
				js: "vcs",
				typ: u(undefined, u(r("VcsConfiguration"), null)),
			},
		],
		false,
	),
	AssistConfiguration: o(
		[
			{
				json: "actions",
				js: "actions",
				typ: u(undefined, u(r("Actions"), null)),
			},
			{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) },
			{ json: "includes", js: "includes", typ: u(undefined, u(a(""), null)) },
		],
		false,
	),
	Actions: o(
		[
			{
				json: "recommended",
				js: "recommended",
				typ: u(undefined, u(true, null)),
			},
			{ json: "source", js: "source", typ: u(undefined, u(r("Source"), null)) },
		],
		false,
	),
	Source: o(
		[
			{
				json: "organizeImports",
				js: "organizeImports",
				typ: u(
					undefined,
					u(
						r("RuleAssistWithOptionsForOptions"),
						r("RuleAssistPlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "recommended",
				js: "recommended",
				typ: u(undefined, u(true, null)),
			},
			{
				json: "useSortedAttributes",
				js: "useSortedAttributes",
				typ: u(
					undefined,
					u(
						r("RuleAssistWithOptionsForNull"),
						r("RuleAssistPlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "useSortedKeys",
				js: "useSortedKeys",
				typ: u(
					undefined,
					u(
						r("RuleAssistWithOptionsForNull"),
						r("RuleAssistPlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "useSortedProperties",
				js: "useSortedProperties",
				typ: u(
					undefined,
					u(
						r("RuleAssistWithOptionsForNull"),
						r("RuleAssistPlainConfiguration"),
						null,
					),
				),
			},
		],
		false,
	),
	RuleAssistWithOptionsForOptions: o(
		[
			{ json: "level", js: "level", typ: r("RuleAssistPlainConfiguration") },
			{ json: "options", js: "options", typ: r("Options") },
		],
		false,
	),
	Options: o(
		[
			{
				json: "groups",
				js: "groups",
				typ: u(
					undefined,
					a(u(a(u(r("ImportMatcher"), "")), null, r("ImportMatcher"), "")),
				),
			},
		],
		false,
	),
	ImportMatcher: o(
		[
			{ json: "source", js: "source", typ: u(undefined, u(a(""), null, "")) },
			{ json: "type", js: "type", typ: u(undefined, u(true, null)) },
		],
		"any",
	),
	RuleAssistWithOptionsForNull: o(
		[
			{ json: "level", js: "level", typ: r("RuleAssistPlainConfiguration") },
			{ json: "options", js: "options", typ: null },
		],
		false,
	),
	CSSConfiguration: o(
		[
			{
				json: "assist",
				js: "assist",
				typ: u(undefined, u(r("CSSAssistConfiguration"), null)),
			},
			{
				json: "formatter",
				js: "formatter",
				typ: u(undefined, u(r("CSSFormatterConfiguration"), null)),
			},
			{ json: "globals", js: "globals", typ: u(undefined, u(a(""), null)) },
			{
				json: "linter",
				js: "linter",
				typ: u(undefined, u(r("CSSLinterConfiguration"), null)),
			},
			{
				json: "parser",
				js: "parser",
				typ: u(undefined, u(r("CSSParserConfiguration"), null)),
			},
		],
		false,
	),
	CSSAssistConfiguration: o(
		[{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) }],
		false,
	),
	CSSFormatterConfiguration: o(
		[
			{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) },
			{
				json: "indentStyle",
				js: "indentStyle",
				typ: u(undefined, u(r("IndentStyle"), null)),
			},
			{ json: "indentWidth", js: "indentWidth", typ: u(undefined, u(0, null)) },
			{
				json: "lineEnding",
				js: "lineEnding",
				typ: u(undefined, u(r("LineEnding"), null)),
			},
			{ json: "lineWidth", js: "lineWidth", typ: u(undefined, u(0, null)) },
			{
				json: "quoteStyle",
				js: "quoteStyle",
				typ: u(undefined, u(r("QuoteStyle"), null)),
			},
		],
		false,
	),
	CSSLinterConfiguration: o(
		[{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) }],
		false,
	),
	CSSParserConfiguration: o(
		[
			{
				json: "allowWrongLineComments",
				js: "allowWrongLineComments",
				typ: u(undefined, u(true, null)),
			},
			{
				json: "cssModules",
				js: "cssModules",
				typ: u(undefined, u(true, null)),
			},
		],
		false,
	),
	FilesConfiguration: o(
		[
			{
				json: "experimentalScannerIgnores",
				js: "experimentalScannerIgnores",
				typ: u(undefined, u(a(""), null)),
			},
			{
				json: "ignoreUnknown",
				js: "ignoreUnknown",
				typ: u(undefined, u(true, null)),
			},
			{ json: "includes", js: "includes", typ: u(undefined, u(a(""), null)) },
			{ json: "maxSize", js: "maxSize", typ: u(undefined, u(0, null)) },
		],
		false,
	),
	FormatterConfiguration: o(
		[
			{
				json: "attributePosition",
				js: "attributePosition",
				typ: u(undefined, u(r("AttributePosition"), null)),
			},
			{
				json: "bracketSameLine",
				js: "bracketSameLine",
				typ: u(undefined, u(true, null)),
			},
			{
				json: "bracketSpacing",
				js: "bracketSpacing",
				typ: u(undefined, u(true, null)),
			},
			{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) },
			{ json: "expand", js: "expand", typ: u(undefined, u(r("Expand"), null)) },
			{
				json: "formatWithErrors",
				js: "formatWithErrors",
				typ: u(undefined, u(true, null)),
			},
			{ json: "includes", js: "includes", typ: u(undefined, u(a(""), null)) },
			{
				json: "indentStyle",
				js: "indentStyle",
				typ: u(undefined, u(r("IndentStyle"), null)),
			},
			{ json: "indentWidth", js: "indentWidth", typ: u(undefined, u(0, null)) },
			{
				json: "lineEnding",
				js: "lineEnding",
				typ: u(undefined, u(r("LineEnding"), null)),
			},
			{ json: "lineWidth", js: "lineWidth", typ: u(undefined, u(0, null)) },
			{
				json: "useEditorconfig",
				js: "useEditorconfig",
				typ: u(undefined, u(true, null)),
			},
		],
		false,
	),
	GraphqlConfiguration: o(
		[
			{
				json: "assist",
				js: "assist",
				typ: u(undefined, u(r("GraphqlAssistConfiguration"), null)),
			},
			{
				json: "formatter",
				js: "formatter",
				typ: u(undefined, u(r("GraphqlFormatterConfiguration"), null)),
			},
			{
				json: "linter",
				js: "linter",
				typ: u(undefined, u(r("GraphqlLinterConfiguration"), null)),
			},
		],
		false,
	),
	GraphqlAssistConfiguration: o(
		[{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) }],
		false,
	),
	GraphqlFormatterConfiguration: o(
		[
			{
				json: "bracketSpacing",
				js: "bracketSpacing",
				typ: u(undefined, u(true, null)),
			},
			{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) },
			{
				json: "indentStyle",
				js: "indentStyle",
				typ: u(undefined, u(r("IndentStyle"), null)),
			},
			{ json: "indentWidth", js: "indentWidth", typ: u(undefined, u(0, null)) },
			{
				json: "lineEnding",
				js: "lineEnding",
				typ: u(undefined, u(r("LineEnding"), null)),
			},
			{ json: "lineWidth", js: "lineWidth", typ: u(undefined, u(0, null)) },
			{
				json: "quoteStyle",
				js: "quoteStyle",
				typ: u(undefined, u(r("QuoteStyle"), null)),
			},
		],
		false,
	),
	GraphqlLinterConfiguration: o(
		[{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) }],
		false,
	),
	GritConfiguration: o(
		[
			{
				json: "assist",
				js: "assist",
				typ: u(undefined, u(r("GritAssistConfiguration"), null)),
			},
			{
				json: "formatter",
				js: "formatter",
				typ: u(undefined, u(r("GritFormatterConfiguration"), null)),
			},
			{
				json: "linter",
				js: "linter",
				typ: u(undefined, u(r("GritLinterConfiguration"), null)),
			},
		],
		false,
	),
	GritAssistConfiguration: o(
		[{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) }],
		false,
	),
	GritFormatterConfiguration: o(
		[
			{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) },
			{
				json: "indentStyle",
				js: "indentStyle",
				typ: u(undefined, u(r("IndentStyle"), null)),
			},
			{ json: "indentWidth", js: "indentWidth", typ: u(undefined, u(0, null)) },
			{
				json: "lineEnding",
				js: "lineEnding",
				typ: u(undefined, u(r("LineEnding"), null)),
			},
			{ json: "lineWidth", js: "lineWidth", typ: u(undefined, u(0, null)) },
		],
		false,
	),
	GritLinterConfiguration: o(
		[{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) }],
		false,
	),
	HTMLConfiguration: o(
		[
			{
				json: "formatter",
				js: "formatter",
				typ: u(undefined, u(r("HTMLFormatterConfiguration"), null)),
			},
			{ json: "parser", js: "parser", typ: u(undefined, null) },
		],
		false,
	),
	HTMLFormatterConfiguration: o(
		[
			{
				json: "attributePosition",
				js: "attributePosition",
				typ: u(undefined, u(r("AttributePosition"), null)),
			},
			{
				json: "bracketSameLine",
				js: "bracketSameLine",
				typ: u(undefined, u(true, null)),
			},
			{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) },
			{
				json: "indentScriptAndStyle",
				js: "indentScriptAndStyle",
				typ: u(undefined, u(true, null)),
			},
			{
				json: "indentStyle",
				js: "indentStyle",
				typ: u(undefined, u(r("IndentStyle"), null)),
			},
			{ json: "indentWidth", js: "indentWidth", typ: u(undefined, u(0, null)) },
			{
				json: "lineEnding",
				js: "lineEnding",
				typ: u(undefined, u(r("LineEnding"), null)),
			},
			{ json: "lineWidth", js: "lineWidth", typ: u(undefined, u(0, null)) },
			{
				json: "selfCloseVoidElements",
				js: "selfCloseVoidElements",
				typ: u(undefined, u(r("SelfCloseVoidElements"), null)),
			},
			{
				json: "whitespaceSensitivity",
				js: "whitespaceSensitivity",
				typ: u(undefined, u(r("WhitespaceSensitivity"), null)),
			},
		],
		false,
	),
	JSConfiguration: o(
		[
			{
				json: "assist",
				js: "assist",
				typ: u(undefined, u(r("JSAssistConfiguration"), null)),
			},
			{
				json: "formatter",
				js: "formatter",
				typ: u(undefined, u(r("JSFormatterConfiguration"), null)),
			},
			{ json: "globals", js: "globals", typ: u(undefined, u(a(""), null)) },
			{
				json: "jsxRuntime",
				js: "jsxRuntime",
				typ: u(undefined, u(r("JsxRuntime"), null)),
			},
			{
				json: "linter",
				js: "linter",
				typ: u(undefined, u(r("JSLinterConfiguration"), null)),
			},
			{
				json: "parser",
				js: "parser",
				typ: u(undefined, u(r("JSParserConfiguration"), null)),
			},
		],
		false,
	),
	JSAssistConfiguration: o(
		[{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) }],
		false,
	),
	JSFormatterConfiguration: o(
		[
			{
				json: "arrowParentheses",
				js: "arrowParentheses",
				typ: u(undefined, u(r("ArrowParentheses"), null)),
			},
			{
				json: "attributePosition",
				js: "attributePosition",
				typ: u(undefined, u(r("AttributePosition"), null)),
			},
			{
				json: "bracketSameLine",
				js: "bracketSameLine",
				typ: u(undefined, u(true, null)),
			},
			{
				json: "bracketSpacing",
				js: "bracketSpacing",
				typ: u(undefined, u(true, null)),
			},
			{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) },
			{ json: "expand", js: "expand", typ: u(undefined, u(r("Expand"), null)) },
			{
				json: "indentStyle",
				js: "indentStyle",
				typ: u(undefined, u(r("IndentStyle"), null)),
			},
			{ json: "indentWidth", js: "indentWidth", typ: u(undefined, u(0, null)) },
			{
				json: "jsxQuoteStyle",
				js: "jsxQuoteStyle",
				typ: u(undefined, u(r("QuoteStyle"), null)),
			},
			{
				json: "lineEnding",
				js: "lineEnding",
				typ: u(undefined, u(r("LineEnding"), null)),
			},
			{ json: "lineWidth", js: "lineWidth", typ: u(undefined, u(0, null)) },
			{
				json: "quoteProperties",
				js: "quoteProperties",
				typ: u(undefined, u(r("QuoteProperties"), null)),
			},
			{
				json: "quoteStyle",
				js: "quoteStyle",
				typ: u(undefined, u(r("QuoteStyle"), null)),
			},
			{
				json: "semicolons",
				js: "semicolons",
				typ: u(undefined, u(r("ArrowParentheses"), null)),
			},
			{
				json: "trailingCommas",
				js: "trailingCommas",
				typ: u(undefined, u(r("TrailingCommas"), null)),
			},
		],
		false,
	),
	JSLinterConfiguration: o(
		[{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) }],
		false,
	),
	JSParserConfiguration: o(
		[
			{
				json: "gritMetavariables",
				js: "gritMetavariables",
				typ: u(undefined, u(true, null)),
			},
			{
				json: "jsxEverywhere",
				js: "jsxEverywhere",
				typ: u(undefined, u(true, null)),
			},
			{
				json: "unsafeParameterDecoratorsEnabled",
				js: "unsafeParameterDecoratorsEnabled",
				typ: u(undefined, u(true, null)),
			},
		],
		false,
	),
	JSONConfiguration: o(
		[
			{
				json: "assist",
				js: "assist",
				typ: u(undefined, u(r("JSONAssistConfiguration"), null)),
			},
			{
				json: "formatter",
				js: "formatter",
				typ: u(undefined, u(r("JSONFormatterConfiguration"), null)),
			},
			{
				json: "linter",
				js: "linter",
				typ: u(undefined, u(r("JSONLinterConfiguration"), null)),
			},
			{
				json: "parser",
				js: "parser",
				typ: u(undefined, u(r("JSONParserConfiguration"), null)),
			},
		],
		false,
	),
	JSONAssistConfiguration: o(
		[{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) }],
		false,
	),
	JSONFormatterConfiguration: o(
		[
			{
				json: "bracketSpacing",
				js: "bracketSpacing",
				typ: u(undefined, u(true, null)),
			},
			{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) },
			{ json: "expand", js: "expand", typ: u(undefined, u(r("Expand"), null)) },
			{
				json: "indentStyle",
				js: "indentStyle",
				typ: u(undefined, u(r("IndentStyle"), null)),
			},
			{ json: "indentWidth", js: "indentWidth", typ: u(undefined, u(0, null)) },
			{
				json: "lineEnding",
				js: "lineEnding",
				typ: u(undefined, u(r("LineEnding"), null)),
			},
			{ json: "lineWidth", js: "lineWidth", typ: u(undefined, u(0, null)) },
			{
				json: "trailingCommas",
				js: "trailingCommas",
				typ: u(undefined, u(r("TrailingCommas2"), null)),
			},
		],
		false,
	),
	JSONLinterConfiguration: o(
		[{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) }],
		false,
	),
	JSONParserConfiguration: o(
		[
			{
				json: "allowComments",
				js: "allowComments",
				typ: u(undefined, u(true, null)),
			},
			{
				json: "allowTrailingCommas",
				js: "allowTrailingCommas",
				typ: u(undefined, u(true, null)),
			},
		],
		false,
	),
	LinterConfiguration: o(
		[
			{
				json: "domains",
				js: "domains",
				typ: u(undefined, u(m(r("RuleDomainValue")), null)),
			},
			{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) },
			{ json: "includes", js: "includes", typ: u(undefined, u(a(""), null)) },
			{ json: "rules", js: "rules", typ: u(undefined, u(r("Rules"), null)) },
		],
		false,
	),
	Rules: o(
		[
			{
				json: "a11y",
				js: "a11y",
				typ: u(undefined, u(r("A11Y"), r("RulePlainConfiguration"), null)),
			},
			{
				json: "complexity",
				js: "complexity",
				typ: u(
					undefined,
					u(r("Complexity"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "correctness",
				js: "correctness",
				typ: u(
					undefined,
					u(r("Correctness"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "nursery",
				js: "nursery",
				typ: u(undefined, u(r("Nursery"), r("RulePlainConfiguration"), null)),
			},
			{
				json: "performance",
				js: "performance",
				typ: u(
					undefined,
					u(r("Performance"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "recommended",
				js: "recommended",
				typ: u(undefined, u(true, null)),
			},
			{
				json: "security",
				js: "security",
				typ: u(undefined, u(r("Security"), r("RulePlainConfiguration"), null)),
			},
			{
				json: "style",
				js: "style",
				typ: u(undefined, u(r("Style"), r("RulePlainConfiguration"), null)),
			},
			{
				json: "suspicious",
				js: "suspicious",
				typ: u(
					undefined,
					u(r("Suspicious"), r("RulePlainConfiguration"), null),
				),
			},
		],
		false,
	),
	A11Y: o(
		[
			{
				json: "noAccessKey",
				js: "noAccessKey",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noAriaHiddenOnFocusable",
				js: "noAriaHiddenOnFocusable",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noAriaUnsupportedElements",
				js: "noAriaUnsupportedElements",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noAutofocus",
				js: "noAutofocus",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDistractingElements",
				js: "noDistractingElements",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noHeaderScope",
				js: "noHeaderScope",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noInteractiveElementToNoninteractiveRole",
				js: "noInteractiveElementToNoninteractiveRole",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noLabelWithoutControl",
				js: "noLabelWithoutControl",
				typ: u(
					undefined,
					u(
						r("RuleWithNoLabelWithoutControlOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "noNoninteractiveElementToInteractiveRole",
				js: "noNoninteractiveElementToInteractiveRole",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noNoninteractiveTabindex",
				js: "noNoninteractiveTabindex",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noPositiveTabindex",
				js: "noPositiveTabindex",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noRedundantAlt",
				js: "noRedundantAlt",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noRedundantRoles",
				js: "noRedundantRoles",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noStaticElementInteractions",
				js: "noStaticElementInteractions",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noSvgWithoutTitle",
				js: "noSvgWithoutTitle",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "recommended",
				js: "recommended",
				typ: u(undefined, u(true, null)),
			},
			{
				json: "useAltText",
				js: "useAltText",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useAnchorContent",
				js: "useAnchorContent",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useAriaActivedescendantWithTabindex",
				js: "useAriaActivedescendantWithTabindex",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useAriaPropsForRole",
				js: "useAriaPropsForRole",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useAriaPropsSupportedByRole",
				js: "useAriaPropsSupportedByRole",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useButtonType",
				js: "useButtonType",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useFocusableInteractive",
				js: "useFocusableInteractive",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useGenericFontNames",
				js: "useGenericFontNames",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useHeadingContent",
				js: "useHeadingContent",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useHtmlLang",
				js: "useHtmlLang",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useIframeTitle",
				js: "useIframeTitle",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useKeyWithClickEvents",
				js: "useKeyWithClickEvents",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useKeyWithMouseEvents",
				js: "useKeyWithMouseEvents",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useMediaCaption",
				js: "useMediaCaption",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useSemanticElements",
				js: "useSemanticElements",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useValidAnchor",
				js: "useValidAnchor",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useValidAriaProps",
				js: "useValidAriaProps",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useValidAriaRole",
				js: "useValidAriaRole",
				typ: u(
					undefined,
					u(
						r("RuleWithValidAriaRoleOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "useValidAriaValues",
				js: "useValidAriaValues",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useValidAutocomplete",
				js: "useValidAutocomplete",
				typ: u(
					undefined,
					u(
						r("RuleWithUseValidAutocompleteOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "useValidLang",
				js: "useValidLang",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
		],
		false,
	),
	RuleWithFixNoOptions: o(
		[
			{ json: "fix", js: "fix", typ: u(undefined, u(r("FixKind"), null)) },
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
		],
		false,
	),
	RuleWithNoLabelWithoutControlOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("NoLabelWithoutControlOptions")),
			},
		],
		false,
	),
	NoLabelWithoutControlOptions: o(
		[
			{
				json: "inputComponents",
				js: "inputComponents",
				typ: u(undefined, a("")),
			},
			{
				json: "labelAttributes",
				js: "labelAttributes",
				typ: u(undefined, a("")),
			},
			{
				json: "labelComponents",
				js: "labelComponents",
				typ: u(undefined, a("")),
			},
		],
		false,
	),
	RuleWithNoOptions: o(
		[{ json: "level", js: "level", typ: r("RulePlainConfiguration") }],
		false,
	),
	RuleWithValidAriaRoleOptions: o(
		[
			{ json: "fix", js: "fix", typ: u(undefined, u(r("FixKind"), null)) },
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("ValidAriaRoleOptions")),
			},
		],
		false,
	),
	ValidAriaRoleOptions: o(
		[
			{
				json: "allowInvalidRoles",
				js: "allowInvalidRoles",
				typ: u(undefined, a("")),
			},
			{ json: "ignoreNonDom", js: "ignoreNonDom", typ: u(undefined, true) },
		],
		false,
	),
	RuleWithUseValidAutocompleteOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("UseValidAutocompleteOptions")),
			},
		],
		false,
	),
	UseValidAutocompleteOptions: o(
		[
			{
				json: "inputComponents",
				js: "inputComponents",
				typ: u(undefined, a("")),
			},
		],
		false,
	),
	Complexity: o(
		[
			{
				json: "noAdjacentSpacesInRegex",
				js: "noAdjacentSpacesInRegex",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noArguments",
				js: "noArguments",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noBannedTypes",
				js: "noBannedTypes",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noCommaOperator",
				js: "noCommaOperator",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noEmptyTypeParameters",
				js: "noEmptyTypeParameters",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noExcessiveCognitiveComplexity",
				js: "noExcessiveCognitiveComplexity",
				typ: u(
					undefined,
					u(r("RuleWithComplexityOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noExcessiveNestedTestSuites",
				js: "noExcessiveNestedTestSuites",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noExtraBooleanCast",
				js: "noExtraBooleanCast",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noFlatMapIdentity",
				js: "noFlatMapIdentity",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noForEach",
				js: "noForEach",
				typ: u(
					undefined,
					u(r("RuleWithNoForEachOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noStaticOnlyClass",
				js: "noStaticOnlyClass",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noThisInStatic",
				js: "noThisInStatic",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessCatch",
				js: "noUselessCatch",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessConstructor",
				js: "noUselessConstructor",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessContinue",
				js: "noUselessContinue",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessEmptyExport",
				js: "noUselessEmptyExport",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessEscapeInRegex",
				js: "noUselessEscapeInRegex",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessFragments",
				js: "noUselessFragments",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessLabel",
				js: "noUselessLabel",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessLoneBlockStatements",
				js: "noUselessLoneBlockStatements",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessRename",
				js: "noUselessRename",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessStringConcat",
				js: "noUselessStringConcat",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessStringRaw",
				js: "noUselessStringRaw",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessSwitchCase",
				js: "noUselessSwitchCase",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessTernary",
				js: "noUselessTernary",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessThisAlias",
				js: "noUselessThisAlias",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessTypeConstraint",
				js: "noUselessTypeConstraint",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessUndefinedInitialization",
				js: "noUselessUndefinedInitialization",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noVoid",
				js: "noVoid",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "recommended",
				js: "recommended",
				typ: u(undefined, u(true, null)),
			},
			{
				json: "useArrowFunction",
				js: "useArrowFunction",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useDateNow",
				js: "useDateNow",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useFlatMap",
				js: "useFlatMap",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useLiteralKeys",
				js: "useLiteralKeys",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useNumericLiterals",
				js: "useNumericLiterals",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useOptionalChain",
				js: "useOptionalChain",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useRegexLiterals",
				js: "useRegexLiterals",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useSimpleNumberKeys",
				js: "useSimpleNumberKeys",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useSimplifiedLogicExpression",
				js: "useSimplifiedLogicExpression",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useWhile",
				js: "useWhile",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
		],
		false,
	),
	RuleWithComplexityOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("ComplexityOptions")),
			},
		],
		false,
	),
	ComplexityOptions: o(
		[
			{
				json: "maxAllowedComplexity",
				js: "maxAllowedComplexity",
				typ: u(undefined, 0),
			},
		],
		false,
	),
	RuleWithNoForEachOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("NoForEachOptions")),
			},
		],
		false,
	),
	NoForEachOptions: o(
		[
			{
				json: "allowedIdentifiers",
				js: "allowedIdentifiers",
				typ: u(undefined, a("")),
			},
		],
		false,
	),
	Correctness: o(
		[
			{
				json: "noChildrenProp",
				js: "noChildrenProp",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noConstantCondition",
				js: "noConstantCondition",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noConstantMathMinMaxClamp",
				js: "noConstantMathMinMaxClamp",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noConstAssign",
				js: "noConstAssign",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noConstructorReturn",
				js: "noConstructorReturn",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noEmptyCharacterClassInRegex",
				js: "noEmptyCharacterClassInRegex",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noEmptyPattern",
				js: "noEmptyPattern",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noGlobalObjectCalls",
				js: "noGlobalObjectCalls",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noInnerDeclarations",
				js: "noInnerDeclarations",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noInvalidBuiltinInstantiation",
				js: "noInvalidBuiltinInstantiation",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noInvalidConstructorSuper",
				js: "noInvalidConstructorSuper",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noInvalidDirectionInLinearGradient",
				js: "noInvalidDirectionInLinearGradient",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noInvalidGridAreas",
				js: "noInvalidGridAreas",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noInvalidPositionAtImportRule",
				js: "noInvalidPositionAtImportRule",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noInvalidUseBeforeDeclaration",
				js: "noInvalidUseBeforeDeclaration",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noMissingVarFunction",
				js: "noMissingVarFunction",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noNodejsModules",
				js: "noNodejsModules",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noNonoctalDecimalEscape",
				js: "noNonoctalDecimalEscape",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noPrecisionLoss",
				js: "noPrecisionLoss",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noPrivateImports",
				js: "noPrivateImports",
				typ: u(
					undefined,
					u(
						r("RuleWithNoPrivateImportsOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "noRenderReturnValue",
				js: "noRenderReturnValue",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noSelfAssign",
				js: "noSelfAssign",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noSetterReturn",
				js: "noSetterReturn",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noStringCaseMismatch",
				js: "noStringCaseMismatch",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noSwitchDeclarations",
				js: "noSwitchDeclarations",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUndeclaredDependencies",
				js: "noUndeclaredDependencies",
				typ: u(
					undefined,
					u(
						r("RuleWithNoUndeclaredDependenciesOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "noUndeclaredVariables",
				js: "noUndeclaredVariables",
				typ: u(
					undefined,
					u(
						r("RuleWithUndeclaredVariablesOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "noUnknownFunction",
				js: "noUnknownFunction",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnknownMediaFeatureName",
				js: "noUnknownMediaFeatureName",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnknownProperty",
				js: "noUnknownProperty",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnknownPseudoClass",
				js: "noUnknownPseudoClass",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnknownPseudoElement",
				js: "noUnknownPseudoElement",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnknownTypeSelector",
				js: "noUnknownTypeSelector",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnknownUnit",
				js: "noUnknownUnit",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnmatchableAnbSelector",
				js: "noUnmatchableAnbSelector",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnreachable",
				js: "noUnreachable",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnreachableSuper",
				js: "noUnreachableSuper",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnsafeFinally",
				js: "noUnsafeFinally",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnsafeOptionalChaining",
				js: "noUnsafeOptionalChaining",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnusedFunctionParameters",
				js: "noUnusedFunctionParameters",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnusedImports",
				js: "noUnusedImports",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnusedLabels",
				js: "noUnusedLabels",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnusedPrivateClassMembers",
				js: "noUnusedPrivateClassMembers",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnusedVariables",
				js: "noUnusedVariables",
				typ: u(
					undefined,
					u(
						r("RuleWithNoUnusedVariablesOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "noVoidElementsWithChildren",
				js: "noVoidElementsWithChildren",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noVoidTypeReturn",
				js: "noVoidTypeReturn",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "recommended",
				js: "recommended",
				typ: u(undefined, u(true, null)),
			},
			{
				json: "useExhaustiveDependencies",
				js: "useExhaustiveDependencies",
				typ: u(
					undefined,
					u(
						r("RuleWithUseExhaustiveDependenciesOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "useHookAtTopLevel",
				js: "useHookAtTopLevel",
				typ: u(
					undefined,
					u(
						r("RuleWithDeprecatedHooksOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "useImportExtensions",
				js: "useImportExtensions",
				typ: u(
					undefined,
					u(
						r("RuleWithUseImportExtensionsOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "useIsNan",
				js: "useIsNan",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useJsxKeyInIterable",
				js: "useJsxKeyInIterable",
				typ: u(
					undefined,
					u(
						r("RuleWithUseJsxKeyInIterableOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "useValidForDirection",
				js: "useValidForDirection",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useValidTypeof",
				js: "useValidTypeof",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useYield",
				js: "useYield",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
		],
		false,
	),
	RuleWithNoPrivateImportsOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("NoPrivateImportsOptions")),
			},
		],
		false,
	),
	NoPrivateImportsOptions: o(
		[
			{
				json: "defaultVisibility",
				js: "defaultVisibility",
				typ: u(undefined, r("Visibility")),
			},
		],
		false,
	),
	RuleWithNoUndeclaredDependenciesOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("NoUndeclaredDependenciesOptions")),
			},
		],
		false,
	),
	NoUndeclaredDependenciesOptions: o(
		[
			{
				json: "devDependencies",
				js: "devDependencies",
				typ: u(undefined, u(a(""), true)),
			},
			{
				json: "optionalDependencies",
				js: "optionalDependencies",
				typ: u(undefined, u(a(""), true)),
			},
			{
				json: "peerDependencies",
				js: "peerDependencies",
				typ: u(undefined, u(a(""), true)),
			},
		],
		false,
	),
	RuleWithUndeclaredVariablesOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("UndeclaredVariablesOptions")),
			},
		],
		false,
	),
	UndeclaredVariablesOptions: o(
		[{ json: "checkTypes", js: "checkTypes", typ: u(undefined, true) }],
		"any",
	),
	RuleWithNoUnusedVariablesOptions: o(
		[
			{ json: "fix", js: "fix", typ: u(undefined, u(r("FixKind"), null)) },
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("NoUnusedVariablesOptions")),
			},
		],
		false,
	),
	NoUnusedVariablesOptions: o(
		[
			{
				json: "ignoreRestSiblings",
				js: "ignoreRestSiblings",
				typ: u(undefined, true),
			},
		],
		false,
	),
	RuleWithUseExhaustiveDependenciesOptions: o(
		[
			{ json: "fix", js: "fix", typ: u(undefined, u(r("FixKind"), null)) },
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("UseExhaustiveDependenciesOptions")),
			},
		],
		false,
	),
	UseExhaustiveDependenciesOptions: o(
		[
			{ json: "hooks", js: "hooks", typ: u(undefined, a(r("Hook"))) },
			{
				json: "reportMissingDependenciesArray",
				js: "reportMissingDependenciesArray",
				typ: u(undefined, true),
			},
			{
				json: "reportUnnecessaryDependencies",
				js: "reportUnnecessaryDependencies",
				typ: u(undefined, true),
			},
		],
		false,
	),
	Hook: o(
		[
			{
				json: "closureIndex",
				js: "closureIndex",
				typ: u(undefined, u(0, null)),
			},
			{
				json: "dependenciesIndex",
				js: "dependenciesIndex",
				typ: u(undefined, u(0, null)),
			},
			{ json: "name", js: "name", typ: u(undefined, "") },
			{
				json: "stableResult",
				js: "stableResult",
				typ: u(undefined, u(a(0), true, null)),
			},
		],
		false,
	),
	RuleWithDeprecatedHooksOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("DeprecatedHooksOptions")),
			},
		],
		false,
	),
	DeprecatedHooksOptions: o([], false),
	RuleWithUseImportExtensionsOptions: o(
		[
			{ json: "fix", js: "fix", typ: u(undefined, u(r("FixKind"), null)) },
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("UseImportExtensionsOptions")),
			},
		],
		false,
	),
	UseImportExtensionsOptions: o(
		[
			{
				json: "forceJsExtensions",
				js: "forceJsExtensions",
				typ: u(undefined, true),
			},
		],
		false,
	),
	RuleWithUseJsxKeyInIterableOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("UseJsxKeyInIterableOptions")),
			},
		],
		false,
	),
	UseJsxKeyInIterableOptions: o(
		[
			{
				json: "checkShorthandFragments",
				js: "checkShorthandFragments",
				typ: u(undefined, true),
			},
		],
		false,
	),
	Nursery: o(
		[
			{
				json: "noAwaitInLoop",
				js: "noAwaitInLoop",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noBitwiseOperators",
				js: "noBitwiseOperators",
				typ: u(
					undefined,
					u(
						r("RuleWithNoBitwiseOperatorsOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "noConstantBinaryExpression",
				js: "noConstantBinaryExpression",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDestructuredProps",
				js: "noDestructuredProps",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noFloatingPromises",
				js: "noFloatingPromises",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noGlobalDirnameFilename",
				js: "noGlobalDirnameFilename",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noImportantStyles",
				js: "noImportantStyles",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noImportCycles",
				js: "noImportCycles",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noNestedComponentDefinitions",
				js: "noNestedComponentDefinitions",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noNoninteractiveElementInteractions",
				js: "noNoninteractiveElementInteractions",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noProcessGlobal",
				js: "noProcessGlobal",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noReactPropAssign",
				js: "noReactPropAssign",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noRestrictedElements",
				js: "noRestrictedElements",
				typ: u(
					undefined,
					u(
						r("RuleWithNoRestrictedElementsOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "noSecrets",
				js: "noSecrets",
				typ: u(
					undefined,
					u(r("RuleWithNoSecretsOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noShadow",
				js: "noShadow",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noTsIgnore",
				js: "noTsIgnore",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnknownAtRule",
				js: "noUnknownAtRule",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnresolvedImports",
				js: "noUnresolvedImports",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnwantedPolyfillio",
				js: "noUnwantedPolyfillio",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessBackrefInRegex",
				js: "noUselessBackrefInRegex",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessEscapeInString",
				js: "noUselessEscapeInString",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessUndefined",
				js: "noUselessUndefined",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "recommended",
				js: "recommended",
				typ: u(undefined, u(true, null)),
			},
			{
				json: "useAdjacentGetterSetter",
				js: "useAdjacentGetterSetter",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useConsistentObjectDefinition",
				js: "useConsistentObjectDefinition",
				typ: u(
					undefined,
					u(
						r("RuleWithUseConsistentObjectDefinitionOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "useConsistentResponse",
				js: "useConsistentResponse",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useExhaustiveSwitchCases",
				js: "useExhaustiveSwitchCases",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useExplicitType",
				js: "useExplicitType",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useExportsLast",
				js: "useExportsLast",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useForComponent",
				js: "useForComponent",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useGoogleFontPreconnect",
				js: "useGoogleFontPreconnect",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useIndexOf",
				js: "useIndexOf",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useIterableCallbackReturn",
				js: "useIterableCallbackReturn",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useJsonImportAttribute",
				js: "useJsonImportAttribute",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useNamedOperation",
				js: "useNamedOperation",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useNamingConvention",
				js: "useNamingConvention",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useNumericSeparators",
				js: "useNumericSeparators",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useObjectSpread",
				js: "useObjectSpread",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useParseIntRadix",
				js: "useParseIntRadix",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useReadonlyClassProperties",
				js: "useReadonlyClassProperties",
				typ: u(
					undefined,
					u(
						r("RuleWithReadonlyClassPropertiesOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "useSingleJsDocAsterisk",
				js: "useSingleJsDocAsterisk",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useSortedClasses",
				js: "useSortedClasses",
				typ: u(
					undefined,
					u(
						r("RuleWithUtilityClassSortingOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "useSymbolDescription",
				js: "useSymbolDescription",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useUniqueElementIds",
				js: "useUniqueElementIds",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
		],
		false,
	),
	RuleWithNoBitwiseOperatorsOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("NoBitwiseOperatorsOptions")),
			},
		],
		false,
	),
	NoBitwiseOperatorsOptions: o(
		[{ json: "allow", js: "allow", typ: u(undefined, a("")) }],
		false,
	),
	RuleWithNoRestrictedElementsOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("NoRestrictedElementsOptions")),
			},
		],
		false,
	),
	NoRestrictedElementsOptions: o(
		[{ json: "elements", js: "elements", typ: u(undefined, m("")) }],
		false,
	),
	RuleWithNoSecretsOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("NoSecretsOptions")),
			},
		],
		false,
	),
	NoSecretsOptions: o(
		[
			{
				json: "entropyThreshold",
				js: "entropyThreshold",
				typ: u(undefined, u(0, null)),
			},
		],
		false,
	),
	RuleWithUseConsistentObjectDefinitionOptions: o(
		[
			{ json: "fix", js: "fix", typ: u(undefined, u(r("FixKind"), null)) },
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("UseConsistentObjectDefinitionOptions")),
			},
		],
		false,
	),
	UseConsistentObjectDefinitionOptions: o(
		[
			{
				json: "syntax",
				js: "syntax",
				typ: u(undefined, r("ObjectPropertySyntax")),
			},
		],
		false,
	),
	RuleWithReadonlyClassPropertiesOptions: o(
		[
			{ json: "fix", js: "fix", typ: u(undefined, u(r("FixKind"), null)) },
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("ReadonlyClassPropertiesOptions")),
			},
		],
		false,
	),
	ReadonlyClassPropertiesOptions: o(
		[
			{
				json: "checkAllProperties",
				js: "checkAllProperties",
				typ: u(undefined, true),
			},
		],
		false,
	),
	RuleWithUtilityClassSortingOptions: o(
		[
			{ json: "fix", js: "fix", typ: u(undefined, u(r("FixKind"), null)) },
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("UtilityClassSortingOptions")),
			},
		],
		false,
	),
	UtilityClassSortingOptions: o(
		[
			{
				json: "attributes",
				js: "attributes",
				typ: u(undefined, u(a(""), null)),
			},
			{ json: "functions", js: "functions", typ: u(undefined, u(a(""), null)) },
		],
		false,
	),
	Performance: o(
		[
			{
				json: "noAccumulatingSpread",
				js: "noAccumulatingSpread",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noBarrelFile",
				js: "noBarrelFile",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDelete",
				js: "noDelete",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDynamicNamespaceImportAccess",
				js: "noDynamicNamespaceImportAccess",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noImgElement",
				js: "noImgElement",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noNamespaceImport",
				js: "noNamespaceImport",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noReExportAll",
				js: "noReExportAll",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "recommended",
				js: "recommended",
				typ: u(undefined, u(true, null)),
			},
			{
				json: "useTopLevelRegex",
				js: "useTopLevelRegex",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
		],
		false,
	),
	Security: o(
		[
			{
				json: "noBlankTarget",
				js: "noBlankTarget",
				typ: u(
					undefined,
					u(
						r("RuleWithNoBlankTargetOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "noDangerouslySetInnerHtml",
				js: "noDangerouslySetInnerHtml",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDangerouslySetInnerHtmlWithChildren",
				js: "noDangerouslySetInnerHtmlWithChildren",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noGlobalEval",
				js: "noGlobalEval",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "recommended",
				js: "recommended",
				typ: u(undefined, u(true, null)),
			},
		],
		false,
	),
	RuleWithNoBlankTargetOptions: o(
		[
			{ json: "fix", js: "fix", typ: u(undefined, u(r("FixKind"), null)) },
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("NoBlankTargetOptions")),
			},
		],
		false,
	),
	NoBlankTargetOptions: o(
		[
			{ json: "allowDomains", js: "allowDomains", typ: u(undefined, a("")) },
			{
				json: "allowNoReferrer",
				js: "allowNoReferrer",
				typ: u(undefined, true),
			},
		],
		false,
	),
	Style: o(
		[
			{
				json: "noCommonJs",
				js: "noCommonJs",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDefaultExport",
				js: "noDefaultExport",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDescendingSpecificity",
				js: "noDescendingSpecificity",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDoneCallback",
				js: "noDoneCallback",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noEnum",
				js: "noEnum",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noExportedImports",
				js: "noExportedImports",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noHeadElement",
				js: "noHeadElement",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noImplicitBoolean",
				js: "noImplicitBoolean",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noInferrableTypes",
				js: "noInferrableTypes",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noNamespace",
				js: "noNamespace",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noNegationElse",
				js: "noNegationElse",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noNestedTernary",
				js: "noNestedTernary",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noNonNullAssertion",
				js: "noNonNullAssertion",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noParameterAssign",
				js: "noParameterAssign",
				typ: u(
					undefined,
					u(
						r("RuleWithNoParameterAssignOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "noParameterProperties",
				js: "noParameterProperties",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noProcessEnv",
				js: "noProcessEnv",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noRestrictedGlobals",
				js: "noRestrictedGlobals",
				typ: u(
					undefined,
					u(
						r("RuleWithRestrictedGlobalsOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "noRestrictedImports",
				js: "noRestrictedImports",
				typ: u(
					undefined,
					u(
						r("RuleWithRestrictedImportsOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "noRestrictedTypes",
				js: "noRestrictedTypes",
				typ: u(
					undefined,
					u(
						r("RuleWithNoRestrictedTypesOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "noShoutyConstants",
				js: "noShoutyConstants",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noSubstr",
				js: "noSubstr",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnusedTemplateLiteral",
				js: "noUnusedTemplateLiteral",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUselessElse",
				js: "noUselessElse",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noValueAtRule",
				js: "noValueAtRule",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noYodaExpression",
				js: "noYodaExpression",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "recommended",
				js: "recommended",
				typ: u(undefined, u(true, null)),
			},
			{
				json: "useArrayLiterals",
				js: "useArrayLiterals",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useAsConstAssertion",
				js: "useAsConstAssertion",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useAtIndex",
				js: "useAtIndex",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useBlockStatements",
				js: "useBlockStatements",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useCollapsedElseIf",
				js: "useCollapsedElseIf",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useCollapsedIf",
				js: "useCollapsedIf",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useComponentExportOnlyModules",
				js: "useComponentExportOnlyModules",
				typ: u(
					undefined,
					u(
						r("RuleWithUseComponentExportOnlyModulesOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "useConsistentArrayType",
				js: "useConsistentArrayType",
				typ: u(
					undefined,
					u(
						r("RuleWithConsistentArrayTypeOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "useConsistentBuiltinInstantiation",
				js: "useConsistentBuiltinInstantiation",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useConsistentCurlyBraces",
				js: "useConsistentCurlyBraces",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useConsistentMemberAccessibility",
				js: "useConsistentMemberAccessibility",
				typ: u(
					undefined,
					u(
						r("RuleWithConsistentMemberAccessibilityOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "useConst",
				js: "useConst",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useDefaultParameterLast",
				js: "useDefaultParameterLast",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useDefaultSwitchClause",
				js: "useDefaultSwitchClause",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useDeprecatedReason",
				js: "useDeprecatedReason",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useEnumInitializers",
				js: "useEnumInitializers",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useExplicitLengthCheck",
				js: "useExplicitLengthCheck",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useExponentiationOperator",
				js: "useExponentiationOperator",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useExportType",
				js: "useExportType",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useFilenamingConvention",
				js: "useFilenamingConvention",
				typ: u(
					undefined,
					u(
						r("RuleWithFilenamingConventionOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "useForOf",
				js: "useForOf",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useFragmentSyntax",
				js: "useFragmentSyntax",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useImportType",
				js: "useImportType",
				typ: u(
					undefined,
					u(r("RuleWithImportTypeOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useLiteralEnumMembers",
				js: "useLiteralEnumMembers",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useNamingConvention",
				js: "useNamingConvention",
				typ: u(
					undefined,
					u(
						r("RuleWithNamingConventionOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "useNodeAssertStrict",
				js: "useNodeAssertStrict",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useNodejsImportProtocol",
				js: "useNodejsImportProtocol",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useNumberNamespace",
				js: "useNumberNamespace",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useSelfClosingElements",
				js: "useSelfClosingElements",
				typ: u(
					undefined,
					u(
						r("RuleWithUseSelfClosingElementsOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "useShorthandAssign",
				js: "useShorthandAssign",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useShorthandFunctionType",
				js: "useShorthandFunctionType",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useSingleVarDeclarator",
				js: "useSingleVarDeclarator",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useTemplate",
				js: "useTemplate",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useThrowNewError",
				js: "useThrowNewError",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useThrowOnlyError",
				js: "useThrowOnlyError",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useTrimStartEnd",
				js: "useTrimStartEnd",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
		],
		false,
	),
	RuleWithNoParameterAssignOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("NoParameterAssignOptions")),
			},
		],
		false,
	),
	NoParameterAssignOptions: o(
		[
			{
				json: "propertyAssignment",
				js: "propertyAssignment",
				typ: u(undefined, r("PropertyAssignmentMode")),
			},
		],
		false,
	),
	RuleWithRestrictedGlobalsOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("RestrictedGlobalsOptions")),
			},
		],
		false,
	),
	RestrictedGlobalsOptions: o(
		[{ json: "deniedGlobals", js: "deniedGlobals", typ: u(undefined, m("")) }],
		false,
	),
	RuleWithRestrictedImportsOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("RestrictedImportsOptions")),
			},
		],
		false,
	),
	RestrictedImportsOptions: o(
		[
			{
				json: "paths",
				js: "paths",
				typ: u(undefined, m(u(r("CustomRestrictedImportOptions"), ""))),
			},
		],
		false,
	),
	CustomRestrictedImportOptions: o(
		[
			{
				json: "allowImportNames",
				js: "allowImportNames",
				typ: u(undefined, a("")),
			},
			{ json: "importNames", js: "importNames", typ: u(undefined, a("")) },
			{ json: "message", js: "message", typ: u(undefined, "") },
		],
		false,
	),
	RuleWithNoRestrictedTypesOptions: o(
		[
			{ json: "fix", js: "fix", typ: u(undefined, u(r("FixKind"), null)) },
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("NoRestrictedTypesOptions")),
			},
		],
		false,
	),
	NoRestrictedTypesOptions: o(
		[
			{
				json: "types",
				js: "types",
				typ: u(undefined, m(u(r("CustomRestrictedTypeOptions"), ""))),
			},
		],
		false,
	),
	CustomRestrictedTypeOptions: o(
		[
			{ json: "message", js: "message", typ: u(undefined, "") },
			{ json: "use", js: "use", typ: u(undefined, u(null, "")) },
		],
		false,
	),
	RuleWithUseComponentExportOnlyModulesOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("UseComponentExportOnlyModulesOptions")),
			},
		],
		false,
	),
	UseComponentExportOnlyModulesOptions: o(
		[
			{
				json: "allowConstantExport",
				js: "allowConstantExport",
				typ: u(undefined, true),
			},
			{
				json: "allowExportNames",
				js: "allowExportNames",
				typ: u(undefined, a("")),
			},
		],
		false,
	),
	RuleWithConsistentArrayTypeOptions: o(
		[
			{ json: "fix", js: "fix", typ: u(undefined, u(r("FixKind"), null)) },
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("ConsistentArrayTypeOptions")),
			},
		],
		false,
	),
	ConsistentArrayTypeOptions: o(
		[
			{
				json: "syntax",
				js: "syntax",
				typ: u(undefined, r("ConsistentArrayType")),
			},
		],
		false,
	),
	RuleWithConsistentMemberAccessibilityOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("ConsistentMemberAccessibilityOptions")),
			},
		],
		false,
	),
	ConsistentMemberAccessibilityOptions: o(
		[
			{
				json: "accessibility",
				js: "accessibility",
				typ: u(undefined, r("Accessibility")),
			},
		],
		false,
	),
	RuleWithFilenamingConventionOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("FilenamingConventionOptions")),
			},
		],
		false,
	),
	FilenamingConventionOptions: o(
		[
			{
				json: "filenameCases",
				js: "filenameCases",
				typ: u(undefined, a(r("FilenameCase"))),
			},
			{ json: "match", js: "match", typ: u(undefined, u(null, "")) },
			{ json: "requireAscii", js: "requireAscii", typ: u(undefined, true) },
			{ json: "strictCase", js: "strictCase", typ: u(undefined, true) },
		],
		false,
	),
	RuleWithImportTypeOptions: o(
		[
			{ json: "fix", js: "fix", typ: u(undefined, u(r("FixKind"), null)) },
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("ImportTypeOptions")),
			},
		],
		false,
	),
	ImportTypeOptions: o(
		[{ json: "style", js: "style", typ: r("Style2") }],
		false,
	),
	RuleWithNamingConventionOptions: o(
		[
			{ json: "fix", js: "fix", typ: u(undefined, u(r("FixKind"), null)) },
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("NamingConventionOptions")),
			},
		],
		false,
	),
	NamingConventionOptions: o(
		[
			{
				json: "conventions",
				js: "conventions",
				typ: u(undefined, a(r("Convention"))),
			},
			{ json: "requireAscii", js: "requireAscii", typ: u(undefined, true) },
			{ json: "strictCase", js: "strictCase", typ: u(undefined, true) },
		],
		false,
	),
	Convention: o(
		[
			{ json: "formats", js: "formats", typ: u(undefined, a(r("Format"))) },
			{ json: "match", js: "match", typ: u(undefined, u(null, "")) },
			{ json: "selector", js: "selector", typ: u(undefined, r("Selector")) },
		],
		false,
	),
	Selector: o(
		[
			{ json: "kind", js: "kind", typ: u(undefined, r("Kind")) },
			{
				json: "modifiers",
				js: "modifiers",
				typ: u(undefined, a(r("RestrictedModifier"))),
			},
			{ json: "scope", js: "scope", typ: u(undefined, r("Scope")) },
		],
		false,
	),
	RuleWithUseSelfClosingElementsOptions: o(
		[
			{ json: "fix", js: "fix", typ: u(undefined, u(r("FixKind"), null)) },
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("UseSelfClosingElementsOptions")),
			},
		],
		false,
	),
	UseSelfClosingElementsOptions: o(
		[
			{
				json: "ignoreHtmlElements",
				js: "ignoreHtmlElements",
				typ: u(undefined, true),
			},
		],
		false,
	),
	Suspicious: o(
		[
			{
				json: "noApproximativeNumericConstant",
				js: "noApproximativeNumericConstant",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noArrayIndexKey",
				js: "noArrayIndexKey",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noAssignInExpressions",
				js: "noAssignInExpressions",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noAsyncPromiseExecutor",
				js: "noAsyncPromiseExecutor",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noCatchAssign",
				js: "noCatchAssign",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noClassAssign",
				js: "noClassAssign",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noCommentText",
				js: "noCommentText",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noCompareNegZero",
				js: "noCompareNegZero",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noConfusingLabels",
				js: "noConfusingLabels",
				typ: u(
					undefined,
					u(
						r("RuleWithNoConfusingLabelsOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "noConfusingVoidType",
				js: "noConfusingVoidType",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noConsole",
				js: "noConsole",
				typ: u(
					undefined,
					u(r("RuleWithNoConsoleOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noConstEnum",
				js: "noConstEnum",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noControlCharactersInRegex",
				js: "noControlCharactersInRegex",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDebugger",
				js: "noDebugger",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDocumentCookie",
				js: "noDocumentCookie",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDocumentImportInPage",
				js: "noDocumentImportInPage",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDoubleEquals",
				js: "noDoubleEquals",
				typ: u(
					undefined,
					u(
						r("RuleWithNoDoubleEqualsOptions"),
						r("RulePlainConfiguration"),
						null,
					),
				),
			},
			{
				json: "noDuplicateAtImportRules",
				js: "noDuplicateAtImportRules",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDuplicateCase",
				js: "noDuplicateCase",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDuplicateClassMembers",
				js: "noDuplicateClassMembers",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDuplicateCustomProperties",
				js: "noDuplicateCustomProperties",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDuplicateElseIf",
				js: "noDuplicateElseIf",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDuplicateFields",
				js: "noDuplicateFields",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDuplicateFontNames",
				js: "noDuplicateFontNames",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDuplicateJsxProps",
				js: "noDuplicateJsxProps",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDuplicateObjectKeys",
				js: "noDuplicateObjectKeys",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDuplicateParameters",
				js: "noDuplicateParameters",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDuplicateProperties",
				js: "noDuplicateProperties",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDuplicateSelectorsKeyframeBlock",
				js: "noDuplicateSelectorsKeyframeBlock",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noDuplicateTestHooks",
				js: "noDuplicateTestHooks",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noEmptyBlock",
				js: "noEmptyBlock",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noEmptyBlockStatements",
				js: "noEmptyBlockStatements",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noEmptyInterface",
				js: "noEmptyInterface",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noEvolvingTypes",
				js: "noEvolvingTypes",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noExplicitAny",
				js: "noExplicitAny",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noExportsInTest",
				js: "noExportsInTest",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noExtraNonNullAssertion",
				js: "noExtraNonNullAssertion",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noFallthroughSwitchClause",
				js: "noFallthroughSwitchClause",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noFocusedTests",
				js: "noFocusedTests",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noFunctionAssign",
				js: "noFunctionAssign",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noGlobalAssign",
				js: "noGlobalAssign",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noGlobalIsFinite",
				js: "noGlobalIsFinite",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noGlobalIsNan",
				js: "noGlobalIsNan",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noHeadImportInDocument",
				js: "noHeadImportInDocument",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noImplicitAnyLet",
				js: "noImplicitAnyLet",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noImportantInKeyframe",
				js: "noImportantInKeyframe",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noImportAssign",
				js: "noImportAssign",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noIrregularWhitespace",
				js: "noIrregularWhitespace",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noLabelVar",
				js: "noLabelVar",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noMisleadingCharacterClass",
				js: "noMisleadingCharacterClass",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noMisleadingInstantiator",
				js: "noMisleadingInstantiator",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noMisplacedAssertion",
				js: "noMisplacedAssertion",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noMisrefactoredShorthandAssign",
				js: "noMisrefactoredShorthandAssign",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noOctalEscape",
				js: "noOctalEscape",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noPrototypeBuiltins",
				js: "noPrototypeBuiltins",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noReactSpecificProps",
				js: "noReactSpecificProps",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noRedeclare",
				js: "noRedeclare",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noRedundantUseStrict",
				js: "noRedundantUseStrict",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noSelfCompare",
				js: "noSelfCompare",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noShadowRestrictedNames",
				js: "noShadowRestrictedNames",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noShorthandPropertyOverrides",
				js: "noShorthandPropertyOverrides",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noSkippedTests",
				js: "noSkippedTests",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noSparseArray",
				js: "noSparseArray",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noSuspiciousSemicolonInJsx",
				js: "noSuspiciousSemicolonInJsx",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noTemplateCurlyInString",
				js: "noTemplateCurlyInString",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noThenProperty",
				js: "noThenProperty",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnsafeDeclarationMerging",
				js: "noUnsafeDeclarationMerging",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noUnsafeNegation",
				js: "noUnsafeNegation",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noVar",
				js: "noVar",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "noWith",
				js: "noWith",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "recommended",
				js: "recommended",
				typ: u(undefined, u(true, null)),
			},
			{
				json: "useAdjacentOverloadSignatures",
				js: "useAdjacentOverloadSignatures",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useAwait",
				js: "useAwait",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useDefaultSwitchClauseLast",
				js: "useDefaultSwitchClauseLast",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useErrorMessage",
				js: "useErrorMessage",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useGetterReturn",
				js: "useGetterReturn",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useGoogleFontDisplay",
				js: "useGoogleFontDisplay",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useGuardForIn",
				js: "useGuardForIn",
				typ: u(
					undefined,
					u(r("RuleWithNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useIsArray",
				js: "useIsArray",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useNamespaceKeyword",
				js: "useNamespaceKeyword",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useNumberToFixedDigitsArgument",
				js: "useNumberToFixedDigitsArgument",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
			{
				json: "useStrictMode",
				js: "useStrictMode",
				typ: u(
					undefined,
					u(r("RuleWithFixNoOptions"), r("RulePlainConfiguration"), null),
				),
			},
		],
		false,
	),
	RuleWithNoConfusingLabelsOptions: o(
		[
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("NoConfusingLabelsOptions")),
			},
		],
		false,
	),
	NoConfusingLabelsOptions: o(
		[{ json: "allowedLabels", js: "allowedLabels", typ: u(undefined, a("")) }],
		false,
	),
	RuleWithNoConsoleOptions: o(
		[
			{ json: "fix", js: "fix", typ: u(undefined, u(r("FixKind"), null)) },
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("NoConsoleOptions")),
			},
		],
		false,
	),
	NoConsoleOptions: o([{ json: "allow", js: "allow", typ: a("") }], false),
	RuleWithNoDoubleEqualsOptions: o(
		[
			{ json: "fix", js: "fix", typ: u(undefined, u(r("FixKind"), null)) },
			{ json: "level", js: "level", typ: r("RulePlainConfiguration") },
			{
				json: "options",
				js: "options",
				typ: u(undefined, r("NoDoubleEqualsOptions")),
			},
		],
		false,
	),
	NoDoubleEqualsOptions: o(
		[{ json: "ignoreNull", js: "ignoreNull", typ: u(undefined, true) }],
		false,
	),
	OverridePattern: o(
		[
			{
				json: "assist",
				js: "assist",
				typ: u(undefined, u(r("OverrideAssistConfiguration"), null)),
			},
			{
				json: "css",
				js: "css",
				typ: u(undefined, u(r("CSSConfiguration"), null)),
			},
			{
				json: "files",
				js: "files",
				typ: u(undefined, u(r("OverrideFilesConfiguration"), null)),
			},
			{
				json: "formatter",
				js: "formatter",
				typ: u(undefined, u(r("OverrideFormatterConfiguration"), null)),
			},
			{
				json: "graphql",
				js: "graphql",
				typ: u(undefined, u(r("GraphqlConfiguration"), null)),
			},
			{
				json: "grit",
				js: "grit",
				typ: u(undefined, u(r("GritConfiguration"), null)),
			},
			{
				json: "html",
				js: "html",
				typ: u(undefined, u(r("HTMLConfiguration"), null)),
			},
			{ json: "includes", js: "includes", typ: u(undefined, u(a(""), null)) },
			{
				json: "javascript",
				js: "javascript",
				typ: u(undefined, u(r("JSConfiguration"), null)),
			},
			{
				json: "json",
				js: "json",
				typ: u(undefined, u(r("JSONConfiguration"), null)),
			},
			{
				json: "linter",
				js: "linter",
				typ: u(undefined, u(r("OverrideLinterConfiguration"), null)),
			},
			{ json: "plugins", js: "plugins", typ: u(undefined, u(a(""), null)) },
		],
		false,
	),
	OverrideAssistConfiguration: o(
		[
			{
				json: "actions",
				js: "actions",
				typ: u(undefined, u(r("Actions"), null)),
			},
			{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) },
		],
		false,
	),
	OverrideFilesConfiguration: o(
		[{ json: "maxSize", js: "maxSize", typ: u(undefined, u(0, null)) }],
		false,
	),
	OverrideFormatterConfiguration: o(
		[
			{
				json: "attributePosition",
				js: "attributePosition",
				typ: u(undefined, u(r("AttributePosition"), null)),
			},
			{
				json: "bracketSameLine",
				js: "bracketSameLine",
				typ: u(undefined, u(true, null)),
			},
			{
				json: "bracketSpacing",
				js: "bracketSpacing",
				typ: u(undefined, u(true, null)),
			},
			{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) },
			{ json: "expand", js: "expand", typ: u(undefined, u(r("Expand"), null)) },
			{
				json: "formatWithErrors",
				js: "formatWithErrors",
				typ: u(undefined, u(true, null)),
			},
			{ json: "indentSize", js: "indentSize", typ: u(undefined, u(0, null)) },
			{
				json: "indentStyle",
				js: "indentStyle",
				typ: u(undefined, u(r("IndentStyle"), null)),
			},
			{ json: "indentWidth", js: "indentWidth", typ: u(undefined, u(0, null)) },
			{
				json: "lineEnding",
				js: "lineEnding",
				typ: u(undefined, u(r("LineEnding"), null)),
			},
			{ json: "lineWidth", js: "lineWidth", typ: u(undefined, u(0, null)) },
		],
		false,
	),
	OverrideLinterConfiguration: o(
		[
			{
				json: "domains",
				js: "domains",
				typ: u(undefined, u(m(r("RuleDomainValue")), null)),
			},
			{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) },
			{ json: "rules", js: "rules", typ: u(undefined, u(r("Rules"), null)) },
		],
		false,
	),
	VcsConfiguration: o(
		[
			{
				json: "clientKind",
				js: "clientKind",
				typ: u(undefined, u(r("VcsClientKind"), null)),
			},
			{
				json: "defaultBranch",
				js: "defaultBranch",
				typ: u(undefined, u(null, "")),
			},
			{ json: "enabled", js: "enabled", typ: u(undefined, u(true, null)) },
			{ json: "root", js: "root", typ: u(undefined, u(null, "")) },
			{
				json: "useIgnoreFile",
				js: "useIgnoreFile",
				typ: u(undefined, u(true, null)),
			},
		],
		false,
	),
	RuleAssistPlainConfiguration: ["off", "on"],
	IndentStyle: ["space", "tab"],
	LineEnding: ["cr", "crlf", "lf"],
	QuoteStyle: ["double", "single"],
	AttributePosition: ["auto", "multiline"],
	Expand: ["always", "auto", "never"],
	SelfCloseVoidElements: ["always", "never"],
	WhitespaceSensitivity: ["css", "ignore", "strict"],
	ArrowParentheses: ["always", "asNeeded"],
	QuoteProperties: ["asNeeded", "preserve"],
	TrailingCommas: ["all", "es5", "none"],
	JsxRuntime: ["reactClassic", "transparent"],
	TrailingCommas2: ["all", "none"],
	RuleDomainValue: ["all", "none", "recommended"],
	FixKind: ["none", "safe", "unsafe"],
	RulePlainConfiguration: ["error", "info", "off", "on", "warn"],
	Visibility: ["package", "private", "public"],
	ObjectPropertySyntax: ["explicit", "shorthand"],
	PropertyAssignmentMode: ["allow", "deny"],
	ConsistentArrayType: ["generic", "shorthand"],
	Accessibility: ["explicit", "noPublic", "none"],
	FilenameCase: [
		"camelCase",
		"export",
		"kebab-case",
		"PascalCase",
		"snake_case",
	],
	Style2: ["auto", "inlineType", "separatedType"],
	Format: ["camelCase", "CONSTANT_CASE", "PascalCase", "snake_case"],
	Kind: [
		"any",
		"catchParameter",
		"class",
		"classGetter",
		"classMember",
		"classMethod",
		"classProperty",
		"classSetter",
		"const",
		"enum",
		"enumMember",
		"exportAlias",
		"exportNamespace",
		"function",
		"functionParameter",
		"importAlias",
		"importNamespace",
		"indexParameter",
		"interface",
		"let",
		"namespace",
		"namespaceLike",
		"objectLiteralGetter",
		"objectLiteralMember",
		"objectLiteralMethod",
		"objectLiteralProperty",
		"objectLiteralSetter",
		"typeAlias",
		"typeGetter",
		"typeLike",
		"typeMember",
		"typeMethod",
		"typeParameter",
		"typeProperty",
		"typeSetter",
		"using",
		"var",
		"variable",
	],
	RestrictedModifier: [
		"abstract",
		"private",
		"protected",
		"readonly",
		"static",
	],
	Scope: ["any", "global"],
	VcsClientKind: ["git"],
};
