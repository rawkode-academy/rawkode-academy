<script lang="ts">
  import Icon from "@iconify/svelte";
  interface Breadcrumb {
    title: string;
    href: string;
  }

  export let title: string;
  export let breadcrumbs: Breadcrumb[];
</script>

<div class="bg-white flex" aria-label="Breadcrumb">
  <ol class="w-full px-4 flex space-x-4 sm:px-6 lg:px-8">
    <li class="flex">
      <div class="flex items-center">
        <a href="/" class="text-gray-400 hover:text-gray-500">
          <Icon icon="mdi:home" class="w-7 h-7" />
          <span class="sr-only">Home</span>
        </a>
      </div>
    </li>

    <!-- this causes an HMR error? -->
    {#each breadcrumbs as breadcrumb}
      <li class="flex">
        <div class="flex items-center">
          <svg
            class="flex-shrink-0 w-6 h-full text-gray-200"
            viewBox="0 0 24 44"
            preserveAspectRatio="none"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M.293 0l22 22-22 22h1.414l22-22-22-22H.293z" />
          </svg>
          <a
            href={breadcrumb.href}
            class="ml-4 text-sm font-medium text-gray-500 hover:text-gray-700"
            >{breadcrumb.title}</a
          >
        </div>
      </li>
    {/each}

    <li class="flex flex-grow">
      <div class="flex items-center">
        <svg
          class="flex-shrink-0 w-6 h-full text-gray-200"
          viewBox="0 0 24 44"
          preserveAspectRatio="none"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M.293 0l22 22-22 22h1.414l22-22-22-22H.293z" />
        </svg>
        <p class="ml-4 text-sm font-medium text-gray-500 hover:text-gray-700">
          {title}
        </p>
      </div>
    </li>
  </ol>
</div>
