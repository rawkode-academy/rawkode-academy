<template>
  <div class="bg-white dark:bg-gray-900 py-24 sm:py-32">
											    <div class="mx-auto px-6 lg:px-8">
										      <div class="mx-auto lg:text-center">
							        <h2>Deploy faster</h2>
							        <p class="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Everything you need to deploy your app</p>
							        <p class="mt-6 text-lg leading-8 text-gray-600">Quis tellus eget adipiscing convallis sit sit eget aliquet quis. Suspendisse eget egestas a elementum pulvinar et feugiat blandit at. In mi viverra elit nunc.</p>
							      </div>
							      <div class="mx-auto mt-16 sm:mt-20 lg:mt-24">
								        <dl class="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-2 lg:gap-y-16">
          <div v-for="feature in features" :key="feature.name" class="relative pl-16">
            <dt class="text-base font-semibold leading-7 text-gray-900 dark:text-white">
              <div class="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <component :is="feature.icon" class="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              {{ feature.name }}
            </dt>
            <dd class="mt-2 text-base leading-7 text-gray-600 dark:text-gray-400">{{ feature.description }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
	ArrowPathIcon,
	CloudArrowUpIcon,
	FingerPrintIcon,
	LockClosedIcon,
} from "@heroicons/vue/24/outline";

const features = [
	{
		name: "Push to deploy",
		description:
			"Morbi viverra dui mi arcu sed. Tellus semper adipiscing suspendisse semper morbi. Odio urna massa nunc massa.",
		icon: CloudArrowUpIcon,
	},
	{
		name: "SSL certificates",
		description:
			"Sit quis amet rutrum tellus ullamcorper ultricies libero dolor eget. Sem sodales gravida quam turpis enim lacus amet.",
		icon: LockClosedIcon,
	},
	{
		name: "Simple queues",
		description:
			"Quisque est vel vulputate cursus. Risus proin diam nunc commodo. Lobortis auctor congue commodo diam neque.",
		icon: ArrowPathIcon,
	},
	{
		name: "Advanced security",
		description:
			"Arcu egestas dolor vel iaculis in ipsum mauris. Tincidunt mattis aliquet hac quis. Id hac maecenas ac donec pharetra eget.",
		icon: FingerPrintIcon,
	},
];
</script>
