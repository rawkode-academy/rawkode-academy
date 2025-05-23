<template>
  <div class="overflow-hidden bg-white py-24 sm:py-32">
										    <div class="mx-auto px-6 lg:px-8">
									      <div class="mx-auto grid grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:grid-cols-2">
								        <div class="lg:pr-8 lg:pt-4">
									          <div>
							            <h2 class="text-base font-semibold leading-7 text-indigo-600">Deploy faster</h2>
							            <p class="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">A better workflow</p>
							            <p class="mt-6 text-lg leading-8 text-gray-600">Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maiores impedit perferendis suscipit eaque, iste dolor cupiditate blanditiis ratione.</p>
								            <dl class="mt-10 space-y-8 text-base leading-7 text-gray-600">
					              <div v-for="feature in features" :key="feature.name" class="relative pl-9">
					                <dt class="inline font-semibold text-gray-900">
					                  <component :is="feature.icon" class="absolute left-1 top-1 h-5 w-5 text-indigo-600" aria-hidden="true" />
					                  {{ feature.name }}
					                </dt>
					                {{ ' ' }}
					                <dd class="inline">{{ feature.description }}</dd>
					              </div>
					            </dl>
					          </div>
					        </div>
						        <img src="https://tailwindui.com/img/component-images/dark-project-app-screenshot.png" alt="Product screenshot" class="w-3xl rounded-xl shadow-xl ring-1 ring-gray-400/10 sm:w-228 md:-ml-4 lg:-ml-0" width="2432" height="14
42" />
      </div>
    </div>
  </div>
</template>

<script setup>
import {
	CloudArrowUpIcon,
	LockClosedIcon,
	ServerIcon,
} from "@heroicons/vue/20/solid";

const features = [
	{
		name: "Push to deploy.",
		description:
			"Lorem ipsum, dolor sit amet consectetur adipisicing elit. Maiores impedit perferendis suscipit eaque, iste dolor cupiditate blanditiis ratione.",
		icon: CloudArrowUpIcon,
	},
	{
		name: "SSL certificates.",
		description:
			"Anim aute id magna aliqua ad ad non deserunt sunt. Qui irure qui lorem cupidatat commodo.",
		icon: LockClosedIcon,
	},
	{
		name: "Database backups.",
		description:
			"Ac tincidunt sapien vehicula erat auctor pellentesque rhoncus. Et magna sit morbi lobortis.",
		icon: ServerIcon,
	},
];
</script>
