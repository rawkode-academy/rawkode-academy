const unavailable = () => Response.json(
	{ error: "This integration is disabled in the isolated website preview." },
	{ status: 503, headers: { "Cache-Control": "no-store" } },
)

export default {
	fetch() {
		return unavailable()
	},
}
