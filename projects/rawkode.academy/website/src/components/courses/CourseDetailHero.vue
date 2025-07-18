<template>
  <section class="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-black">
    <!-- Animated background pattern -->
    <div class="absolute inset-0 opacity-10">
      <div class="absolute inset-0 bg-grid-pattern"></div>
    </div>
    
    <div class="relative z-10 container mx-auto px-4 py-6 md:py-8 lg:py-12">
      <!-- Compact title section -->
      <div class="text-center mb-8">
        <!-- Badge -->
        <div class="inline-flex items-center gap-2 mb-4 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-sm">
          <svg class="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
          </svg>
          <span class="text-green-300 font-medium">Free & Open Source Course</span>
        </div>
        
        <!-- Main headline -->
        <h1 class="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-tight max-w-4xl mx-auto">
          {{ title }}
        </h1>
      </div>
      
      <!-- Content split 50/50 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
        <!-- Left content - Compact version -->
        <div class="space-y-6">
          <!-- Description -->
          <p class="text-base sm:text-lg text-gray-200 leading-relaxed">
            {{ description }}
          </p>
          
          <!-- Compact Stats Row -->
          <div class="flex flex-col sm:flex-row gap-4">
            <div class="flex-1 bg-gray-800/30 backdrop-blur-sm rounded-lg p-4 border border-gray-700/50">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                  </svg>
                </div>
                <div class="min-w-0">
                  <div class="text-lg sm:text-xl font-bold text-white">{{ moduleCount }}</div>
                  <div class="text-xs text-gray-400">Modules</div>
                </div>
              </div>
            </div>
            
            <div class="flex-1 bg-gray-800/30 backdrop-blur-sm rounded-lg p-4 border border-gray-700/50">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </svg>
                </div>
                <div class="min-w-0">
                  <div class="text-lg sm:text-xl font-bold text-white capitalize truncate">{{ difficulty }}</div>
                  <div class="text-xs text-gray-400">Level</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Compact Learning Path -->
          <div class="bg-gray-800/20 rounded-lg p-4 border border-gray-700/30">
            <h3 class="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
              </svg>
              Your Learning Path
            </h3>
            <div class="grid grid-cols-1 gap-2 text-sm">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span class="text-green-400 text-xs font-semibold">1</span>
                </div>
                <p class="text-gray-300">Master Zitadel fundamentals and setup</p>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span class="text-blue-400 text-xs font-semibold">2</span>
                </div>
                <p class="text-gray-300">Implement authentication flows</p>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span class="text-purple-400 text-xs font-semibold">3</span>
                </div>
                <p class="text-gray-300">Build production-ready applications</p>
              </div>
            </div>
          </div>
          
          <!-- Instructor & CTA Row -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div class="flex items-center gap-3">
              <img 
                v-for="author in authors"
                :key="author.handle"
                :src="`https://github.com/${author.handle}.png`" 
                :alt="author.name"
                class="w-10 h-10 rounded-full ring-2 ring-gray-700"
              />
              <div class="min-w-0">
                <p class="text-xs text-gray-400">Taught by</p>
                <div class="text-sm text-white font-medium truncate">
                  {{ authors.map(a => a.name).join(', ') }}
                </div>
              </div>
            </div>
            
            <Button 
              href="#course-content" 
              variant="primary" 
              size="md"
              class="bg-primary hover:bg-primary-dark text-white font-semibold w-full sm:w-auto"
            >
              Start Learning
              <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </Button>
          </div>
        </div>
        
        <!-- Right content - Signup form (more compact) -->
        <div class="relative">
          <!-- Decorative element -->
          <div class="absolute -top-4 -right-4 w-48 h-48 bg-yellow-500 rounded-full opacity-5 blur-3xl"></div>
          
          <!-- Signup card -->
          <div class="relative bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
            <div class="text-center mb-4">
              <h3 class="text-xl font-bold text-white mb-1">Get Course Updates</h3>
              <p class="text-gray-400 text-sm">
                Be the first to know when new modules are released
              </p>
            </div>
            
            <!-- Pass signup config to parent for server-side form -->
            <slot name="signup-form" />
            
            <!-- Benefits -->
            <div class="mt-4 pt-4 border-t border-gray-700">
              <h4 class="text-xs font-semibold text-gray-300 mb-3">What you'll get:</h4>
              <ul class="space-y-2 text-xs text-gray-400">
                <li class="flex items-start gap-2">
                  <svg class="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Instant notifications for new modules</span>
                </li>
                <li class="flex items-start gap-2">
                  <svg class="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Access to course source code</span>
                </li>
                <li class="flex items-start gap-2">
                  <svg class="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Exclusive tips and best practices</span>
                </li>
                <li class="flex items-start gap-2">
                  <svg class="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Community support and Q&A</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import Button from "../common/Button.vue";

interface Author {
	name: string;
	handle: string;
}

interface Props {
	title: string;
	description: string;
	moduleCount: number;
	totalDuration: string;
	difficulty: string;
	authors: Author[];
}

defineProps<Props>();
</script>

<style scoped>
.bg-grid-pattern {
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}
</style>