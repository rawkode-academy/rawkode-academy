<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { ApiError, requestJSON } from "../api";
import { createReviewId, isReviewId } from "../id";
import type { ReviewCustomer, UploadTarget } from "../types";

const maximumBytes = 64 * 1024 * 1024;
const sourceTypes = ["video/mp4", "video/quicktime", "video/webm"] as const;
const pendingKey = "rawkode-academy-review-upload";
type Metadata = { title: string; description: string; transcript: string; thumbnailId?: number; chapters: never[] };
type BeginInput = { action: "begin"; commandId: string; videoId: number; bytes: number; checksum: string; contentType: typeof sourceTypes[number]; metadata: Metadata };
type PendingUpload = { input: BeginInput; fingerprint: string; customerId: number; sessionId: string | null; shareCommandId: string; revisionId: string | null; stage: "begin" | "upload" | "process" | "share" };
// Before revision grants, saved uploads used grantCommandId and a "grant" stage.
type StoredUpload = Omit<PendingUpload, "shareCommandId" | "revisionId" | "stage"> & { shareCommandId?: string; grantCommandId?: string; revisionId?: string | null; stage: PendingUpload["stage"] | "grant" };
const shareDays = 30;
type SessionStatus = { sessionId: string; state: string; expiresAt: number; processingAvailable: boolean };

const emit = defineEmits<{ created: [videoId: number] }>();
const targets = ref<UploadTarget[]>([]), customers = ref<ReviewCustomer[]>([]);
const selectedVideoId = ref<number | null>(null), selectedCustomerId = ref<number | null>(null);
const title = ref(""), description = ref(""), search = ref(""), customerSearch = ref(""), file = ref<File | null>(null);
const thumbnail = ref<File | null>(null), thumbnailInput = ref<HTMLInputElement | null>(null);
const thumbnailTypes = ["image/jpeg", "image/png", "image/webp"];
const maximumThumbnailBytes = 5 * 1024 * 1024;
const newTargetTitle = ref(""), newTargetDescription = ref(""), creatingTarget = ref(false);
const pending = ref<PendingUpload | null>(null), sessionStatus = ref<SessionStatus | null>(null);
const loading = ref(true), busy = ref(false), error = ref(""), progress = ref("");
let mounted = true, optionsReady = false, optionsGeneration = 0, searchTimer: ReturnType<typeof setTimeout> | undefined;
const controller = new AbortController();

const visibleTargets = computed(() => {
  const needle = search.value.trim().toLowerCase();
  return needle ? targets.value.filter(item => [item.title, item.slug, item.legacyId].some(value => value.toLowerCase().includes(needle))) : targets.value;
});
const selectedTarget = computed(() => visibleTargets.value.find(item => item.videoId === selectedVideoId.value));
const visibleCustomers = computed(() => {
  const needle = customerSearch.value.trim().toLowerCase();
  return needle ? customers.value.filter(item => [item.name, item.profileEmail].some(value => value.toLowerCase().includes(needle))) : customers.value;
});
const resumable = computed(() => {
  const item = pending.value;
  return Boolean(item?.sessionId && item.customerId === selectedCustomerId.value && item.input.videoId === selectedVideoId.value && item.input.metadata.title === title.value.trim() && item.input.metadata.description === description.value.trim() && item.stage !== "upload");
});
const canSubmit = computed(() => Boolean(selectedTarget.value && selectedCustomerId.value && title.value.trim() && description.value.trim() && (file.value || resumable.value)) && !busy.value && !creatingTarget.value);

function api<T>(url: string, init?: RequestInit) { return requestJSON<T>(url, { ...init, signal: controller.signal }); }
function fingerprint(input: BeginInput) { return JSON.stringify({ videoId: input.videoId, bytes: input.bytes, checksum: input.checksum, contentType: input.contentType, metadata: input.metadata }); }
function savePending(value: PendingUpload | null) {
  pending.value = value;
  try { if (value) sessionStorage.setItem(pendingKey, JSON.stringify(value)); else sessionStorage.removeItem(pendingKey); } catch { /* Private browsing may not expose session storage. */ }
}
function restorePending() {
  try {
    const value = sessionStorage.getItem(pendingKey);
    if (value) {
      const { grantCommandId, ...stored } = JSON.parse(value) as StoredUpload;
      const input = {
        ...stored.input,
        commandId: isReviewId(stored.input.commandId) ? stored.input.commandId : createReviewId(),
      };
      const storedShareCommandId = stored.shareCommandId ?? grantCommandId;
      pending.value = {
        ...stored,
        input,
        shareCommandId: isReviewId(storedShareCommandId) ? storedShareCommandId : createReviewId(),
        revisionId: stored.revisionId ?? null,
        stage: stored.stage === "grant" ? "share" : stored.stage,
      };
      selectedVideoId.value = pending.value.input.videoId;
      selectedCustomerId.value = pending.value.customerId;
      title.value = pending.value.input.metadata.title;
      description.value = pending.value.input.metadata.description;
    }
  } catch { pending.value = null; }
}
async function loadOptions() {
  if (creatingTarget.value) return;
  const generation = ++optionsGeneration;
  const [videoResult, customerResult] = await Promise.all([
    api<{ videos: UploadTarget[] }>(`/api/review/upload-targets${search.value.trim() ? `?q=${encodeURIComponent(search.value.trim())}` : ""}`),
    api<{ reviewers: ReviewCustomer[] }>(`/api/review/reviewers${customerSearch.value.trim() ? `?q=${encodeURIComponent(customerSearch.value.trim())}` : ""}`),
  ]);
  if (!mounted || generation !== optionsGeneration) return;
  const selected = targets.value.find(item => item.videoId === selectedVideoId.value);
  targets.value = videoResult.videos;
  if (!search.value.trim() && selected && !targets.value.some(item => item.videoId === selected.videoId)) targets.value.unshift(selected);
  customers.value = customerResult.reviewers;
  if (!selectedVideoId.value || !visibleTargets.value.some(item => item.videoId === selectedVideoId.value)) {
    if (visibleTargets.value[0]) chooseVideo(visibleTargets.value[0].videoId);
    else { selectedVideoId.value = null; title.value = ""; description.value = ""; }
  }
  if (!selectedCustomerId.value || !visibleCustomers.value.some(item => item.userId === selectedCustomerId.value)) selectedCustomerId.value = visibleCustomers.value[0]?.userId ?? null;
}
async function load() {
  loading.value = true; error.value = "";
  try {
    restorePending();
    await loadOptions();
    const item = pending.value;
    if (item?.sessionId) sessionStatus.value = await api<SessionStatus>(`/api/review/uploads?sessionId=${encodeURIComponent(item.sessionId)}`);
  } catch (reason) { if (mounted) error.value = reason instanceof Error ? reason.message : "Could not load upload options."; }
  finally { if (mounted) { loading.value = false; optionsReady = true; } }
}
function scheduleOptions() {
  if (!optionsReady || creatingTarget.value || busy.value) return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { void loadOptions().catch(reason => { if (mounted) error.value = reason instanceof Error ? reason.message : "Could not search upload options."; }); }, 250);
}
watch(search, scheduleOptions);
watch(customerSearch, scheduleOptions);
function chooseVideo(videoId: number) {
  selectedVideoId.value = videoId;
  const target = targets.value.find(item => item.videoId === videoId);
  if (target) { title.value = target.title; description.value = target.description; }
}
function chooseVideoFromEvent(event: Event) { chooseVideo(Number((event.target as HTMLSelectElement).value)); }
async function createTarget() {
  if (creatingTarget.value || busy.value || pending.value || !newTargetTitle.value.trim() || !newTargetDescription.value.trim()) return;
  clearTimeout(searchTimer); ++optionsGeneration;
  creatingTarget.value = true; error.value = ""; progress.value = "Creating review video…";
  try {
    const result = await api<{ video: UploadTarget }>("/api/review/upload-targets", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: newTargetTitle.value.trim(), description: newTargetDescription.value.trim() }),
    });
    if (!mounted) return;
    targets.value = [result.video, ...targets.value.filter(item => item.videoId !== result.video.videoId)];
    search.value = ""; chooseVideo(result.video.videoId);
    await nextTick();
    newTargetTitle.value = ""; newTargetDescription.value = "";
    progress.value = "Video target created. Choose the source video below.";
  } catch (reason) { error.value = reason instanceof Error ? reason.message : "Could not create the video target."; progress.value = ""; }
  finally { creatingTarget.value = false; }
}
function resetThumbnail() { thumbnail.value = null; if (thumbnailInput.value) thumbnailInput.value.value = ""; }
function clearRetry() { savePending(null); resetThumbnail(); sessionStatus.value = null; progress.value = ""; error.value = ""; }
function chooseFile(event: Event) {
  const candidate = (event.target as HTMLInputElement).files?.[0] ?? null;
  file.value = candidate;
  if (!candidate) return;
  if (!(sourceTypes as readonly string[]).includes(candidate.type)) error.value = "Choose an MP4, QuickTime, or WebM video.";
  else if (candidate.size > maximumBytes) error.value = "The source video must be 64 MiB or smaller.";
  else error.value = "";
}
function chooseThumbnail(event: Event) {
  thumbnail.value = (event.target as HTMLInputElement).files?.[0] ?? null;
  if (thumbnail.value && (!thumbnailTypes.includes(thumbnail.value.type) || thumbnail.value.size > maximumThumbnailBytes)) error.value = "Choose a JPEG, PNG, or WebP thumbnail of 5 MiB or smaller.";
  else error.value = "";
}
function digest(bytes: ArrayBuffer) {
  return crypto.subtle.digest("SHA-256", bytes).then(value => Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, "0")).join(""));
}
function wait(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function process(sessionId: string) {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (!mounted) throw new DOMException("Upload panel was closed", "AbortError");
    const result = await api<{ state: string; revision?: { revisionId?: string } }>("/api/review/uploads", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "process", sessionId }),
    });
    if (result.revision) return result;
    progress.value = result.state === "processing" ? `Processing media… check ${attempt + 1}/90` : `Processing state: ${result.state}`;
    await wait(2000);
  }
  throw new Error("Processing is taking longer than this review session allows. The upload session was kept; retry to resume it.");
}
async function submit() {
  if (!canSubmit.value || !selectedVideoId.value || !selectedCustomerId.value) return;
  const source = file.value, image = thumbnail.value;
  const targetId = selectedVideoId.value, customerId = selectedCustomerId.value;
  const metadata: Metadata = { title: title.value.trim(), description: description.value.trim(), transcript: "", chapters: [], ...(pending.value?.input.metadata.thumbnailId ? { thumbnailId: pending.value.input.metadata.thumbnailId } : {}) };
  clearTimeout(searchTimer); ++optionsGeneration;
  busy.value = true; error.value = ""; progress.value = "Preparing upload…";
  try {
    let input: BeginInput;
    if (source) {
      if (!(sourceTypes as readonly string[]).includes(source.type) || source.size > maximumBytes) return;
      if (image && !pending.value) {
        if (!thumbnailTypes.includes(image.type) || image.size > maximumThumbnailBytes) throw new Error("Choose a JPEG, PNG, or WebP thumbnail of 5 MiB or smaller.");
        progress.value = "Uploading private thumbnail…";
        const uploaded = await api<{ thumbnailId: number }>(`/api/review/thumbnail?videoId=${targetId}`, {
          method: "POST", headers: { "content-type": image.type, "x-upload-length": String(image.size) }, body: image,
        });
        metadata.thumbnailId = uploaded.thumbnailId;
      }
      input = { action: "begin", commandId: pending.value?.input.commandId && isReviewId(pending.value.input.commandId) ? pending.value.input.commandId : createReviewId(), videoId: targetId, bytes: source.size, checksum: await digest(await source.arrayBuffer()), contentType: source.type as typeof sourceTypes[number], metadata };
      if (pending.value && pending.value.fingerprint !== fingerprint(input)) savePending(null);
    } else if (resumable.value && pending.value) input = pending.value.input;
    else return;
    let item = pending.value;
    if (!item) {
      item = { input, fingerprint: fingerprint(input), customerId, sessionId: null, shareCommandId: createReviewId(), revisionId: null, stage: "begin" };
      savePending(item);
    }
    if (!item.sessionId) {
      item.stage = "begin"; savePending(item);
      const begin = await api<{ sessionId: string }>("/api/review/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(item.input) });
      item.sessionId = begin.sessionId; item.stage = "upload"; savePending(item);
    }
    const status = await api<SessionStatus>(`/api/review/uploads?sessionId=${encodeURIComponent(item.sessionId)}`);
    sessionStatus.value = status;
    if (["pending", "uploaded"].includes(status.state)) {
      if (!source) throw new Error("Select the same source video to resume this upload.");
      progress.value = "Uploading source video…"; item.stage = "upload"; savePending(item);
      await api(`/api/review/uploads?sessionId=${encodeURIComponent(item.sessionId)}`, { method: "PUT", headers: { "content-type": source.type, "x-upload-length": String(source.size) }, body: source });
    }
    if (!item.revisionId) {
      progress.value = "Starting transcription and encoding…"; item.stage = "process"; savePending(item);
      // A resumed, already attached session replays create-revision and returns the same revision.
      let revisionId = (await process(item.sessionId)).revision?.revisionId;
      if (!revisionId) revisionId = (await process(item.sessionId)).revision?.revisionId;
      if (!revisionId) throw new Error("Processing finished without a revision. Retry to resume it.");
      item.revisionId ??= revisionId;
    }
    // A day count keeps a retry's body identical, so the service replays the saved command,
    // and the expiry comes from the server clock.
    progress.value = "Sharing this revision with the client…"; item.stage = "share"; savePending(item);
    await api("/api/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "share", videoId: item.input.videoId, revisionId: item.revisionId, commandId: item.shareCommandId, userId: item.customerId, canApprove: true, expiresInDays: shareDays }) });
    const videoId = item.input.videoId;
    savePending(null); sessionStatus.value = null; file.value = null; resetThumbnail(); progress.value = "Review created and shared.";
    await loadOptions();
    if (mounted) emit("created", videoId);
  } catch (reason) {
    if (!mounted) return;
    if (reason instanceof ApiError && reason.status === 503) error.value = "Media processing is not enabled in this preview yet.";
    else error.value = reason instanceof Error ? reason.message : "The upload failed.";
    progress.value = "";
  } finally { if (mounted) busy.value = false; }
}
onMounted(load);
onUnmounted(() => { mounted = false; controller.abort(); clearTimeout(searchTimer); });
</script>

<template>
  <details class="staff-upload" open>
    <summary>Upload a review cut</summary>
    <div class="staff-upload-body">
      <p class="muted">Upload the original cut, process it, and share the resulting revision with one Academy customer for {{ shareDays }} days. Later revisions stay hidden until you share them.</p>
      <p v-if="loading" role="status" class="muted">Loading upload options…</p>
      <template v-else>
        <details class="staff-upload-create" :open="!targets.length">
          <summary>Create a new review video</summary>
          <div class="staff-upload-create-body">
            <p class="muted">This creates a private draft first. The source file is uploaded and processed in the next step.</p>
            <label>Video title<input v-model="newTargetTitle" maxlength="300" required :disabled="creatingTarget || busy || Boolean(pending)" /></label>
            <label>Description<textarea v-model="newTargetDescription" maxlength="8000" rows="2" required :disabled="creatingTarget || busy || Boolean(pending)"></textarea></label>
            <button class="quiet" type="button" :disabled="creatingTarget || busy || Boolean(pending) || !newTargetTitle.trim() || !newTargetDescription.trim()" @click="createTarget">{{ creatingTarget ? "Creating target…" : "Create video target" }}</button>
          </div>
        </details>
        <label>Video target
          <input v-model="search" type="search" placeholder="Search videos" :disabled="creatingTarget || busy || Boolean(pending)" />
          <select :value="selectedVideoId ?? undefined" :disabled="creatingTarget || busy || Boolean(pending) || !visibleTargets.length" @change="chooseVideoFromEvent">
            <option v-for="item in visibleTargets" :key="item.videoId" :value="item.videoId">{{ item.title }} · {{ item.reviewState.replaceAll('-', ' ') }}</option>
          </select>
        </label>
        <label>Approving customer
          <input v-model="customerSearch" type="search" placeholder="Search customers" :disabled="creatingTarget || busy || Boolean(pending)" />
          <select v-model.number="selectedCustomerId" :disabled="creatingTarget || busy || Boolean(pending) || !visibleCustomers.length">
            <option v-for="customer in visibleCustomers" :key="customer.userId" :value="customer.userId">{{ customer.name }}{{ customer.profileEmail ? ` · ${customer.profileEmail}` : '' }}</option>
          </select>
        </label>
        <label>Review title<input v-model="title" maxlength="300" required :disabled="creatingTarget || busy || Boolean(pending)" /></label>
        <label>Description<textarea v-model="description" maxlength="8000" rows="3" required :disabled="creatingTarget || busy || Boolean(pending)"></textarea></label>
        <label>Source video<input type="file" accept="video/mp4,video/quicktime,video/webm" :required="!resumable" :disabled="creatingTarget || busy" @change="chooseFile" /></label>
        <label>Thumbnail (optional)<input ref="thumbnailInput" type="file" accept="image/jpeg,image/png,image/webp" :disabled="creatingTarget || busy || Boolean(pending)" @change="chooseThumbnail" /></label>
        <p class="muted">JPEG, PNG, or WebP, up to 5 MiB. The thumbnail stays private and belongs to this revision.</p>
        <p class="muted">Maximum 64 MiB. The original is retained privately; the client reviews a verified H.264 deliverable.</p>
        <p v-if="selectedTarget && selectedTarget.reviewState !== 'no-review'" class="review-banner">This creates a new revision for the selected video. Existing approval history is retained.</p>
        <p v-if="pending" class="review-banner">An unfinished upload is saved for retry{{ sessionStatus ? ` · ${sessionStatus.state}` : '' }}. <button class="quiet" :disabled="creatingTarget || busy" @click="clearRetry">Start a different review</button></p>
        <button class="primary" :disabled="!canSubmit" @click="submit">{{ busy ? progress || 'Working…' : pending ? 'Resume upload and assign review' : 'Upload and assign review' }}</button>
      </template>
      <p v-if="progress" role="status" class="review-banner">{{ progress }}</p>
      <p v-if="error" role="alert" class="review-error">{{ error }} <button class="quiet" :disabled="creatingTarget || busy" @click="submit">Retry</button> <button class="quiet" :disabled="creatingTarget || busy" @click="load">Reload options</button></p>
    </div>
  </details>
</template>
