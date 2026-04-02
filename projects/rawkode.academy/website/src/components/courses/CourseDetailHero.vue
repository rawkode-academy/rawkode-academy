<template>
  <section :class="css({ pos: 'relative', overflow: 'hidden', bgGradient: 'to-br', gradientFrom: { base: 'gray.50', _dark: 'gray.900' }, gradientVia: { base: 'gray.100', _dark: 'gray.800' }, gradientTo: { base: 'gray.200', _dark: 'black' } })">
    <!-- Animated background pattern -->
    <div :class="css({ pos: 'absolute', inset: '0', opacity: '0.1' })">
      <div class="absolute inset-0 bg-grid-pattern"></div>
    </div>

    <div :class="css({ pos: 'relative', zIndex: '10', mx: 'auto', px: '4', py: { base: '6', md: '8', lg: '12' }, maxW: 'breakpoint-xl' })">
      <!-- Compact title section -->
      <div :class="css({ textAlign: 'center', mb: '8' })">
        <!-- Badge -->
        <div :class="css({ display: 'inline-flex', alignItems: 'center', gap: '2', mb: '4', px: '3', py: '1', bg: 'green.500/20', borderWidth: '1px', borderColor: 'green.500/30', rounded: 'full', fontSize: 'sm' })">
          <svg :class="css({ w: '4', h: '4', color: { base: 'green.600', _dark: 'green.400' } })" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
          </svg>
          <span :class="css({ color: { base: 'green.700', _dark: 'green.300' }, fontWeight: 'medium' })">Free & Open Source Course</span>
        </div>

        <!-- Main headline -->
        <h1 :class="css({ fontSize: { base: '2xl', sm: '3xl', md: '4xl', lg: '5xl' }, fontWeight: 'extrabold', color: { base: 'gray.900', _dark: 'white' }, lineHeight: 'tight', maxW: '4xl', mx: 'auto' })">
          {{ title }}
        </h1>
      </div>

      <!-- Content split 50/50 -->
      <div :class="css({ display: 'grid', gridTemplateColumns: { base: '1', lg: '2' }, gap: { base: '6', lg: '8' }, alignItems: 'start' })">
        <!-- Left content - Compact version -->
        <div :class="css({ display: 'flex', flexDir: 'column', gap: '6' })">
          <!-- Description -->
          <p :class="css({ fontSize: { base: 'base', sm: 'lg' }, color: { base: 'gray.700', _dark: 'gray.200' }, lineHeight: 'relaxed' })">
            {{ description }}
          </p>

          <!-- Compact Stats Row -->
          <div :class="css({ display: 'flex', flexDir: { base: 'column', sm: 'row' }, gap: '4' })">
            <div :class="css({ flex: '1', bg: { base: 'rgba(255,255,255,0.5)', _dark: 'rgba(31,41,55,0.3)' }, backdropFilter: 'blur(4px)', rounded: 'lg', p: '4', borderWidth: '1px', borderColor: { base: 'gray.200', _dark: 'gray.700/50' } })">
              <div :class="css({ display: 'flex', alignItems: 'center', gap: '3' })">
                <div :class="css({ w: '10', h: '10', bg: 'yellow.500/20', rounded: 'lg', display: 'flex', alignItems: 'center', justifyContent: 'center' })">
                  <svg :class="css({ w: '5', h: '5', color: { base: 'yellow.600', _dark: 'yellow.400' } })" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                  </svg>
                </div>
                <div :class="css({ minW: '0' })">
                  <div :class="css({ fontSize: { base: 'lg', sm: 'xl' }, fontWeight: 'bold', color: { base: 'gray.900', _dark: 'white' } })">{{ moduleCount }}</div>
                  <div :class="css({ fontSize: 'xs', color: { base: 'gray.600', _dark: 'gray.400' } })">Modules</div>
                </div>
              </div>
            </div>

            <div :class="css({ flex: '1', bg: { base: 'rgba(255,255,255,0.5)', _dark: 'rgba(31,41,55,0.3)' }, backdropFilter: 'blur(4px)', rounded: 'lg', p: '4', borderWidth: '1px', borderColor: { base: 'gray.200', _dark: 'gray.700/50' } })">
              <div :class="css({ display: 'flex', alignItems: 'center', gap: '3' })">
                <div :class="css({ w: '10', h: '10', bg: 'secondary/20', rounded: 'lg', display: 'flex', alignItems: 'center', justifyContent: 'center' })">
                  <svg :class="css({ w: '5', h: '5', color: 'secondary' })" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </svg>
                </div>
                <div :class="css({ minW: '0' })">
                  <div :class="css({ fontSize: { base: 'lg', sm: 'xl' }, fontWeight: 'bold', color: { base: 'gray.900', _dark: 'white' }, textTransform: 'capitalize', truncate: true })">{{ difficulty }}</div>
                  <div :class="css({ fontSize: 'xs', color: { base: 'gray.600', _dark: 'gray.400' } })">Level</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Compact Learning Path -->
          <div
            v-if="learningPath.length > 0"
            :class="css({ bg: { base: 'rgba(255,255,255,0.5)', _dark: 'rgba(31,41,55,0.2)' }, rounded: 'lg', p: '4', borderWidth: '1px', borderColor: { base: 'gray.200', _dark: 'gray.700/30' } })"
          >
            <h3 :class="css({ fontSize: 'sm', fontWeight: 'semibold', color: { base: 'gray.900', _dark: 'white' }, mb: '3', display: 'flex', alignItems: 'center', gap: '2' })">
              <svg :class="css({ w: '4', h: '4', color: 'primary' })" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
              </svg>
              Your Learning Path
            </h3>
            <div :class="css({ display: 'grid', gridTemplateColumns: '1', gap: '2', fontSize: 'sm' })">
              <div
                v-for="(step, index) in learningPath"
                :key="`${index}-${step}`"
                :class="css({ display: 'flex', alignItems: 'center', gap: '2' })"
              >
                <div :class="css({ w: '6', h: '6', bg: 'primary/20', rounded: 'full', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' })">
                  <span :class="css({ color: 'primary', fontSize: 'xs', fontWeight: 'semibold' })">{{ index + 1 }}</span>
                </div>
                <p :class="css({ color: { base: 'gray.700', _dark: 'gray.300' } })">{{ step }}</p>
              </div>
            </div>
          </div>

          <!-- Instructor & CTA Row -->
          <div :class="css({ display: 'flex', flexDir: { base: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: { sm: 'space-between' }, gap: '4' })">
            <div :class="css({ display: 'flex', alignItems: 'center', gap: '3' })">
              <img
                v-for="author in authors"
                :key="author.name"
                :src="author.avatarUrl"
                :alt="author.name"
                :class="css({ w: '10', h: '10', rounded: 'full', ringWidth: '2px', ringColor: { base: 'gray.300', _dark: 'gray.700' } })"
                loading="lazy"
              />
              <div :class="css({ minW: '0' })">
                <p :class="css({ fontSize: 'xs', color: { base: 'gray.600', _dark: 'gray.400' } })">Taught by</p>
                <div :class="css({ fontSize: 'sm', color: { base: 'gray.900', _dark: 'white' }, fontWeight: 'medium', truncate: true })">
                  {{ authors.map(a => a.name).join(', ') }}
                </div>
              </div>
            </div>

            <Button
              href="#course-content"
              variant="primary"
              size="md"
              :class="css({ bg: 'primary', color: 'white', fontWeight: 'semibold', w: { base: 'full', sm: 'auto' }, _hover: { bg: 'primary/90' } })"
            >
              Start Learning
              <svg :class="css({ w: '4', h: '4', ml: '2' })" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </Button>
          </div>
        </div>

        <!-- Right content - Signup form (more compact) -->
        <div :class="css({ pos: 'relative' })">
          <!-- Decorative element -->
          <div :class="css({ pos: 'absolute', top: '-4', right: '-4', w: '48', h: '48', bg: 'yellow.500', rounded: 'full', opacity: '0.05', filter: 'blur(48px)' })"></div>

          <!-- Signup card -->
          <div :class="css({ pos: 'relative', bg: { base: 'rgba(255,255,255,0.5)', _dark: 'rgba(31,41,55,0.5)' }, backdropFilter: 'blur(16px)', rounded: 'xl', p: '6', borderWidth: '1px', borderColor: { base: 'gray.200', _dark: 'gray.700' } })">
            <div :class="css({ textAlign: 'center', mb: '4' })">
              <h3 :class="css({ fontSize: 'xl', fontWeight: 'bold', color: { base: 'gray.900', _dark: 'white' }, mb: '1' })">Get Course Updates</h3>
              <p :class="css({ color: { base: 'gray.600', _dark: 'gray.400' }, fontSize: 'sm' })">
                Be the first to know when new modules are released
              </p>
            </div>

            <!-- Pass signup config to parent for server-side form -->
            <slot name="signup-form" />

            <!-- Benefits -->
            <div :class="css({ mt: '4', pt: '4', borderTopWidth: '1px', borderColor: { base: 'gray.200', _dark: 'gray.700' } })">
              <h4 :class="css({ fontSize: 'xs', fontWeight: 'semibold', color: { base: 'gray.700', _dark: 'gray.300' }, mb: '3' })">What you'll get:</h4>
              <ul :class="css({ display: 'flex', flexDir: 'column', gap: '2', fontSize: 'xs', color: { base: 'gray.600', _dark: 'gray.400' } })">
                <li :class="css({ display: 'flex', alignItems: 'start', gap: '2' })">
                  <svg :class="css({ w: '4', h: '4', color: { base: 'green.600', _dark: 'green.400' }, mt: '0.5', flexShrink: '0' })" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Instant notifications for new modules</span>
                </li>
                <li :class="css({ display: 'flex', alignItems: 'start', gap: '2' })">
                  <svg :class="css({ w: '4', h: '4', color: { base: 'green.600', _dark: 'green.400' }, mt: '0.5', flexShrink: '0' })" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Access to course source code</span>
                </li>
                <li :class="css({ display: 'flex', alignItems: 'start', gap: '2' })">
                  <svg :class="css({ w: '4', h: '4', color: { base: 'green.600', _dark: 'green.400' }, mt: '0.5', flexShrink: '0' })" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Exclusive tips and best practices</span>
                </li>
                <li :class="css({ display: 'flex', alignItems: 'start', gap: '2' })">
                  <svg :class="css({ w: '4', h: '4', color: { base: 'green.600', _dark: 'green.400' }, mt: '0.5', flexShrink: '0' })" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
import { css } from "../../../styled-system/css";
import Button from "../common/Button.vue";

interface Author {
	name: string;
	avatarUrl?: string | undefined;
}

interface Props {
	title: string;
	description: string;
	moduleCount: number;
	totalDuration: string;
	difficulty: string;
	learningPath: string[];
	authors: Author[];
}

defineProps<Props>();
</script>

<style scoped>
.bg-grid-pattern {
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}
</style>
