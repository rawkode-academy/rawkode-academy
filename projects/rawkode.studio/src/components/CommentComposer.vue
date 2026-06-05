<script setup lang="ts">
defineProps<{
  speaker: string;
  comment: string;
}>();

const emit = defineEmits<{
  "update:speaker": [value: string];
  "update:comment": [value: string];
  "show": [];
  "clear": [];
}>();

function onSpeakerInput(event: Event): void {
  emit("update:speaker", (event.target as HTMLInputElement).value);
}

function onCommentInput(event: Event): void {
  emit("update:comment", (event.target as HTMLTextAreaElement).value);
}
</script>

<template>
  <section class="panel-section comment-composer">
    <div class="panel-heading">
      <h2>Comment</h2>
      <button class="primary-button compact" type="button" @click="emit('show')">
        Show lower third
      </button>
    </div>

    <label>
      Speaker
      <input
        :value="speaker"
        maxlength="72"
        type="text"
        @input="onSpeakerInput"
      />
    </label>

    <label>
      Comment
      <textarea
        :value="comment"
        maxlength="180"
        spellcheck="true"
        @input="onCommentInput"
      />
    </label>

    <div class="comment-actions">
      <span>{{ comment.length }}/180</span>
      <button class="ghost-button" type="button" @click="emit('clear')">
        Clear
      </button>
    </div>
  </section>
</template>
