<script lang="ts">
  import { buttonPrimaryMdClass, inputClass } from "@/lib/ui-classes";

  export let createName = "";
  export let createSlug = "";
  export let createDescription = "";
  export let createError: string | null = null;
  export let createPending = false;

  export let onNameInput: (value: string) => void = () => {};
  export let onSlugInput: (value: string) => void = () => {};
  export let onDescriptionInput: (value: string) => void = () => {};
  export let onCreate: () => void = () => {};
</script>

<section class="rkn-panel space-y-3 p-5">
  <h2 class="text-sm font-semibold text-foreground">Create optional tag</h2>

  <div class="grid gap-3 md:grid-cols-2">
    <div class="space-y-2">
      <label for="create-tag-name" class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Name
      </label>
      <input
        id="create-tag-name"
        value={createName}
        on:input={(event) => {
          const target = event.currentTarget;
          if (target instanceof HTMLInputElement) {
            onNameInput(target.value);
          }
        }}
        placeholder="Kubernetes"
        class={inputClass}
      />
    </div>

    <div class="space-y-2">
      <label for="create-tag-slug" class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Slug
      </label>
      <input
        id="create-tag-slug"
        value={createSlug}
        on:input={(event) => {
          const target = event.currentTarget;
          if (target instanceof HTMLInputElement) {
            onSlugInput(target.value);
          }
        }}
        placeholder="kubernetes"
        class={inputClass}
      />
      <p class="text-xs text-muted-foreground">Derived from name by default. You can edit it.</p>
    </div>
  </div>

  <div class="space-y-2">
    <label for="create-tag-description" class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      Description (optional)
    </label>
    <input
      id="create-tag-description"
      value={createDescription}
      on:input={(event) => {
        const target = event.currentTarget;
        if (target instanceof HTMLInputElement) {
          onDescriptionInput(target.value);
        }
      }}
      placeholder="Topics about Kubernetes and cluster operations"
      class={inputClass}
    />
  </div>

  {#if createError}
    <p class="text-sm text-destructive">{createError}</p>
  {/if}

  <button
    type="button"
    class={buttonPrimaryMdClass}
    disabled={createPending || !createName.trim()}
    on:click={onCreate}
  >
    {createPending ? "Creating..." : "Create tag"}
  </button>
</section>
