<template>
  <section :class="css({ position: 'relative', overflow: 'hidden', bgGradient: 'to-br', gradientFrom: { base: 'gray.50', _dark: 'gray.900' }, gradientVia: { base: 'gray.100', _dark: 'gray.800' }, gradientTo: { base: 'gray.200', _dark: 'black' } })">
    <!-- Animated background pattern -->
    <div :class="css({ position: 'absolute', inset: '0', opacity: '0.1' })">
      <div class="bg-grid-pattern" :class="css({ position: 'absolute', inset: '0' })"></div>
    </div>

    <div :class="css({ position: 'relative', zIndex: '10', maxW: 'breakpoint-xl', mx: 'auto', px: '4', py: '12', md: { py: '20' } })">
      <div :class="css({ display: 'grid', gridTemplateColumns: { base: 'repeat(1, minmax(0, 1fr))', lg: 'repeat(2, minmax(0, 1fr))' }, gap: '12', alignItems: 'center' })">
        <!-- Left content -->
        <div>
          <!-- Badge -->
          <div :class="css({ display: 'inline-flex', alignItems: 'center', gap: '2', mb: '6', px: '4', py: '2', bg: 'green.500/20', borderWidth: '1px', borderColor: 'green.500/30', borderRadius: 'full' })">
            <svg :class="css({ w: '5', h: '5', color: { base: 'green.600', _dark: 'green.400' } })" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>
            <span :class="css({ color: { base: 'green.700', _dark: 'green.300' }, fontWeight: 'medium' })">Free &amp; Open Source Course</span>
          </div>

          <!-- Main headline -->
          <h1 :class="css({ fontSize: { base: '4xl', md: '5xl', lg: '6xl' }, fontWeight: 'extrabold', color: { base: 'gray.900', _dark: 'white' }, mb: '6', lineHeight: 'tight' })">
            {{ courseName }}
          </h1>

          <!-- Description -->
          <p :class="css({ fontSize: 'xl', color: { base: 'gray.700', _dark: 'gray.300' }, mb: '8', lineHeight: 'relaxed' })">
            {{ courseDescription }}
          </p>

          <!-- Key info -->
          <div :class="css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6', mb: '8', color: { base: 'gray.700', _dark: 'gray.300' } })">
            <div :class="css({ display: 'flex', alignItems: 'center', gap: '3' })">
              <div :class="css({ w: '10', h: '10', bg: { base: 'gray.200', _dark: 'gray.800' }, borderRadius: 'lg', display: 'flex', alignItems: 'center', justifyContent: 'center' })">
                <svg :class="css({ w: '5', h: '5', color: { base: 'yellow.600', _dark: 'yellow.400' } })" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
              </div>
              <div>
                <div :class="css({ color: { base: 'gray.900', _dark: 'white' }, fontWeight: 'semibold' })">{{ moduleCount }} Modules</div>
                <div :class="css({ color: { base: 'gray.600', _dark: 'gray.500' }, fontSize: 'sm' })">Comprehensive content</div>
              </div>
            </div>

            <div :class="css({ display: 'flex', alignItems: 'center', gap: '3' })">
              <div :class="css({ w: '10', h: '10', bg: { base: 'gray.200', _dark: 'gray.800' }, borderRadius: 'lg', display: 'flex', alignItems: 'center', justifyContent: 'center' })">
                <svg :class="css({ w: '5', h: '5', color: 'green.400' })" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                </svg>
              </div>
              <div>
                <div :class="css({ color: { base: 'gray.900', _dark: 'white' }, fontWeight: 'semibold', textTransform: 'capitalize' })">{{ difficulty }}</div>
                <div :class="css({ color: { base: 'gray.600', _dark: 'gray.500' }, fontSize: 'sm' })">Level</div>
              </div>
            </div>
          </div>

          <!-- CTA -->
          <div>
            <Button
              :href="firstModuleSlug ? `/courses/${courseId}/${firstModuleSlug}` : `/courses/${courseId}`"
              variant="primary"
              size="lg"
              :class="css({ fontWeight: 'semibold', px: '8' })"
            >
              Start Learning Now
              <svg :class="css({ w: '5', h: '5', ml: '2' })" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
              </svg>
            </Button>
          </div>
        </div>

        <!-- Right content - Course preview card -->
        <div :class="css({ position: 'relative' })">
          <!-- Decorative element -->
          <div :class="css({ position: 'absolute', top: '-4', right: '-4', w: '72', h: '72', bg: 'yellow.500', borderRadius: 'full', opacity: '0.05', filter: 'auto', blur: '3xl' })"></div>

          <!-- Course preview card -->
          <div :class="css({ position: 'relative', bg: { base: 'white/50', _dark: 'gray.800/50' }, backdropFilter: 'blur(16px)', borderRadius: '2xl', p: '8', borderWidth: '1px', borderColor: { base: 'gray.300', _dark: 'gray.700' } })">
            <!-- Course icon -->
            <div :class="css({ w: '20', h: '20', bgGradient: 'to-br', gradientFrom: 'teal.500', gradientTo: 'green.400', borderRadius: '2xl', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: '6', mx: 'auto' })">
              <svg :class="css({ w: '12', h: '12', color: 'white' })" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
              </svg>
            </div>

            <!-- Course info -->
            <h3 :class="css({ fontSize: '2xl', fontWeight: 'bold', color: { base: 'gray.900', _dark: 'white' }, mb: '4', textAlign: 'center' })">{{ courseName }}</h3>
            <p :class="css({ color: { base: 'gray.700', _dark: 'gray.300' }, textAlign: 'center', mb: '6', lineHeight: 'relaxed' })">
              {{ courseDescription }}
            </p>

            <!-- Course author -->
            <div :class="css({ mt: '8', pt: '6', borderTopWidth: '1px', borderColor: { base: 'gray.300', _dark: 'gray.700' } })">
              <p :class="css({ color: { base: 'gray.600', _dark: 'gray.400' }, fontSize: 'sm', mb: '2' })">Taught by</p>
              <div :class="css({ display: 'flex', alignItems: 'center', gap: '3' })">
                <img
                  src="https://avatars.githubusercontent.com/rawkode"
                  alt="David Flanagan"
                  :class="css({ w: '12', h: '12', borderRadius: 'full' })"
                />
                <div>
                  <div :class="css({ color: { base: 'gray.900', _dark: 'white' }, fontWeight: 'semibold' })">David Flanagan</div>
                  <div :class="css({ color: { base: 'gray.600', _dark: 'gray.500' }, fontSize: 'sm' })">Cloud Native Expert</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Coming soon section -->
      <div :class="css({ mt: '16', textAlign: 'center' })">
        <p :class="css({ color: { base: 'gray.600', _dark: 'gray.400' }, mb: '4' })">More courses coming soon!</p>
        <div :class="css({ display: 'flex', justifyContent: 'center', gap: '8', opacity: '0.3' })">
          <div :class="css({ textAlign: 'center' })">
            <div :class="css({ w: '16', h: '16', bg: { base: 'gray.200', _dark: 'gray.800' }, borderRadius: 'lg', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: '2' })">
              <svg :class="css({ w: '8', h: '8', color: { base: 'gray.500', _dark: 'gray.600' } })" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <p :class="css({ fontSize: 'sm', color: { base: 'gray.500', _dark: 'gray.600' } })">Kubernetes</p>
          </div>
          <div :class="css({ textAlign: 'center' })">
            <div :class="css({ w: '16', h: '16', bg: { base: 'gray.200', _dark: 'gray.800' }, borderRadius: 'lg', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: '2' })">
              <svg :class="css({ w: '8', h: '8', color: { base: 'gray.500', _dark: 'gray.600' } })" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <p :class="css({ fontSize: 'sm', color: { base: 'gray.500', _dark: 'gray.600' } })">GitOps</p>
          </div>
          <div :class="css({ textAlign: 'center' })">
            <div :class="css({ w: '16', h: '16', bg: { base: 'gray.200', _dark: 'gray.800' }, borderRadius: 'lg', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: '2' })">
              <svg :class="css({ w: '8', h: '8', color: { base: 'gray.500', _dark: 'gray.600' } })" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <p :class="css({ fontSize: 'sm', color: { base: 'gray.500', _dark: 'gray.600' } })">Observability</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { css } from "../../styled-system/css";
import Button from "../common/Button.vue";

interface Props {
	courseId: string;
	courseName: string;
	courseDescription: string;
	moduleCount: number;
	difficulty: string;
	firstModuleSlug?: string | undefined;
}

defineProps<Props>();
</script>

<style scoped>
.bg-grid-pattern {
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}
</style>
