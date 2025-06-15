<script setup lang="ts">
interface Author {
	name: string;
	handle: string;
}

interface Props {
	id: string;
	title: string;
	subtitle?: string;
	cover?: {
		image: string;
		alt: string;
	};
	authors: Author[];
	publishedAt: Date;
	readingTimeText?: string;
}

defineProps<Props>();
</script>

<template>
  <a :href="`/read/${id}`" class="h-full">
    <article
      class="p-0 bg-white rounded-xl overflow-hidden shadow-lg dark:bg-gray-800 dark:border-gray-700 h-full flex flex-col transition-all duration-300 border border-gray-100 dark:border-gray-700"
    >
      <div class="relative">
        <div class="absolute inset-0 bg-linear-to-tr from-purple-600/30 to-indigo-600/30 mix-blend-multiply z-10"></div>
        <img
          v-if="cover"
          class="w-full h-52 object-cover"
          :src="cover.image"
          :alt="cover.alt"
          loading="lazy"
        />
        <img
          v-else
          class="w-full h-52 object-cover"
          src="https://flowbite.s3.amazonaws.com/blocks/marketing-ui/blog/office-laptops.png"
          alt="Default placeholder image for article without custom cover"
          loading="lazy"
        />
        <div class="absolute top-3 left-3 z-20">
          <span
            class="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-1 rounded-full dark:bg-purple-200 dark:text-purple-900 backdrop-blur-sm shadow-md"
          >
            Article
          </span>
        </div>
      </div>
      <div class="p-6 flex flex-col grow">
        <h2
          class="mb-3 text-xl font-bold tracking-tight text-gray-900 dark:text-white line-clamp-2"
        >
          {{ title }}
        </h2>
        <p v-if="subtitle" class="mb-4 font-light text-gray-500 dark:text-gray-400 line-clamp-3">
          {{ subtitle }}
        </p>
        <div class="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="flex -space-x-3">
                <div 
                  v-for="(author, index) in authors.slice(0, 3)" 
                  :key="author.handle"
                  class="relative" 
                  :style="`z-index: ${10 - index}`"
                >
                  <img
                    class="w-10 h-10 rounded-full object-cover border-2 border-purple-500 p-0.5 bg-white"
                    :src="`https://github.com/${author.handle}.png`"
                    :alt="`Profile picture of ${author.name}`"
                    loading="lazy"
                  />
                  <span 
                    v-if="index === 0" 
                    class="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-400 rounded-full border-2 border-white dark:border-gray-800"
                  ></span>
                </div>
                <div v-if="authors.length > 3" class="relative" style="z-index: 0;">
                  <div class="w-10 h-10 rounded-full bg-purple-100 border-2 border-purple-500 p-0.5 bg-white flex items-center justify-center text-xs text-purple-800 font-medium">
                    +{{ authors.length - 3 }}
                  </div>
                </div>
              </div>
              <div class="font-medium dark:text-white">
                <div class="text-sm">{{ authors.map(a => a.name).join(", ") }}</div>
              </div>
            </div>
            <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <div v-if="readingTimeText" class="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {{ readingTimeText }}
              </div>
              <div class="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {{ new Intl.DateTimeFormat('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                }).format(new Date(publishedAt)) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  </a>
</template>