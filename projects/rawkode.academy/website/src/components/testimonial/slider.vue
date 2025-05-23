<script setup lang="ts">
import { Carousel, Slide, Pagination, Navigation } from 'vue3-carousel';
import 'vue3-carousel/dist/carousel.css';

// Use a more permissive type definition by using a Record type
interface Props {
  testimonials: {
    quote: string;
    author: Record<string, any>;
  }[];
}

defineProps<Props>();
</script>

<template>
	<Carousel :autoplay="5000" :wrap-around="true" :items-to-show="1" :pause-autoplay-on-hover="true"
		class="testimonial-carousel">
		<Slide v-for="(testimonial, index) in testimonials" :key="index">
			<div class="py-4 px-4 md:py-4 md:px-4 text-gray-900 dark:text-gray-100">
				<div
					class="relative max-w-3xl mx-auto p-8 md:p-10 rounded-2xl bg-linear-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
					<blockquote>
						<p
							class="relative text-xl font-medium leading-relaxed text-gray-800 dark:text-gray-100 mb-6 text-center px-6 z-10">
							{{ testimonial.quote }}
						</p>
					</blockquote>
					<div class="flex items-center justify-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
						<div class="shrink-0 mr-4">
							<img :src="testimonial.author.image" :alt="`${testimonial.author.name} profile picture`"
								class="w-12 h-12 rounded-full object-cover border-2 border-indigo-600 dark:border-indigo-400 shadow-sm ring-2 ring-white dark:ring-gray-800" />
						</div>
						<div class="flex flex-col">
							<a v-if="testimonial.author.link" target="_blank" :href="testimonial.author.link"
								class="no-underline transition-opacity hover:opacity-80">
								<div class="font-semibold text-gray-900 dark:text-white mb-1">{{ testimonial.author.name }}</div>
								<div class="text-sm text-gray-500 dark:text-gray-400">{{ testimonial.author.title }}</div>
							</a>
							<div v-else>
								<div class="font-semibold text-gray-900 dark:text-white mb-1">{{ testimonial.author.name }}</div>
								<div class="text-sm text-gray-500 dark:text-gray-400">{{ testimonial.author.title }}</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</Slide>

		<template #addons>
			<Navigation />
			<Pagination />
		</template>
	</Carousel>
</template>

<style>
/* Customize carousel navigation */
.carousel__prev,
.carousel__next {
  background-color: #4f46e5 !important; /* indigo-600 */
  border-radius: 9999px !important;
  width: 3rem !important;
  height: 3rem !important;
  margin: 0 1rem !important;
  opacity: 0.9 !important;
  transition: all 0.2s ease !important;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
}

.dark .carousel__prev,
.dark .carousel__next {
  background-color: #6366f1 !important; /* indigo-500 */
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1) !important;
}

.carousel__prev:hover,
.carousel__next:hover {
  background-color: #4338ca !important; /* indigo-700 */
  opacity: 1 !important;
  transform: scale(1.05) !important;
}

.dark .carousel__prev:hover,
.dark .carousel__next:hover {
  background-color: #818cf8 !important; /* indigo-400 */
}

.carousel__icon {
  filter: brightness(10) !important;
}

/* Customize pagination */
.carousel__pagination {
  margin-top: 2rem !important;
}

.carousel__pagination-button {
  width: 0.75rem !important;
  height: 0.75rem !important;
  border-radius: 50% !important;
  background-color: #d1d5db !important; /* gray-300 */
  margin: 0 0.25rem !important;
  transition: all 0.2s ease !important;
}

.carousel__pagination-button--active {
  background-color: #4f46e5 !important; /* indigo-600 */
  transform: scale(1.2) !important;
}

.dark .carousel__pagination-button {
  background-color: #4b5563 !important; /* gray-600 */
}

.dark .carousel__pagination-button--active {
  background-color: #6366f1 !important; /* indigo-500 */
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .carousel__prev,
  .carousel__next {
    width: 2.5rem !important;
    height: 2.5rem !important;
    margin: 0 0.5rem !important;
  }
}

@media (max-width: 640px) {
  .carousel__prev,
  .carousel__next {
    display: none !important;
  }
}
</style>
