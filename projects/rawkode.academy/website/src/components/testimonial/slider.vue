<script setup lang="ts">
import { Carousel, Slide, Pagination, Navigation } from 'vue3-carousel';
import 'vue3-carousel/dist/carousel.css';

interface Author {
  name: string;
  title: string;
  image: string;
  link?: string;
}

interface Testimonial {
  quote: string;
  author: Author;
}

interface Props {
  testimonials: Testimonial[];
}

defineProps<Props>();
</script>

<template>
  <Carousel
    :autoplay="5000"
    :wrap-around="true"
    :items-to-show="1"
    :pause-autoplay-on-hover="true"
    class="testimonial-carousel"
  >
    <Slide v-for="(testimonial, index) in testimonials" :key="index">
      <div class="testimonial-slide">
        <div class="testimonial-card">
          <blockquote>
            <p class="testimonial-text">
              {{ testimonial.quote }}
            </p>
          </blockquote>
          <div class="author-section">
            <div class="author-image">
              <img
                :src="testimonial.author.image"
                :alt="`${testimonial.author.name} profile picture`"
              />
            </div>
            <div class="author-info">
              <a
                v-if="testimonial.author.link"
                target="_blank"
                :href="testimonial.author.link"
                class="author-link"
              >
                <div class="author-name">{{ testimonial.author.name }}</div>
                <div class="author-title">{{ testimonial.author.title }}</div>
              </a>
              <div v-else>
                <div class="author-name">{{ testimonial.author.name }}</div>
                <div class="author-title">{{ testimonial.author.title }}</div>
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
.testimonial-slide {
  padding: 2rem 1rem;
}

.testimonial-card {
  position: relative;
  max-width: 800px;
  margin: 0 auto;
  padding: 2.5rem 2rem 2rem;
  background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
  border-radius: 1rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(229, 231, 235, 0.5);
  overflow: hidden;
}

.dark .testimonial-card {
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  border-color: rgba(55, 65, 81, 0.5);
}

.quote-icon {
  position: absolute;
  width: 4rem;
  height: 4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.12;
  z-index: 1;
}

.quote-icon-start {
  top: 1.5rem;
  left: 1.5rem;
  transform: rotate(180deg);
}

.quote-icon-end {
  bottom: 1.5rem;
  right: 1.5rem;
}

.quote-icon svg {
  width: 100%;
  height: 100%;
  color: #4f46e5;
}

.dark .quote-icon svg {
  color: #6366f1;
}

.testimonial-text {
  position: relative;
  font-size: 1.25rem;
  line-height: 1.75;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 1.5rem;
  z-index: 10;
  text-align: center;
  padding: 0 1.5rem;
}

.dark .testimonial-text {
  color: #f9fafb;
}

.author-section {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(229, 231, 235, 0.7);
}

.dark .author-section {
  border-top-color: rgba(55, 65, 81, 0.7);
}

.author-image {
  flex-shrink: 0;
  margin-right: 1rem;
}

.author-image img {
  width: 3rem;
  height: 3rem;
  border-radius: 9999px;
  object-fit: cover;
  border: 2px solid #4f46e5;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8);
}

.dark .author-image img {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(31, 41, 55, 0.8);
}

.author-info {
  display: flex;
  flex-direction: column;
}

.author-name {
  font-weight: 600;
  font-size: 1rem;
  color: #111827;
  margin-bottom: 0.25rem;
}

.dark .author-name {
  color: #f9fafb;
}

.author-title {
  font-size: 0.875rem;
  color: #6b7280;
}

.dark .author-title {
  color: #9ca3af;
}

.author-link {
  text-decoration: none;
  transition: opacity 0.2s ease;
}

.author-link:hover {
  opacity: 0.8;
}

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

.carousel__prev:hover,
.carousel__next:hover {
  background-color: #4338ca !important; /* indigo-700 */
  opacity: 1 !important;
  transform: scale(1.05) !important;
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
  .testimonial-card {
    padding: 2rem 1.5rem 1.5rem;
  }

  .testimonial-text {
    font-size: 1.125rem;
  }

  .carousel__prev,
  .carousel__next {
    width: 2.5rem !important;
    height: 2.5rem !important;
    margin: 0 0.5rem !important;
  }
}

@media (max-width: 640px) {
  .testimonial-slide {
    padding: 1rem 0.5rem;
  }

  .carousel__prev,
  .carousel__next {
    display: none !important;
  }

  .author-image img {
    width: 2.5rem;
    height: 2.5rem;
  }
}
</style>
