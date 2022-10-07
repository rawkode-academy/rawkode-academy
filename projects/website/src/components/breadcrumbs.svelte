<script lang="ts">
  interface Breadcrumb {
    title: string;
    href: string;
  }

  import { isOpen } from "@components/sidebar/store";

  const toggleMenu = () => {
    isOpen.set(!$isOpen);
  };

  const showCommandPalette = () => {
    const ninja = document.querySelector("ninja-keys");
    ninja.open();
  };

  export let title: string;
  export let breadcrumbs: Breadcrumb[] = [];
</script>

<div class="bg-white border-b border-purple-200 flex" aria-label="Breadcrumb">
  <ol class="w-full px-4 flex space-x-4 sm:px-6 lg:px-8">
    <li class="flex">
      <button
        type="button"
        on:click={toggleMenu}
        class="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 md:hidden"
      >
        <span class="sr-only">Open sidebar</span>
        <svg
          class="h-6 w-6"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M4 6h16M4 12h16M4 18h7"
          />
        </svg>
      </button>
    </li>

    <li class="flex">
      <div class="flex items-center">
        <a href="/#" class="text-gray-400 hover:text-gray-500">
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
        <a class="ml-4 text-sm font-medium text-gray-500 hover:text-gray-700">
          {title}
        </a>
      </div>
    </li>

    <li class="flex">
      <button
        type="button"
        on:click={showCommandPalette}
        class="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
      >
        <svg
          class="h-6 w-6"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          stroke-width="2"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M18.125,15.804l-4.038-4.037c0.675-1.079,1.012-2.308,1.01-3.534C15.089,4.62,12.199,1.75,8.584,1.75C4.815,1.75,1.982,4.726,2,8.286c0.021,3.577,2.908,6.549,6.578,6.549c1.241,0,2.417-0.347,3.44-0.985l4.032,4.026c0.167,0.166,0.43,0.166,0.596,0l1.479-1.478C18.292,16.234,18.292,15.968,18.125,15.804 M8.578,13.99c-3.198,0-5.716-2.593-5.733-5.71c-0.017-3.084,2.438-5.686,5.74-5.686c3.197,0,5.625,2.493,5.64,5.624C14.242,11.548,11.621,13.99,8.578,13.99 M16.349,16.981l-3.637-3.635c0.131-0.11,0.721-0.695,0.876-0.884l3.642,3.639L16.349,16.981z"
          />
        </svg>
      </button>
    </li>
  </ol>
</div>
