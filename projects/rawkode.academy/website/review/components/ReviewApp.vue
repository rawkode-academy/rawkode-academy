<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ApiError, requestJSON } from "../api";
import type { Review, ReviewItem, Reviewer, ReviewList } from "../types";
import ReviewPanel from "./ReviewPanel.vue";
import StaffUploadPanel from "./StaffUploadPanel.vue";
import "../review.css";

const user = ref<Reviewer | null>(null);
const loading = ref(true), loadingVideo = ref(false), loadingMore = ref(false), error = ref("");
const videos = ref<ReviewItem[]>([]), nextCursor = ref<number | null>(null);
const review = ref<Review | null>(null), routeVideoId = ref<number | null>(null);
let generation = 0;
const signInUrl = computed(() => `/api/auth/login?returnTo=${encodeURIComponent(routeVideoId.value ? `/review?videoId=${routeVideoId.value}` : "/review")}`);
function clearPrivateData() { user.value = null; review.value = null; videos.value = []; nextCursor.value = null; loadingVideo.value = false; loadingMore.value = false; }
function failure(reason: unknown) {
  if (reason instanceof ApiError && reason.status === 401) { generation++; clearPrivateData(); loading.value = false; }
  // Expired, revoked and unshared reviews are a uniform 404 by design.
  if (reason instanceof ApiError && reason.status === 404) error.value = "This review is not available to you. Access to each cut is time-limited; ask the Rawkode Academy team to share it again if you still need it.";
  else error.value = reason instanceof Error ? reason.message : "Unable to load your reviews.";
}
function currentRoute() {
  const id = new URLSearchParams(window.location.search).get("videoId");
  return id && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)) ? Number(id) : null;
}
async function list(token: number, more = false) {
  const result = await requestJSON<ReviewList>(`/api/review${more && nextCursor.value ? `?after=${nextCursor.value}` : ""}`);
  if (token !== generation) return;
  videos.value = more ? [...videos.value, ...result.items] : result.items;
  nextCursor.value = result.nextCursor;
}
async function more() {
  if (loadingMore.value) return;
  const token = generation; loadingMore.value = true;
  try { await list(token, true); } catch (reason) { if (token === generation) failure(reason); }
  finally { if (token === generation) loadingMore.value = false; }
}
async function select(videoId: number) {
  const token = ++generation;
  routeVideoId.value = videoId; loadingVideo.value = true; review.value = null; error.value = ""; loadingMore.value = false;
  window.history.pushState(null, "", `/review?videoId=${videoId}`);
  try {
    const result = await requestJSON<Review>(`/api/review?videoId=${videoId}`);
    if (token === generation) review.value = result;
  } catch (reason) { if (token === generation) failure(reason); }
  finally { if (token === generation) loadingVideo.value = false; }
}
async function load(clear = true) {
  const token = ++generation;
  routeVideoId.value = currentRoute(); error.value = "";
  if (clear) { clearPrivateData(); loading.value = true; }
  try {
    const session = await requestJSON<{ user: Reviewer }>("/api/auth/session");
    if (token !== generation) return;
    if (user.value?.id !== session.user.id) clearPrivateData();
    user.value = session.user;
    await list(token);
    if (token !== generation) return;
    if (routeVideoId.value) {
      const result = await requestJSON<Review>(`/api/review?videoId=${routeVideoId.value}`);
      if (token === generation) review.value = result;
    } else review.value = null;
  } catch (reason) {
    if (token !== generation) return;
    review.value = null;
    if (reason instanceof ApiError && reason.status === 401) { clearPrivateData(); }
    else failure(reason);
  } finally { if (token === generation) { loading.value = false; loadingVideo.value = false; loadingMore.value = false; } }
}
function start() { void load(); }
async function logout() {
  const token = ++generation;
  clearPrivateData(); loading.value = false; error.value = "";
  try { await requestJSON("/api/auth/logout", { method: "POST" }); }
  catch (reason) { if (token === generation) error.value = "Sign-out could not be confirmed. Sign in again, then retry signing out."; }
}
async function updated(value: Review) {
  if (value.videoId !== routeVideoId.value || value.viewerId !== user.value?.id) return;
  const token = ++generation; review.value = value; loadingVideo.value = false; loadingMore.value = false;
  try { await list(token); } catch (reason) { if (token === generation) failure(reason); }
}
function denied(reason: unknown) { generation++; review.value = null; failure(reason); }
function revalidate() { if (user.value && document.visibilityState !== "hidden") void load(false); }
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  start(); window.addEventListener("popstate", start); window.addEventListener("focus", revalidate);
  timer = setInterval(revalidate, 60000);
});
onUnmounted(() => {
  generation++; clearInterval(timer); window.removeEventListener("popstate", start); window.removeEventListener("focus", revalidate);
});
</script>

<template>
  <div class="review-shell">
    <header class="review-header">
      <a class="review-brand" href="/review">RAWKODE <span>ACADEMY</span></a>
      <div v-if="user" class="review-account"><span>{{ user.name || "Academy account" }}</span><button class="quiet" @click="logout">Sign out</button></div>
      <span v-else class="eyebrow">Private review room</span>
    </header>
    <main>
      <p v-if="loading" role="status" class="review-empty">Loading your reviews…</p>
      <div v-else-if="!user" class="review-welcome">
        <p class="eyebrow">Your next cut, together</p>
        <h1>A place to get<br />every detail right.</h1>
        <p>Watch your private videos, leave feedback at the right moment, and approve a revision when it is ready.</p>
        <a class="button primary" :href="signInUrl">Sign in with Academy <span aria-hidden="true">→</span></a>
        <p class="muted">Use the Academy account invited to review your videos.</p>
      </div>
      <div v-else class="review-workspace">
        <aside class="review-library" aria-label="Your videos">
          <p class="eyebrow">{{ user.role === "staff" ? "Publication desk" : "Shared with you" }}</p>
          <h1>{{ user.role === "staff" ? "Video reviews" : "Your reviews" }}</h1>
          <StaffUploadPanel v-if="user.role === 'staff'" @created="videoId => select(videoId)" />
          <p v-if="!videos.length" class="muted">No videos have been shared with you yet.</p>
          <ul class="review-video-list">
            <li v-for="video in videos" :key="video.videoId">
              <button :aria-current="review?.videoId === video.videoId ? 'page' : undefined" @click="select(video.videoId)">
                <strong>{{ video.title }}</strong><span class="status-pill">{{ video.state.replaceAll('-', ' ') }}</span>
              </button>
            </li>
          </ul>
          <button v-if="nextCursor" class="quiet" :disabled="loadingMore" @click="more">Load more videos</button>
        </aside>
        <section class="review-content" aria-label="Video review">
          <p v-if="loadingVideo" role="status" class="review-empty">Opening this review…</p>
          <ReviewPanel v-else-if="review" :key="review.videoId" :review="review" :user="user" @updated="updated" @denied="denied" />
          <div v-else class="review-empty"><h2>Select a video to begin</h2><p class="muted">Every comment stays with the revision you reviewed.</p></div>
        </section>
      </div>
      <div v-if="error" role="alert" class="review-error">{{ error }} <button class="quiet" @click="start">Try again</button></div>
    </main>
    <footer class="review-footer">Private feedback. A clear approval. Then publication.</footer>
  </div>
</template>
