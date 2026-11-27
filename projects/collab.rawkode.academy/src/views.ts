import { formatTimestamp, type Scope } from "./access.ts";
import { esc, page } from "./html.ts";
import type { Comment, Org, Principal, Review, Session, Triage } from "./types.ts";

const STATE_LABEL: Record<Review["state"], string> = {
	in_review: "In review",
	changes_requested: "Changes requested",
	approved: "Approved",
	scheduled: "Scheduled",
	published: "Published",
};

const TRIAGE_LABEL: Record<Triage, string> = {
	new: "New",
	actionable: "Actionable",
	not_actionable: "Not actionable",
	fixed: "Fixed",
	withdrawn: "Withdrawn",
};

export const header = (session: Session, scope: Scope, orgs: readonly Org[], preview: boolean): string => {
	const { principal } = session;
	const banner = scope.banner
		? `<div class="banner"><span>Viewing as <strong>${esc(scope.banner.orgName)}</strong> (${scope.banner.persona}). Read-only.</span><form method="post" action="/view-as/exit"><button class="ghost" style="background:transparent">Exit</button></form></div>`
		: "";
	const previewNote = preview
		? `<div class="banner"><span>Preview with fictional data. Nothing here is real and sign-in is a persona picker.</span></div>`
		: "";
	const viewAs = principal.admin && !scope.banner
		? `<form method="post" action="/view-as" class="row"><select name="target" aria-label="View as">${orgs
				.flatMap((org) => [
					...(org.kind !== "supporter" ? [`<option value="${esc(org.id)}|partner">View as Partner: ${esc(org.name)}</option>`] : []),
					...(org.kind !== "partner" ? [`<option value="${esc(org.id)}|supporter">View as Supporter: ${esc(org.name)}</option>`] : []),
				])
				.join("")}</select><button class="ghost" style="background:transparent">View as</button></form>`
		: "";
	return `${previewNote}${banner}<header><a href="/"><strong>Rawkode Academy partner portal</strong></a><div class="row">${viewAs}<span class="muted">${esc(principal.name)}</span><form method="post" action="/logout"><button class="ghost" style="background:transparent">Sign out</button></form></div></header>`;
};

export const loginPage = (preview: boolean, personas: readonly { key: string; label: string }[]): string =>
	page(
		"Sign in",
		`<main><h1>Partner portal</h1><p>Where partners review draft videos before they go live.</p>${
			preview
				? `<div class="card"><p><strong>Preview.</strong> Pick a fictional person to click through as.</p>${personas
						.map(
							(persona) =>
								`<form method="post" action="/login/preview" style="margin:.4rem 0"><input type="hidden" name="persona" value="${esc(persona.key)}"><button>${esc(persona.label)}</button></form>`,
						)
						.join("")}</div>`
				: `<p><a class="btn" href="/login/start">Sign in with GitHub</a></p><p class="muted">You need a GitHub account that Rawkode Academy has added to your organisation.</p>`
		}</main>`,
	);

export const dashboardPage = (
	session: Session,
	scope: Scope,
	orgs: readonly Org[],
	preview: boolean,
	reviews: readonly Review[],
): string => {
	const orgName = (id: string) => orgs.find((org) => org.id === id)?.name ?? id;
	const mine = orgs.filter((org) => scope.orgIds.has(org.id));
	const body =
		scope.persona === "supporter"
			? `<h1>Supporter</h1>${mine
					.map((org) => `<div class="card"><h2>${esc(org.name)}</h2><p class="muted">Your supporter recognition lives on your technology page. Announcements, when you have one, are managed here.</p></div>`)
					.join("")}`
			: `<h1>Draft reviews</h1>${
					reviews.length === 0
						? `<p class="muted">Nothing to review right now.</p>`
						: reviews
								.map(
									(review) =>
										`<div class="card"><h2><a href="/reviews/${esc(review.id)}">${esc(review.title)}</a></h2><div class="row"><span class="pill">${STATE_LABEL[review.state]}</span><span class="muted">${esc(orgName(review.orgId))}</span><span class="muted">Due ${esc(review.dueAt.slice(0, 10))}</span></div></div>`,
								)
								.join("")
				}`;
	return page("Home", `${header(session, scope, orgs, preview)}<main>${body}</main>`);
};

const jsonForScript = (value: unknown): string => JSON.stringify(value).replaceAll("<", "\\u003c");

export const reviewPage = (input: {
	session: Session;
	scope: Scope;
	orgs: readonly Org[];
	preview: boolean;
	review: Review;
	comments: readonly Comment[];
	canComment: boolean;
	canSignOff: boolean;
	nonce: string;
	principal: Principal;
}): string => {
	const { review, comments, scope } = input;
	const commentHtml = comments
		.map((comment) => {
			const when =
				comment.timestampMs === null
					? `<span class="muted">General</span>`
					: `<button type="button" class="ts" data-seek="${comment.timestampMs}">${formatTimestamp(comment.timestampMs)}</button>`;
			const triage = scope.canTriage
				? `<select data-triage="${esc(comment.id)}" aria-label="Triage">${(["new", "actionable", "not_actionable", "fixed"] as Triage[])
						.map((state) => `<option value="${state}"${state === comment.triage ? " selected" : ""}>${TRIAGE_LABEL[state]}</option>`)
						.join("")}</select>`
				: `<span class="pill">${TRIAGE_LABEL[comment.triage]}</span>`;
			const withdraw =
				!scope.canTriage && !scope.readOnly && comment.authorLogin === input.principal.login && comment.triage === "new"
					? ` <button type="button" class="ghost" style="background:transparent" data-withdraw="${esc(comment.id)}">Withdraw</button>`
					: "";
			return `<div class="comment" id="c-${esc(comment.id)}"><div class="row">${when}<strong>${esc(comment.authorName)}</strong><span class="muted">${comment.authorSide === "staff" ? "Rawkode" : "Partner"}</span>${triage}${withdraw}</div><p style="margin:.3rem 0">${esc(comment.body)}</p>${comment.triageNote ? `<p class="muted" style="margin:0">Note: ${esc(comment.triageNote)}</p>` : ""}</div>`;
		})
		.join("");
	const form = input.canComment
		? `<form id="new-comment"><label class="muted" for="body">Comment on anything: a mistake, a rendering issue, a weird cut. David decides what to act on.</label><textarea id="body" rows="3" required maxlength="2000"></textarea><div class="row" style="margin-top:.5rem"><label class="row" style="width:auto"><input type="checkbox" id="pin" checked style="width:auto"> Pin to <span id="now">0:00</span></label><button>Add comment</button></div><p id="err" class="muted" role="alert"></p></form>`
		: `<p class="muted">${scope.readOnly ? "Read-only while viewing as." : "Comments are closed for this review."}</p>`;
	const signoff = input.canSignOff
		? `<div class="card"><p>Happy with this cut? Sign-off tells David you have no further comments. He decides what to act on and when it goes live.</p><button id="signoff">I'm happy with this cut</button></div>`
		: review.partnerApprovedBy
			? `<div class="card"><p>Signed off by ${esc(review.partnerApprovedBy)}.</p></div>`
			: "";
	const script = `
const R=${jsonForScript(review.id)};const v=document.querySelector('video');
const fmt=ms=>{const t=Math.floor(ms/1000);return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')};
const post=async(u,b)=>{const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});if(!r.ok){throw new Error((await r.json().catch(()=>({}))).error||'Something went wrong')}return r.json()};
document.querySelectorAll('[data-seek]').forEach(b=>b.addEventListener('click',()=>{v.currentTime=Number(b.dataset.seek)/1000;v.play()}));
const now=document.getElementById('now');if(now)v.addEventListener('timeupdate',()=>{now.textContent=fmt(v.currentTime*1000)});
const f=document.getElementById('new-comment');if(f)f.addEventListener('submit',async e=>{e.preventDefault();const err=document.getElementById('err');err.textContent='';try{await post('/api/reviews/'+R+'/comments',{body:document.getElementById('body').value,timestampMs:document.getElementById('pin').checked?Math.round(v.currentTime*1000):null});location.reload()}catch(x){err.textContent=x.message}});
document.querySelectorAll('[data-triage]').forEach(s=>s.addEventListener('change',async()=>{try{await post('/api/comments/'+s.dataset.triage+'/triage',{triage:s.value});}catch(x){alert(x.message)}}));
document.querySelectorAll('[data-withdraw]').forEach(b=>b.addEventListener('click',async()=>{try{await post('/api/comments/'+b.dataset.withdraw+'/triage',{triage:'withdrawn'});location.reload()}catch(x){alert(x.message)}}));
const so=document.getElementById('signoff');if(so)so.addEventListener('click',async()=>{try{await post('/api/reviews/'+R+'/signoff',{});location.reload()}catch(x){alert(x.message)}});`;
	return page(
		review.title,
		`${header(input.session, scope, input.orgs, input.preview)}<main><p><a href="/">Back</a></p><h1>${esc(review.title)}</h1><div class="row" style="margin-bottom:1rem"><span class="pill">${STATE_LABEL[review.state]}</span><span class="muted">Draft cut ${review.draftVersion}</span><span class="muted">Due ${esc(review.dueAt.slice(0, 10))}</span></div><div class="layout"><div><video controls preload="metadata" src="${esc(review.videoUrl)}"></video>${signoff}</div><div class="card"><h2>Comments (${comments.length})</h2>${commentHtml || `<p class="muted">No comments yet.</p>`}${form}</div></div></main>`,
		{ script, nonce: input.nonce },
	);
};
