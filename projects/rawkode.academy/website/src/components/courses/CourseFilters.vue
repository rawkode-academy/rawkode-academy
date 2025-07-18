<template>
  <div class="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
    <div class="container mx-auto px-4 py-4">
      <div class="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <!-- Search -->
        <div class="relative w-full lg:w-96">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search courses..."
            class="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            @input="$emit('search', searchQuery)"
          />
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
        
        <!-- Filters -->
        <div class="flex flex-wrap gap-2">
          <!-- Difficulty filter -->
          <div class="relative">
            <button
              @click="showDifficultyMenu = !showDifficultyMenu"
              class="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <span>Difficulty</span>
              <Badge v-if="selectedDifficulty" size="xs" :variant="getDifficultyVariant(selectedDifficulty)">
                {{ selectedDifficulty }}
              </Badge>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            
            <!-- Dropdown -->
            <div
              v-if="showDifficultyMenu"
              class="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden"
            >
              <button
                v-for="difficulty in ['all', 'beginner', 'intermediate', 'advanced']"
                :key="difficulty"
                @click="selectDifficulty(difficulty)"
                class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
                :class="{ 'bg-gray-100 dark:bg-gray-700': selectedDifficulty === difficulty || (difficulty === 'all' && !selectedDifficulty) }"
              >
                <span class="capitalize">{{ difficulty === 'all' ? 'All Levels' : difficulty }}</span>
                <Badge v-if="difficulty !== 'all'" size="xs" :variant="getDifficultyVariant(difficulty)">
                  {{ difficulty }}
                </Badge>
              </button>
            </div>
          </div>
          
          <!-- Technology filter -->
          <div class="relative">
            <button
              @click="showTechMenu = !showTechMenu"
              class="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <span>Technology</span>
              <Badge v-if="selectedTechnologies.length > 0" size="xs" variant="primary">
                {{ selectedTechnologies.length }}
              </Badge>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            
            <!-- Dropdown -->
            <div
              v-if="showTechMenu"
              class="absolute top-full mt-2 right-0 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden max-h-80 overflow-y-auto"
            >
              <div class="p-2">
                <button
                  v-for="tech in availableTechnologies"
                  :key="tech"
                  @click="toggleTechnology(tech)"
                  class="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2"
                >
                  <input
                    type="checkbox"
                    :checked="selectedTechnologies.includes(tech)"
                    class="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                  />
                  <span>{{ tech }}</span>
                </button>
              </div>
            </div>
          </div>
          
          <!-- Sort -->
          <div class="relative">
            <button
              @click="showSortMenu = !showSortMenu"
              class="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"></path>
              </svg>
              <span>Sort</span>
            </button>
            
            <!-- Dropdown -->
            <div
              v-if="showSortMenu"
              class="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden"
            >
              <button
                v-for="option in sortOptions"
                :key="option.value"
                @click="selectSort(option.value)"
                class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                :class="{ 'bg-gray-100 dark:bg-gray-700': selectedSort === option.value }"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          
          <!-- Clear filters -->
          <button
            v-if="hasActiveFilters"
            @click="clearFilters"
            class="px-4 py-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Clear filters
          </button>
        </div>
      </div>
      
      <!-- Active filters pills -->
      <div v-if="hasActiveFilters" class="mt-3 flex flex-wrap gap-2">
        <div
          v-if="selectedDifficulty"
          class="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm"
        >
          <span>Difficulty:</span>
          <Badge size="xs" :variant="getDifficultyVariant(selectedDifficulty)">
            {{ selectedDifficulty }}
          </Badge>
          <button @click="selectedDifficulty = ''" class="ml-1 hover:text-red-600">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div
          v-for="tech in selectedTechnologies"
          :key="tech"
          class="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm"
        >
          <span>{{ tech }}</span>
          <button @click="toggleTechnology(tech)" class="ml-1 hover:text-red-600">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import Badge from "../common/Badge.vue";

interface Props {
	availableTechnologies: string[];
}

const props = defineProps<Props>();

const searchQuery = ref("");
const selectedDifficulty = ref("");
const selectedTechnologies = ref<string[]>([]);
const selectedSort = ref("newest");

const showDifficultyMenu = ref(false);
const showTechMenu = ref(false);
const showSortMenu = ref(false);

const sortOptions = [
	{ value: "newest", label: "Newest First" },
	{ value: "oldest", label: "Oldest First" },
	{ value: "title", label: "Title (A-Z)" },
	{ value: "difficulty", label: "Difficulty" },
];

const hasActiveFilters = computed(() => {
	return (
		searchQuery.value ||
		selectedDifficulty.value ||
		selectedTechnologies.value.length > 0
	);
});

const emit = defineEmits<{
	search: [query: string];
	filterChange: [
		filters: { difficulty: string; technologies: string[]; sort: string },
	];
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

function selectDifficulty(difficulty: string) {
	selectedDifficulty.value = difficulty === "all" ? "" : difficulty;
	showDifficultyMenu.value = false;
	emitFilterChange();
}

function toggleTechnology(tech: string) {
	const index = selectedTechnologies.value.indexOf(tech);
	if (index > -1) {
		selectedTechnologies.value.splice(index, 1);
	} else {
		selectedTechnologies.value.push(tech);
	}
	emitFilterChange();
}

function selectSort(sort: string) {
	selectedSort.value = sort;
	showSortMenu.value = false;
	emitFilterChange();
}

function clearFilters() {
	searchQuery.value = "";
	selectedDifficulty.value = "";
	selectedTechnologies.value = [];
	selectedSort.value = "newest";
	emit("search", "");
	emitFilterChange();
}

function emitFilterChange() {
	emit("filterChange", {
		difficulty: selectedDifficulty.value,
		technologies: selectedTechnologies.value,
		sort: selectedSort.value,
	});
}

// Close dropdowns when clicking outside
if (typeof window !== "undefined") {
	window.addEventListener("click", (e) => {
		const target = e.target as HTMLElement;
		if (!target.closest(".relative")) {
			showDifficultyMenu.value = false;
			showTechMenu.value = false;
			showSortMenu.value = false;
		}
	});
}
</script>