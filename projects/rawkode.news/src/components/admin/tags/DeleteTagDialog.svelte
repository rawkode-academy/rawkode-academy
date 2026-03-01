<script lang="ts">
  import { tick } from "svelte";
  import type { ApiTag } from "@/lib/contracts";
  import { buttonDestructiveSmClass, buttonSecondarySmClass } from "@/lib/ui-classes";

  export let confirmTag: ApiTag | null = null;
  export let deletePending = false;

  export let onCancel: (tagId: string) => void = () => {};
  export let onConfirm: (tag: ApiTag) => void = () => {};

  let dialogElement: HTMLDivElement | null = null;
  let lastFocusedElement: HTMLElement | null = null;
  let previousDialogTagId: string | null = null;

  const getFocusableElements = () => {
    if (!dialogElement) {
      return [] as HTMLElement[];
    }

    return Array.from(
      dialogElement.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    );
  };

  const focusDialog = async () => {
    await tick();
    const focusables = getFocusableElements();
    const target = focusables[0] ?? dialogElement;
    target?.focus();
  };

  const restoreFocus = () => {
    if (typeof document === "undefined") {
      return;
    }
    if (lastFocusedElement && document.contains(lastFocusedElement)) {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (!confirmTag) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onCancel(confirmTag.id);
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusables = getFocusableElements();
    if (focusables.length === 0) {
      event.preventDefault();
      dialogElement?.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  $: activeDialogTagId = confirmTag?.id ?? null;

  $: if (activeDialogTagId && activeDialogTagId !== previousDialogTagId) {
    previousDialogTagId = activeDialogTagId;
    if (typeof document !== "undefined") {
      lastFocusedElement = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      void focusDialog();
    }
  }

  $: if (!activeDialogTagId && previousDialogTagId) {
    previousDialogTagId = null;
    restoreFocus();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if confirmTag}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div
      bind:this={dialogElement}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-tag-dialog-title"
      aria-describedby="delete-tag-dialog-description"
      tabindex="-1"
      class="w-full max-w-md rounded-md border border-border bg-card p-5 shadow-xl"
    >
      <h2 id="delete-tag-dialog-title" class="text-base font-semibold text-foreground">
        Delete this tag?
      </h2>
      <p id="delete-tag-dialog-description" class="mt-2 text-sm text-muted-foreground">
        Delete <span class="font-medium text-foreground">{confirmTag.name} ({confirmTag.slug})</span> permanently. This action cannot be undone.
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
          Keep tag
        </button>
        <button
          type="button"
          class={buttonDestructiveSmClass}
          disabled={deletePending}
          on:click={() => {
            onConfirm(confirmTag);
          }}
        >
          {deletePending ? "Deleting tag..." : "Delete permanently"}
        </button>
      </div>
    </div>
  </div>
{/if}
