<template>
  <section class="relative overflow-hidden bg-gradient-to-br from-gray-900 via-[rgba(var(--brand-primary),0.25)] to-[rgba(var(--brand-secondary),0.35)] text-white">
    <!-- Animated background -->
    <div class="absolute inset-0 overflow-hidden">
      <div class="absolute -top-40 -right-40 w-80 h-80 bg-secondary rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-primary rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div class="absolute top-40 left-1/2 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000 bg-[rgba(var(--brand-secondary),0.8)] dark:bg-[rgba(var(--brand-primary),0.6)]"></div>
    </div>
    
    <!-- Grid pattern overlay -->
    <div class="absolute inset-0 bg-grid-pattern opacity-10"></div>
    
    <div class="relative z-10 container mx-auto px-4 py-12 md:py-16">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <!-- Left content -->
        <div class="max-w-xl">
          <!-- Badge -->
          <div class="inline-flex items-center gap-2 mb-4 px-3 py-1 bg-primary/20 border border-primary/30 rounded-full text-primary text-sm font-medium">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>
            100% Free & Open Source
          </div>
          
          <!-- Title -->
          <Heading
            as="h1"
            size="3xl"
            weight="extrabold"
            class="mb-4 text-white"
          >
            Master Cloud Native Technologies
          </Heading>
          
          <!-- Subtitle -->
          <p class="text-lg text-gray-300 mb-6">
            Comprehensive, hands-on courses from beginner to advanced. Build real-world skills with practical labs and projects.
          </p>
          
          <!-- Stats -->
          <div class="grid grid-cols-3 gap-4 mb-6">
            <div class="text-center p-3 bg-white/10 rounded-lg backdrop-blur-sm">
              <div class="text-2xl font-bold text-white">{{ courseCount }}</div>
              <div class="text-xs text-gray-300">Courses</div>
            </div>
            <div class="text-center p-3 bg-white/10 rounded-lg backdrop-blur-sm">
              <div class="text-2xl font-bold text-white">50+</div>
              <div class="text-xs text-gray-300">Hours</div>
            </div>
            <div class="text-center p-3 bg-white/10 rounded-lg backdrop-blur-sm">
              <div class="text-2xl font-bold text-white">15+</div>
              <div class="text-xs text-gray-300">Technologies</div>
            </div>
          </div>
          
          <!-- Actions -->
          <div class="flex flex-wrap gap-3">
            <Button 
              href="#all-courses" 
              variant="primary" 
              size="lg"
              class="bg-white text-gray-900 hover:bg-gray-100"
            >
              Browse All Courses
            </Button>
            <Button 
              href="/technologies" 
              variant="ghost" 
              size="lg"
              class="text-white border-white/30 hover:bg-white/10"
            >
              Explore Technologies
            </Button>
          </div>
        </div>
        
        <!-- Right content - Featured courses -->
        <div class="relative">
          <div class="space-y-4">
            <!-- Featured course cards -->
            <div 
              v-for="(course, index) in featuredCourses"
              :key="course.id"
              class="group relative bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 hover:bg-white/20 transition-all cursor-pointer"
              :class="{ 'ml-8': index === 1 }"
              @click="$emit('navigate', `/courses/${course.id}`)"
            >
              <div class="flex items-start gap-4">
                <div class="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                  <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                  </svg>
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="font-semibold text-white">{{ course.data.title }}</h3>
                    <Badge 
                      size="xs" 
                      :variant="getDifficultyVariant(course.data.difficulty)"
                      class="capitalize"
                    >
                      {{ course.data.difficulty }}
                    </Badge>
                  </div>
                  <p class="text-sm text-gray-300 line-clamp-2">{{ course.data.description }}</p>
                  <div class="mt-2 flex items-center gap-4 text-xs text-gray-400">
                    <span>{{ course.moduleCount }} modules</span>
                    <span>•</span>
                    <span>{{ course.estimatedHours }}h</span>
                  </div>
                </div>
                <svg class="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
          </div>
          
          <!-- Decorative element -->
          <div class="absolute -bottom-4 -right-4 text-6xl font-bold text-white/5">
            Featured
          </div>
        </div>
      </div>
      
      <!-- Technology logos strip -->
      <div class="mt-12 pt-8 border-t border-white/20">
        <p class="text-center text-sm text-gray-400 mb-4">Technologies covered in our courses</p>
        <div class="flex flex-wrap items-center justify-center gap-6 opacity-60">
          <img 
            v-for="tech in technologies" 
            :key="tech.name"
            :src="tech.logo" 
            :alt="tech.name"
            class="h-8 filter brightness-0 invert"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CollectionEntry } from "astro:content";
import Badge from "../common/Badge.vue";
import Button from "../common/Button.vue";
import Heading from "../common/Heading.vue";

interface Props {
	featuredCourses: Array<
		CollectionEntry<"courses"> & { moduleCount: number; estimatedHours: number }
	>;
	courseCount: number;
	technologies?: Array<{ name: string; logo: string }>;
}

defineProps<Props>();

defineEmits<{
	navigate: [path: string];
}>();

function getDifficultyVariant(
	difficulty: string,
): "success" | "warning" | "danger" | "default" {
	switch (difficulty) {
		case "beginner":
			return "success";
		case "intermediate":
			return "warning";
		case "advanced":
			return "danger";
		default:
			return "default";
	}
}
</script>

<style scoped>
.bg-grid-pattern {
  background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}

@keyframes blob {
  0% {
    transform: translate(0px, 0px) scale(1);
  }
  33% {
    transform: translate(30px, -50px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
  100% {
    transform: translate(0px, 0px) scale(1);
  }
}

.animate-blob {
  animation: blob 7s infinite;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

.animation-delay-4000 {
  animation-delay: 4s;
}
</style>
