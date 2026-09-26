import type { TenNinesContent } from "../../games/ten-nines";
export const tenNinesSeed: TenNinesContent = { title: "Ten Nines", rounds: [
	{ prompt: "Name ten HTTP status codes.", answers: [
		{ answer: "200", aliases: ["ok"] }, { answer: "201", aliases: ["created"] }, { answer: "204", aliases: ["no content"] }, { answer: "301", aliases: ["moved permanently"] }, { answer: "400", aliases: ["bad request"] }, { answer: "401", aliases: ["unauthorized"] }, { answer: "403", aliases: ["forbidden"] }, { answer: "404", aliases: ["not found"] }, { answer: "429", aliases: ["too many requests"] }, { answer: "500", aliases: ["internal server error"] },
	] },
	{ prompt: "Name ten things Git can track.", answers: [
		{ answer: "commit" }, { answer: "branch" }, { answer: "tag" }, { answer: "remote" }, { answer: "stash" }, { answer: "merge" }, { answer: "rebase" }, { answer: "blame" }, { answer: "submodule" }, { answer: "worktree" },
	] },
] };
