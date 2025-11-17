<template>
  <section class="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
    <!-- Background decoration -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute top-0 left-1/4 w-96 h-96 bg-secondary/20 dark:bg-secondary/20 rounded-full opacity-20 blur-3xl"></div>
      <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/20 dark:bg-primary/20 rounded-full opacity-20 blur-3xl"></div>
    </div>
    
    <!-- Grid pattern overlay -->
    <div class="absolute inset-0 bg-grid-pattern opacity-5"></div>
    
    <div class="relative z-10 container mx-auto px-4 py-16 md:py-24">
      <div class="max-w-4xl mx-auto text-center">
        <!-- Breadcrumb slot -->
        <div v-if="$slots.breadcrumb" class="mb-6">
          <slot name="breadcrumb" />
        </div>
        
        <!-- Badge/Category -->
        <div v-if="badge" class="mb-4">
          <Badge variant="primary" size="md">{{ badge }}</Badge>
        </div>
        
        <!-- Title -->
        <Heading
          as="h1"
          size="4xl"
          align="center"
          weight="extrabold"
          class="mb-6"
        >
          {{ title }}
        </Heading>
        
        <!-- Subtitle/Description -->
        <p v-if="subtitle" class="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
          {{ subtitle }}
        </p>
        
        <!-- Actions slot -->
        <div v-if="$slots.actions" class="hero-actions flex flex-wrap gap-4 justify-center mb-8">
          <slot name="actions" />
        </div>
        
        <!-- Stats/Metadata -->
        <div v-if="stats && stats.length > 0" class="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-400">
          <div v-for="(stat, index) in stats" :key="index" class="flex items-center gap-2">
            <component
              v-if="stat.icon"
              :is="stat.icon"
              class="w-5 h-5"
            />
            <span>{{ stat.label }}</span>
          </div>
        </div>
        
        <!-- Custom content slot -->
        <div v-if="$slots.default" class="mt-8">
          <slot />
        </div>
      </div>
    </div>
    
    <!-- Bottom wave decoration -->
    <div class="absolute bottom-0 left-0 right-0">
      <svg
        class="w-full h-8 md:h-16 text-white dark:text-gray-800"
        preserveAspectRatio="none"
        viewBox="0 0 1440 64"
        fill="currentColor"
      >
        <path d="M0,32L48,37.3C96,43,192,53,288,56C384,59,480,53,576,48C672,43,768,37,864,32C960,27,1056,21,1152,21.3C1248,21,1344,27,1392,29.3L1440,32L1440,64L1392,64C1344,64,1248,64,1152,64C1056,64,960,64,864,64C768,64,672,64,576,64C480,64,384,64,288,64C192,64,96,64,48,64L0,64Z"></path>
      </svg>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Component } from "vue";
import Badge from "./Badge.vue";
import Heading from "./Heading.vue";

interface Stat {
	icon?: Component;
	label: string;
}

interface Props {
	title: string;
	subtitle?: string;
	badge?: string;
	stats?: Stat[];
}

defineProps<Props>();
</script>

<style scoped>
.bg-grid-pattern {
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}

.hero-actions :deep(a),
.hero-actions :deep(button) {
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.25);
  border-radius: 999px;
}
</style>
