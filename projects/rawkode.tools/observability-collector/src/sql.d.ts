// Bun's text import is also embedded by CUE for the immutable pipeline resources.
declare module "*.sql" {
	const sql: string;
	export default sql;
}
