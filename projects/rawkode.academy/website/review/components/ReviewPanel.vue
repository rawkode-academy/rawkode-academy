<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { ApiError, requestJSON, timestamp } from "../api";
import type { Review, ReviewCustomer, Reviewer } from "../types";

let active = true;
onUnmounted(() => { active = false; });
const props = defineProps<{ review: Review; user: Reviewer }>();
const emit = defineEmits<{ updated: [review: Review]; denied: [reason: unknown] }>();
// For a customer the service reports their newest shared cut as current.
const initial = (review: Review) => review.currentRevisionId ?? review.revisions.at(-1)?.id ?? null;
const selected = ref(initial(props.review));
const video = ref<HTMLVideoElement | null>(null);
const body = ref(""), note = ref(""), seconds = ref(0);
const busy = ref(false), error = ref(""), notice = ref(""), mediaError = ref(false);
const confirmation = ref<"approve" | "publish" | null>(null);
const retry = ref<Record<string, unknown> | null>(null);
const revision = computed(() => props.review.revisions.find(item => item.id === selected.value));
const current = computed(() => revision.value?.id === initial(props.review));
const final = computed(() => ["approved", "published"].includes(revision.value?.state ?? ""));
const comments = computed(() => props.review.comments.filter(item => item.revisionId === selected.value));
const unresolved = computed(() => comments.value.filter(item => !item.resolved).length);
const decisions = computed(() => props.review.decisions.filter(item => item.revisionId === selected.value));
const approval = computed(() => decisions.value.find(item => item.decision === "approved" && item.reviewVersion === revision.value?.reviewVersion));
const disabled = computed(() => busy.value || !!retry.value);
const maximumShareDays = 90;
const customers = ref<ReviewCustomer[]>([]), shareCustomerId = ref<number | null>(null), shareApprover = ref(true), shareDays = ref(30);
const grants = computed(() => (props.review.grants ?? []).filter(item => item.revisionId === selected.value));
const exportUrl = computed(() => `/api/review/feedback-export?videoId=${props.review.videoId}&revisionId=${encodeURIComponent(selected.value ?? "")}`);
function day(value: string) { return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
function customerName(userId: number) { return customers.value.find(item => item.userId === userId)?.name || `Customer ${userId}`; }
function grantStatus(grant: NonNullable<Review["grants"]>[number]) { return grant.revokedAt ? "Revoked" : Date.parse(grant.expiresAt) <= Date.now() ? "Expired" : `Until ${day(grant.expiresAt)}`; }
onMounted(async () => {
  if (props.user.role !== "staff") return;
  try {
    const result = await requestJSON<{ reviewers: ReviewCustomer[] }>("/api/review/reviewers");
    if (!active) return;
    customers.value = result.reviewers; shareCustomerId.value ??= result.reviewers[0]?.userId ?? null;
  } catch { /* Sharing stays unavailable; the review itself still works. */ }
});
function share() {
  if (!revision.value || !shareCustomerId.value) return;
  const days = Math.min(Math.max(Math.round(shareDays.value), 1), maximumShareDays);
  // The server sets the expiry from its own clock, so browser clock skew cannot exceed the limit.
  void execute({ action: "share", revisionId: revision.value.id, userId: shareCustomerId.value, canApprove: shareApprover.value, expiresInDays: days });
}
watch(() => props.review.currentRevisionId, () => { selected.value = initial(props.review); confirmation.value = null; });
watch(() => revision.value?.reviewVersion, () => { confirmation.value = null; });
watch(selected, () => { confirmation.value = null; mediaError.value = false; seconds.value = 0; body.value = ""; note.value = ""; });
function moment() { seconds.value = Math.min(Math.floor((video.value?.currentTime ?? 0) * 1000), (revision.value?.durationMs ?? 1) - 1) / 1000; }
function seek(ms: number) { if (video.value) video.value.currentTime = ms / 1000; }
function decisionFields() { return { revisionId: revision.value!.id, expectedReviewVersion: revision.value!.reviewVersion }; }
async function refresh() {
  const updated = await requestJSON<Review>(`/api/review?videoId=${props.review.videoId}`);
  if (active) emit("updated", updated);
}
async function execute(fields: Record<string, unknown>, replay = false) {
  if (busy.value) return;
  const command = replay ? fields : { ...fields, videoId: props.review.videoId, commandId: crypto.randomUUID() };
  busy.value = true; error.value = ""; notice.value = ""; confirmation.value = null;
  try {
    await requestJSON("/api/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command) });
    retry.value = null;
    if (command.action === "comment") body.value = "";
    note.value = "";
    await refresh();
    notice.value = command.action === "publish" ? "This revision is now published." : command.action === "share" ? "This revision is shared." : command.action === "revoke" ? "Access to this revision was revoked." : command.action === "decide" && command.decision === "approved" ? "Approval recorded. The team will handle publication separately." : "Your feedback has been saved.";
  } catch (reason) {
    if (!active) return;
    if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) { retry.value = null; emit("denied", reason); }
    else if (reason instanceof ApiError && reason.status === 409) {
      retry.value = null;
      try { await refresh(); } catch (refreshError) { emit("denied", refreshError); }
      error.value = "This review changed. The latest version is loaded; check it before acting again.";
    } else {
      // A lost response may follow a committed command. Retry the exact UUID/body.
      if (!(reason instanceof ApiError) || reason.status >= 500) retry.value = command;
      error.value = reason instanceof Error ? reason.message : "The request failed.";
    }
  } finally { busy.value = false; }
}
function addComment() {
  if (!revision.value || !body.value.trim()) return;
  void execute({ action: "comment", revisionId: revision.value.id, startMs: Math.round(seconds.value * 1000), body: body.value });
}
function confirm() {
  if (!revision.value) return;
  if (confirmation.value === "approve") void execute({ action: "decide", ...decisionFields(), decision: "approved" });
  else if (confirmation.value === "publish" && approval.value) void execute({ action: "publish", ...decisionFields(), decisionId: approval.value.id });
}
</script>

<template>
  <article v-if="revision">
    <header class="review-title">
      <div><p class="eyebrow">{{ current ? "Current revision" : "Previous revision" }} · {{ revision.state.replaceAll('-', ' ') }}</p><h2>{{ revision.metadata.title }}</h2></div>
      <label class="review-select">Revision
        <select v-model="selected" :disabled="disabled">
          <option v-for="(item, index) in review.revisions" :key="item.id" :value="item.id">Revision {{ index + 1 }} · version {{ item.reviewVersion }}{{ item.id === review.currentRevisionId ? ' · current' : '' }}</option>
        </select>
      </label>
    </header>
    <video :key="revision.id" ref="video" :src="revision.mediaUrl" :poster="revision.thumbnailUrl" controls playsinline preload="metadata" aria-label="Private review video" @error="mediaError = true"></video>
    <p v-if="mediaError" role="alert" class="review-error">Playback is unavailable. Refresh the review to check your access. <button class="quiet" @click="refresh().catch(reason => emit('denied', reason))">Refresh review</button></p>
    <p class="review-description">{{ revision.metadata.description }}</p>
    <p class="revision-reference">Revision {{ revision.id }} · version {{ revision.reviewVersion }}</p>
    <p v-if="user.role === 'customer' && revision.expiresAt" class="muted">Access until {{ day(revision.expiresAt) }}</p>
    <p v-if="!current" class="review-banner">You are viewing an earlier cut. Feedback stays attached to this revision; approval is available on the current cut.</p>
    <div v-if="error" role="alert" class="review-error">{{ error }} <button v-if="retry" :disabled="busy" @click="execute(retry!, true)">Retry last action</button></div>
    <p v-if="notice" role="status" class="review-banner">{{ notice }}</p>
    <div class="review-feedback-grid">
      <section aria-labelledby="feedback-title">
        <div class="section-heading"><h3 id="feedback-title">Feedback</h3><span class="muted">{{ unresolved }} open · <a :href="exportUrl" download>Export feedback (CSV)</a></span></div>
        <form class="review-comment-form" @submit.prevent="addComment">
          <label for="comment-body">Leave a timestamped comment</label>
          <textarea id="comment-body" v-model="body" maxlength="8000" required rows="3" :disabled="disabled" placeholder="What needs attention at this moment?"></textarea>
          <div class="review-comment-actions">
            <label>Time (seconds)<input v-model.number="seconds" type="number" step="0.001" min="0" :max="(revision.durationMs - 1) / 1000" required :disabled="disabled" /></label>
            <button type="button" class="quiet" :disabled="disabled" @click="moment">Use player time</button>
            <button class="primary" :disabled="disabled || !body.trim()">Add comment</button>
          </div>
        </form>
        <p v-if="!comments.length" class="muted">No comments on this revision yet.</p>
        <ul class="review-comments">
          <li v-for="comment in comments" :key="comment.id" :class="{ resolved: comment.resolved }">
            <div class="comment-meta"><button class="timestamp" :aria-label="`Jump to ${timestamp(comment.startMs)}`" @click="seek(comment.startMs)">{{ timestamp(comment.startMs) }}</button><span>{{ comment.authorId === user.id ? "You" : user.role === "customer" ? "Academy team" : "Reviewer" }}</span><span v-if="comment.resolved" class="status-pill">Resolved</span></div>
            <p class="comment-body">{{ comment.body }}</p>
            <button v-if="user.role === 'staff' || comment.authorId === user.id" class="quiet" :disabled="disabled" @click="execute({ action: 'resolve-comment', commentId: comment.id, resolved: !comment.resolved })">{{ comment.resolved ? "Reopen comment" : "Resolve comment" }}</button>
          </li>
        </ul>
      </section>
      <aside class="review-decision" aria-labelledby="decision-title">
        <p class="eyebrow">Next step</p><h3 id="decision-title">{{ revision.state === "published" ? "Published" : final ? "Approval recorded" : "Ready to sign off?" }}</h3>
        <p v-if="revision.state === 'published'">This exact revision has been published by the team.</p>
        <p v-else-if="final">This revision is approved and cannot be edited. Publication is a separate staff action.</p>
        <template v-if="current && !final && revision.canApprove && review.canApprove">
          <p>Approve only when you are happy with this cut. A later edit will need a new revision and approval.</p>
          <button class="primary" :disabled="disabled" @click="confirmation = 'approve'">Approve this revision</button>
          <form @submit.prevent="execute({ action: 'decide', ...decisionFields(), decision: 'changes-requested', note })">
            <label for="change-note">What needs to change?</label>
            <textarea id="change-note" v-model="note" maxlength="8000" required rows="3" :disabled="disabled"></textarea>
            <button :disabled="disabled || !note.trim()">Request changes</button>
          </form>
        </template>
        <p v-else-if="!final && user.role === 'customer'">{{ !current ? "Choose the current revision to sign off." : revision.canApprove ? "Sign-off is not open on this cut. You can still leave feedback." : "You can leave feedback. An assigned approver will sign off on this cut." }}</p>
        <template v-if="current && user.role === 'staff' && revision.state === 'approved'">
          <p v-if="!review.publicationAvailable" class="review-banner">Publication is unavailable on this preview until trusted media verification is connected. The client approval is saved.</p>
          <p v-else-if="unresolved">Resolve the {{ unresolved }} open comments before publication.</p>
          <button class="primary" :disabled="disabled || !review.publicationAvailable || unresolved > 0 || !approval" @click="confirmation = 'publish'">Publish approved revision</button>
        </template>
        <p v-else-if="user.role === 'staff' && !final">Waiting for approval from the assigned client.</p>
        <div v-if="confirmation" class="review-confirm" role="group" aria-label="Confirm revision action">
          <h4>{{ confirmation === 'approve' ? "Confirm approval" : "Confirm publication" }}</h4>
          <p>{{ revision.metadata.title }} · version {{ revision.reviewVersion }}</p>
          <p class="revision-reference">{{ revision.id }}</p>
          <p>{{ confirmation === 'approve' ? "Your approval applies to this exact revision and is final." : "The approved video and metadata will become public." }}</p>
          <button class="primary" :disabled="disabled" @click="confirm">{{ confirmation === 'approve' ? "Confirm approval" : "Confirm publication" }}</button>
          <button class="quiet" :disabled="disabled" @click="confirmation = null">Cancel</button>
        </div>
        <div v-for="decision in decisions" :key="decision.id" class="decision-history"><strong>{{ decision.decision === 'approved' ? 'Approved' : 'Changes requested' }} · v{{ decision.reviewVersion }}</strong><p class="comment-body">{{ decision.note }}</p></div>
        <section v-if="user.role === 'staff'" class="review-access" aria-labelledby="access-title">
          <h3 id="access-title">Client access</h3>
          <p class="muted">Each revision is shared separately. Clients cannot see a new cut until you share it.</p>
          <ul v-if="grants.length" class="review-grants">
            <li v-for="grant in grants" :key="grant.userId">
              <span>{{ customerName(grant.userId) }}<template v-if="grant.canApprove"> · approver</template></span>
              <span class="status-pill">{{ grantStatus(grant) }}</span>
              <button v-if="!grant.revokedAt" class="quiet" :disabled="disabled" @click="execute({ action: 'revoke', userId: grant.userId, revisionId: grant.revisionId })">Revoke</button>
            </li>
          </ul>
          <p v-else class="muted">Not shared with any client yet.</p>
          <form class="review-share" @submit.prevent="share">
            <label>Client<select v-model.number="shareCustomerId" :disabled="disabled || !customers.length" required>
              <option v-for="customer in customers" :key="customer.userId" :value="customer.userId">{{ customer.name }}{{ customer.profileEmail ? ` · ${customer.profileEmail}` : '' }}</option>
            </select></label>
            <label class="review-checkbox"><input v-model="shareApprover" type="checkbox" :disabled="disabled" /> Can approve this revision</label>
            <label>Access for (days)<input v-model.number="shareDays" type="number" min="1" :max="maximumShareDays" step="1" required :disabled="disabled" /></label>
            <button class="primary" :disabled="disabled || !shareCustomerId">Share this revision</button>
          </form>
        </section>
      </aside>
    </div>
  </article>
  <div v-else class="review-empty"><h2>No revision ready yet</h2><p class="muted">You have access to this video. The team will share a cut here when it is ready for feedback.</p></div>
</template>
