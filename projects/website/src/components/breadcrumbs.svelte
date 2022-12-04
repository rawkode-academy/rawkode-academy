<script lang="ts">
  interface Breadcrumb {
    title: string;
    href: string;
  }

  export let title: string;
  export let breadcrumbs: Breadcrumb[] = [];
</script>

<div class="bg-white flex" aria-label="Breadcrumb">
  <ol class="w-full px-4 flex space-x-4 sm:px-6 lg:px-8">
    <li class="flex">
      <div class="flex items-center">
        <a href="/" class="text-gray-400 hover:text-gray-500">
          <svg
            class="flex-shrink-0 h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"
            />
          </svg>
          <span class="sr-only">Home</span>
        </a>
      </div>
    </li>

    <!-- this causes an HMR error? -->
    <!-- {#each breadcrumbs as breadcrumb}
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
    {/each} -->

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
        <a class="ml-4 text-sm font-medium text-gray-500 hover:text-gray-700">
          {title}
        </a>
      </div>
    </li>
  </ol>
</div>
