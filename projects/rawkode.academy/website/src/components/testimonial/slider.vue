<script setup lang="ts">
import { Carousel, Navigation, Pagination, Slide } from "vue3-carousel";
import "vue3-carousel/dist/carousel.css";

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
					class="relative max-w-3xl mx-auto p-8 md:p-10 rounded-2xl bg-white/40 dark:bg-gray-900/40 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] border border-white/40 dark:border-gray-700/40 overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/10 before:to-transparent before:pointer-events-none before:rounded-2xl transition-all duration-300">
					<blockquote>
						<p
							class="relative text-xl font-medium leading-relaxed text-gray-800 dark:text-gray-100 mb-6 text-center px-6 z-10">
							{{ testimonial.quote }}
						</p>
					</blockquote>
					<div class="flex items-center justify-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
						<div class="shrink-0 mr-4">
							<img :src="testimonial.author.image" :alt="`${testimonial.author.name} profile picture`"
								class="w-12 h-12 rounded-full object-cover border-2 border-indigo-600 dark:border-indigo-400 shadow-sm ring-2 ring-white dark:ring-gray-800" loading="lazy" />
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
  background: linear-gradient(to bottom right, rgba(79, 70, 229, 0.9), rgba(99, 102, 241, 0.9)) !important; /* indigo gradient */
  backdrop-filter: blur(12px) !important;
  border-radius: 9999px !important;
  width: 3rem !important;
  height: 3rem !important;
  margin: 0 1rem !important;
  transition: all 0.2s ease !important;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.12) !important;
  border: 1px solid rgba(79, 70, 229, 0.3) !important;
}

.dark .carousel__prev,
.dark .carousel__next {
  background: linear-gradient(to bottom right, rgba(99, 102, 241, 0.9), rgba(129, 140, 248, 0.9)) !important; /* indigo gradient dark */
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4) !important;
  border: 1px solid rgba(99, 102, 241, 0.3) !important;
}

.carousel__prev:hover,
.carousel__next:hover {
  background: linear-gradient(to bottom right, rgba(79, 70, 229, 1), rgba(99, 102, 241, 1)) !important;
  transform: scale(1.05) !important;
  box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.18) !important;
}

.dark .carousel__prev:hover,
.dark .carousel__next:hover {
  background: linear-gradient(to bottom right, rgba(99, 102, 241, 1), rgba(129, 140, 248, 1)) !important;
  box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.5) !important;
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
  background-color: rgba(209, 213, 219, 0.5) !important; /* gray-300 with opacity */
  backdrop-filter: blur(8px) !important;
  margin: 0 0.25rem !important;
  transition: all 0.2s ease !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
}

.carousel__pagination-button--active {
  background: linear-gradient(to bottom right, rgba(79, 70, 229, 0.9), rgba(99, 102, 241, 0.9)) !important; /* indigo gradient */
  transform: scale(1.2) !important;
  box-shadow: 0 4px 16px 0 rgba(79, 70, 229, 0.4) !important;
  border: 1px solid rgba(79, 70, 229, 0.3) !important;
}

.dark .carousel__pagination-button {
  background-color: rgba(75, 85, 99, 0.5) !important; /* gray-600 with opacity */
  border: 1px solid rgba(107, 114, 128, 0.3) !important;
}

.dark .carousel__pagination-button--active {
  background: linear-gradient(to bottom right, rgba(99, 102, 241, 0.9), rgba(129, 140, 248, 0.9)) !important; /* indigo gradient dark */
  box-shadow: 0 4px 16px 0 rgba(99, 102, 241, 0.4) !important;
  border: 1px solid rgba(99, 102, 241, 0.3) !important;
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
