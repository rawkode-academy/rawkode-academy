<template>
  <section class="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-black">
    <!-- Animated background pattern -->
    <div class="absolute inset-0 opacity-10">
      <div class="absolute inset-0 bg-grid-pattern"></div>
    </div>
    
    <div class="relative z-10 container mx-auto px-4 py-12 md:py-20">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <!-- Left content -->
        <div>
          <!-- Badge -->
          <div class="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full">
            <svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>
            <span class="text-green-300 font-medium">Free & Open Source Course</span>
          </div>
          
          <!-- Main headline -->
          <h1 class="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight">
            Master <span class="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">Zitadel</span>
            <br />
            Authentication & Authorization
          </h1>
          
          <!-- Description -->
          <p class="text-xl text-gray-300 mb-8 leading-relaxed">
            The comprehensive guide to implementing secure, scalable identity management with Zitadel. 
            From basics to advanced patterns, learn everything you need to build production-ready auth systems.
          </p>
          
          <!-- Key info - only showing real data -->
          <div class="flex flex-wrap items-center gap-6 mb-8 text-gray-300">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
              </div>
              <div>
                <div class="text-white font-semibold">{{ moduleCount }} Modules</div>
                <div class="text-gray-500 text-sm">Comprehensive content</div>
              </div>
            </div>
            
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                </svg>
              </div>
              <div>
                <div class="text-white font-semibold capitalize">{{ difficulty }}</div>
                <div class="text-gray-500 text-sm">Level</div>
              </div>
            </div>
          </div>
          
          <!-- CTA -->
          <div>
            <Button 
              :href="`/courses/${courseId}`" 
              variant="primary" 
              size="lg"
              class="bg-primary hover:bg-primary-dark text-white font-semibold px-8"
            >
              Start Learning Now
              <svg class="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
              </svg>
            </Button>
          </div>
        </div>
        
        <!-- Right content - Course preview card -->
        <div class="relative">
          <!-- Decorative element -->
          <div class="absolute -top-4 -right-4 w-72 h-72 bg-yellow-500 rounded-full opacity-5 blur-3xl"></div>
          
          <!-- Course preview card -->
          <div class="relative bg-gray-800/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-700">
            <!-- Zitadel logo/icon -->
            <div class="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
            </div>
            
            <!-- What you'll learn -->
            <h3 class="text-2xl font-bold text-white mb-4 text-center">What You'll Learn</h3>
            <ul class="space-y-3 text-gray-300">
              <li class="flex items-start gap-3">
                <svg class="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Complete Zitadel setup and configuration</span>
              </li>
              <li class="flex items-start gap-3">
                <svg class="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Implement OAuth 2.0 and OIDC flows</span>
              </li>
              <li class="flex items-start gap-3">
                <svg class="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Build secure multi-tenant applications</span>
              </li>
              <li class="flex items-start gap-3">
                <svg class="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Advanced RBAC and permission systems</span>
              </li>
              <li class="flex items-start gap-3">
                <svg class="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Production deployment best practices</span>
              </li>
            </ul>
            
            <!-- Course author -->
            <div class="mt-8 pt-6 border-t border-gray-700">
              <p class="text-gray-400 text-sm mb-2">Taught by</p>
              <div class="flex items-center gap-3">
                <img 
                  src="https://avatars.githubusercontent.com/rawkode" 
                  alt="David Flanagan"
                  class="w-12 h-12 rounded-full"
                />
                <div>
                  <div class="text-white font-semibold">David Flanagan</div>
                  <div class="text-gray-500 text-sm">Cloud Native Expert</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Coming soon section -->
      <div class="mt-16 text-center">
        <p class="text-gray-400 mb-4">More courses coming soon!</p>
        <div class="flex justify-center gap-8 opacity-30">
          <div class="text-center">
            <div class="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center mx-auto mb-2">
              <svg class="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <p class="text-sm text-gray-600">Kubernetes</p>
          </div>
          <div class="text-center">
            <div class="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center mx-auto mb-2">
              <svg class="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <p class="text-sm text-gray-600">GitOps</p>
          </div>
          <div class="text-center">
            <div class="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center mx-auto mb-2">
              <svg class="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <p class="text-sm text-gray-600">Observability</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import Button from "../common/Button.vue";

interface Props {
	courseId: string;
	moduleCount: number;
	difficulty: string;
}

defineProps<Props>();
</script>

<style scoped>
.bg-grid-pattern {
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}
</style>