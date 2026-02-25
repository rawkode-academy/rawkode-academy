<script lang="ts">
  import type { ApiTag } from "@/lib/contracts";
  import { buttonDestructiveSmClass, buttonSecondarySmClass } from "@/lib/ui-classes";

  export let confirmTag: ApiTag | null = null;
  export let deletePending = false;

  export let onCancel: (tagId: string) => void = () => {};
  export let onConfirm: (tag: ApiTag) => void = () => {};
</script>

{#if confirmTag}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-tag-dialog-title"
      class="w-full max-w-md rounded-md border border-border bg-card p-5 shadow-xl"
    >
      <h2 id="delete-tag-dialog-title" class="text-base font-semibold text-foreground">
        Delete tag?
      </h2>
      <p class="mt-2 text-sm text-muted-foreground">
        This will delete <span class="font-medium text-foreground">{confirmTag.name} ({confirmTag.slug})</span>. This cannot be undone.
      </p>
      <div class="mt-4 flex items-center justify-start gap-2">
        <button
          type="button"
          class={buttonSecondarySmClass}
          disabled={deletePending}
          on:click={() => {
            onCancel(confirmTag.id);
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          class={buttonDestructiveSmClass}
          disabled={deletePending}
          on:click={() => {
            onConfirm(confirmTag);
          }}
        >
          {deletePending ? "Deleting..." : "Delete tag"}
        </button>
      </div>
    </div>
  </div>
{/if}
