<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import {
  deletePersistedRecordingBackup,
  listRecordingBackups,
  readPersistedRecordingBackupBlob,
  type RecordingBackupSummary,
} from "../recording/recordingBackup";

const props = defineProps<{
  activeRecordingId?: string;
  refreshVersion?: number;
}>();

const backups = ref<RecordingBackupSummary[]>([]);
const busyRecordingId = ref("");
const errorMessage = ref("");
const statusMessage = ref("");

onMounted(refreshBackups);
watch(() => props.refreshVersion, refreshBackups);

async function refreshBackups(): Promise<void> {
  errorMessage.value = "";
  try {
    backups.value = await listRecordingBackups();
  } catch (error) {
    errorMessage.value = toErrorMessage(error);
  }
}

async function downloadBackup(backup: RecordingBackupSummary): Promise<void> {
  if (backup.id === props.activeRecordingId || busyRecordingId.value) {
    return;
  }
  busyRecordingId.value = backup.id;
  errorMessage.value = "";
  statusMessage.value = "";
  try {
    const blob = await readPersistedRecordingBackupBlob(backup.id);
    if (!blob) {
      throw new Error("This local recording backup has no recoverable chunks.");
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = backup.createdAt
      ? new Date(backup.createdAt).toISOString().replace(/[:.]/g, "-")
      : backup.id;
    link.download = `rawkode-studio-recovered-${timestamp}.webm`;
    link.href = url;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    statusMessage.value = "Recovery download started. The browser copy is still retained.";
  } catch (error) {
    errorMessage.value = toErrorMessage(error);
  } finally {
    busyRecordingId.value = "";
  }
}

async function deleteBackup(backup: RecordingBackupSummary): Promise<void> {
  if (
    backup.id === props.activeRecordingId ||
    busyRecordingId.value ||
    !window.confirm(
      "Delete this browser recording backup? Download and verify it first; this cannot be undone.",
    )
  ) {
    return;
  }
  busyRecordingId.value = backup.id;
  errorMessage.value = "";
  statusMessage.value = "";
  try {
    await deletePersistedRecordingBackup(backup.id);
    statusMessage.value = "Browser recording backup deleted.";
    await refreshBackups();
  } catch (error) {
    errorMessage.value = toErrorMessage(error);
  } finally {
    busyRecordingId.value = "";
  }
}

function formatCreatedAt(backup: RecordingBackupSummary): string {
  return backup.createdAt
    ? new Date(backup.createdAt).toLocaleString()
    : "Created before recovery metadata was available";
}

function formatSize(sizeBytes: number | null): string {
  if (sizeBytes === null) {
    return "size unknown";
  }
  if (sizeBytes < 1_024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1_048_576) {
    return `${(sizeBytes / 1_024).toFixed(1)} KiB`;
  }
  return `${(sizeBytes / 1_048_576).toFixed(1)} MiB`;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Local recording recovery failed.";
}
</script>

<template>
  <details class="recording-recovery">
    <summary>
      Local recording recovery
      <span v-if="backups.length">{{ backups.length }}</span>
    </summary>
    <div class="recording-recovery-body">
      <p>
        Incomplete handoffs stay in this browser. Download and verify a copy before deleting it.
      </p>
      <button class="secondary-button compact" type="button" @click="refreshBackups">
        Refresh
      </button>
      <p v-if="!backups.length && !errorMessage" class="recording-recovery-empty">
        No recoverable local recordings.
      </p>
      <ul v-else-if="backups.length">
        <li v-for="backup in backups" :key="backup.id">
          <div>
            <strong>{{ formatCreatedAt(backup) }}</strong>
            <span>
              {{ backup.chunkCount }} chunks · {{ formatSize(backup.sizeBytes) }}
              <template v-if="backup.id === activeRecordingId"> · recording now</template>
            </span>
          </div>
          <div class="recording-recovery-actions">
            <button
              class="secondary-button compact"
              type="button"
              :disabled="Boolean(busyRecordingId) || backup.id === activeRecordingId"
              @click="downloadBackup(backup)"
            >
              Download
            </button>
            <button
              class="secondary-button compact danger"
              type="button"
              :disabled="Boolean(busyRecordingId) || backup.id === activeRecordingId"
              @click="deleteBackup(backup)"
            >
              Delete local copy
            </button>
          </div>
        </li>
      </ul>
      <p v-if="statusMessage" class="recording-recovery-status" aria-live="polite">
        {{ statusMessage }}
      </p>
      <p v-if="errorMessage" class="recording-recovery-error" role="alert">
        {{ errorMessage }}
      </p>
    </div>
  </details>
</template>

<style scoped>
.recording-recovery {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(7, 10, 14, 0.78);
}

.recording-recovery summary {
  padding: 9px 12px;
  color: #b7c4ca;
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.recording-recovery summary span {
  display: inline-flex;
  min-width: 18px;
  margin-left: 6px;
  justify-content: center;
  padding: 1px 5px;
  border-radius: 999px;
  color: #07100f;
  background: #8ff3e9;
}

.recording-recovery-body {
  padding: 0 12px 12px;
}

.recording-recovery-body > p {
  margin: 0 0 9px;
  color: #91a2aa;
  font-size: 12px;
}

.recording-recovery ul {
  display: grid;
  gap: 7px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.recording-recovery li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.025);
}

.recording-recovery li strong,
.recording-recovery li span {
  display: block;
}

.recording-recovery li strong {
  color: #dce6e9;
  font-size: 12px;
}

.recording-recovery li span {
  margin-top: 2px;
  color: #84969e;
  font-size: 11px;
}

.recording-recovery-actions {
  display: flex;
  flex: none;
  gap: 6px;
}

.recording-recovery-actions .danger {
  color: #ffb0a4;
}

.recording-recovery-body .recording-recovery-empty {
  margin-top: 10px;
}

.recording-recovery-body .recording-recovery-status {
  margin-top: 9px;
  color: #8ff3e9;
}

.recording-recovery-body .recording-recovery-error {
  margin-top: 9px;
  color: #ffb0a4;
}

@media (max-width: 760px) {
  .recording-recovery li {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
