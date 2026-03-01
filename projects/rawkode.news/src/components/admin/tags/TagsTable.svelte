<script lang="ts">
  import type { ApiTag } from "@/lib/contracts";
  import {
    buttonDestructiveSmClass,
    buttonGhostSmClass,
    buttonPrimarySmClass,
    buttonSecondarySmClass,
    inputClass,
  } from "@/lib/ui-classes";
  import {
    TAG_DESCRIPTION_MAX_LENGTH,
    TAG_NAME_MAX_LENGTH,
    TAG_SLUG_MAX_LENGTH,
  } from "@/lib/input-limits";
  import type { EditState, PageItem } from "@/components/admin/tags/shared";
  import { getTagDisplayName, rowAnchor } from "@/components/admin/tags/shared";

  export let tags: ApiTag[] = [];
  export let pagedTags: ApiTag[] = [];
  export let editing: EditState | null = null;
  export let editError: string | null = null;
  export let updatePending = false;
  export let deleteError: string | null = null;
  export let blockedConfirmTag: ApiTag | null = null;
  export let currentPage = 1;
  export let totalPages = 1;
  export let pageItems: PageItem[] = [];

  export let onEditNameInput: (value: string) => void = () => {};
  export let onEditSlugInput: (value: string) => void = () => {};
  export let onEditDescriptionInput: (value: string) => void = () => {};
  export let onSaveEdit: () => void = () => {};
  export let onCancelEdit: (tagId: string) => void = () => {};
  export let onOpenEdit: (tag: ApiTag) => void = () => {};
  export let onOpenConfirm: (tag: ApiTag) => void = () => {};
  export let onSetPage: (nextPage: number) => void = () => {};
</script>

<section class="mt-2 space-y-3">
  <header class="space-y-1">
    <h2 class="font-display text-lg font-semibold">Tags</h2>
    <p class="text-sm text-muted-foreground">{tags.length} total tags</p>
  </header>

  <div class="overflow-hidden border-y border-border/75">
    <div class="overflow-x-auto">
      <table class="min-w-full border-collapse text-sm">
        <thead class="border-b border-border/70 bg-muted/30">
          <tr>
            <th class="px-5 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase" style="text-align: start">Name</th>
            <th class="px-5 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase" style="text-align: start">Slug</th>
            <th class="px-5 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase" style="text-align: start">Kind</th>
            <th class="px-5 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase" style="text-align: start">Posts</th>
            <th class="px-5 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase" style="text-align: start">Description</th>
            <th class="px-5 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase" style="text-align: start">Actions</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-border/70">
          {#each pagedTags as tag (tag.id)}
            {@const isCore = tag.kind === "mandatory"}
            {@const canDelete = !isCore && (tag.usageCount ?? 0) === 0}
            {@const isEditing = editing?.id === tag.id}

            {#if isEditing && editing}
              <tr id={rowAnchor(tag.id)} class="align-top">
                <td class="px-5 py-3">
                  <input
                    value={editing.name}
                    maxlength={TAG_NAME_MAX_LENGTH}
                    aria-label={`Tag name for ${tag.slug}`}
                    on:input={(event) => {
                      const target = event.currentTarget;
                      if (target instanceof HTMLInputElement) {
                        onEditNameInput(target.value);
                      }
                    }}
                    required
                    placeholder="Tag name"
                    class={inputClass}
                  />
                </td>

                <td class="px-5 py-3">
                  <input
                    value={editing.slug}
                    maxlength={TAG_SLUG_MAX_LENGTH}
                    aria-label={`Tag slug for ${tag.slug}`}
                    on:input={(event) => {
                      const target = event.currentTarget;
                      if (target instanceof HTMLInputElement) {
                        onEditSlugInput(target.value);
                      }
                    }}
                    placeholder="tag-slug"
                    class={inputClass}
                  />
                </td>

                <td class="px-5 py-3 text-muted-foreground">{tag.kind}</td>
                <td class="px-5 py-3 text-muted-foreground">{tag.usageCount ?? 0}</td>

                <td class="min-w-[260px] px-5 py-3">
                  <input
                    value={editing.description}
                    maxlength={TAG_DESCRIPTION_MAX_LENGTH}
                    aria-label={`Tag description for ${tag.slug}`}
                    on:input={(event) => {
                      const target = event.currentTarget;
                      if (target instanceof HTMLInputElement) {
                        onEditDescriptionInput(target.value);
                      }
                    }}
                    placeholder="Optional description"
                    class={inputClass}
                  />
                </td>

                <td class="px-5 py-3">
                  <div class="flex items-center gap-2 whitespace-nowrap">
                    <button
                      type="button"
                      class={buttonPrimarySmClass}
                      disabled={updatePending || !editing.name.trim() || !editing.slug.trim()}
                      on:click={onSaveEdit}
                    >
                      {updatePending ? "Saving..." : "Save changes"}
                    </button>

                    <button
                      type="button"
                      class={buttonSecondarySmClass}
                      on:click={() => {
                        onCancelEdit(tag.id);
                      }}
                    >
                      Cancel
                    </button>
                  </div>

                  {#if editError}
                    <p role="alert" class="mt-2 text-sm text-destructive">{editError}</p>
                  {/if}
                </td>
              </tr>
            {:else}
              <tr id={rowAnchor(tag.id)} class="align-top">
                <td class="px-5 py-3 font-semibold text-foreground">{getTagDisplayName(tag)}</td>
                <td class="px-5 py-3 font-mono text-xs text-muted-foreground">{tag.slug}</td>
                <td class="px-5 py-3">
                  <span class="rounded-none border border-border bg-muted px-2 py-0.5 text-[11px] tracking-wide text-muted-foreground uppercase">
                    {tag.kind}
                  </span>
                </td>
                <td class="px-5 py-3 text-muted-foreground">{tag.usageCount ?? 0}</td>
                <td class="px-5 py-3 text-muted-foreground">{tag.description || "No description yet."}</td>
                <td class="px-5 py-3">
                  <div class="flex items-center gap-2 whitespace-nowrap">
                    {#if !isCore}
                      <button
                        type="button"
                        class={buttonSecondarySmClass}
                        on:click={() => {
                          onOpenEdit(tag);
                        }}
                      >
                        Edit
                      </button>

                      {#if canDelete}
                        <button
                          type="button"
                          class={buttonDestructiveSmClass}
                          on:click={() => {
                            onOpenConfirm(tag);
                          }}
                        >
                          Delete
                        </button>
                      {:else}
                        <button
                          type="button"
                          disabled
                          title="Can't delete while posts still reference this tag"
                          class={buttonDestructiveSmClass}
                        >
                          Delete
                        </button>
                      {/if}
                    {:else}
                      <span class="text-xs text-muted-foreground">Core tags can't be edited or deleted.</span>
                    {/if}
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>

    <div class="px-5 pb-3">
      {#if totalPages > 1}
        <nav
          aria-label="Pagination"
          class="flex flex-wrap items-center justify-between gap-3 border-t border-border/75 px-1 pt-3 text-xs text-muted-foreground"
        >
          <div class="flex flex-wrap items-center gap-1.5">
            {#if currentPage <= 1}
              <span class="inline-flex h-9 cursor-default items-center rounded-none px-3 text-[0.83rem] font-semibold text-muted-foreground">Previous</span>
            {:else}
              <button
                type="button"
                class={buttonGhostSmClass}
                on:click={() => onSetPage(currentPage - 1)}
              >
                Previous
              </button>
            {/if}

            {#each pageItems as item}
              {#if typeof item !== "number"}
                <span aria-hidden="true" class="px-1 text-muted-foreground/75">…</span>
              {:else if item === currentPage}
                <span aria-current="page" class="inline-flex h-9 items-center rounded-none bg-secondary px-3 text-[0.83rem] font-semibold text-foreground">
                  {item}
                </span>
              {:else}
                <button
                  type="button"
                  class={buttonGhostSmClass}
                  on:click={() => onSetPage(item)}
                >
                  {item}
                </button>
              {/if}
            {/each}

            {#if currentPage >= totalPages}
              <span class="inline-flex h-9 cursor-default items-center rounded-none px-3 text-[0.83rem] font-semibold text-muted-foreground">Next</span>
            {:else}
              <button
                type="button"
                class={buttonGhostSmClass}
                on:click={() => onSetPage(currentPage + 1)}
              >
                Next
              </button>
            {/if}
          </div>

          <span>
            Page {currentPage} of {totalPages}
          </span>
        </nav>
      {/if}
    </div>
  </div>

  {#if deleteError}
    <p role="alert" class="px-5 py-4 text-sm text-destructive">{deleteError}</p>
  {/if}

  {#if blockedConfirmTag}
    <p role="alert" class="px-5 py-4 text-sm text-destructive">
      "{blockedConfirmTag.name}" is used by {blockedConfirmTag.usageCount} posts. Remove it from those posts before deleting this tag.
    </p>
  {/if}
</section>
