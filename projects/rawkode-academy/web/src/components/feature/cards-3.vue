<script setup lang="ts">
interface Props {
	title: string;
}
defineProps<Props>();
</script>

<template>
	<section class="pt-12 pb-40 overflow-hidden">
		<div class="container px-4 mx-auto">
			<h2 class="mb-20 text-6xl md:text-8xl xl:text-10xl font-bold font-heading text-center tracking-px-n leading-none">
				{{ title }}</h2>
			<div class="flex flex-wrap -m-16 md:-m-3">
				<div class="w-full md:w-1/3 p-16 md:p-3">
					<div class="px-10 pt-11 text-center bg-gray-100 h-96 rounded-4xl">
						<h3 class="mb-3 text-xl font-bold font-heading leading-normal">Authenticity</h3>
						<p class="mb-10 text-gray-600 font-medium leading-relaxed">The Rawkode Academy instructors are Staff+
							developers, so we don't teach people Hello, World! We do deep dive content that helps other Staff+
							developers solve real world problems.</p>
						<img
							class="mx-auto h-72 object-cover rounded-3xl shadow-3xl transform hover:translate-y-3 transition ease-in-out duration-1000"
							src="https://static.shuffle.dev/uploads/files/87/8793fff1e1a8f34e2bae79583d28f545e3bc5f34/headshot.jpg"
							alt="">
					</div>
				</div>
				<div class="w-full md:w-1/3 p-16 md:p-3">
					<div class="px-10 pt-11 text-center bg-gray-100 h-96 rounded-4xl">
						<h3 class="mb-3 text-xl font-bold font-heading leading-normal">Hands-On</h3>
						<p class="mb-10 text-gray-600 font-medium leading-relaxed">All our tutorials are hands-on, showing people
							step by step how to tackle the complexitiers of the Cloud Native development.</p>
						<img
							class="mx-auto h-72 object-cover rounded-3xl shadow-3xl transform hover:translate-y-3 transition ease-in-out duration-1000"
							src="https://static.shuffle.dev/uploads/files/87/8793fff1e1a8f34e2bae79583d28f545e3bc5f34/Screenshot-from-2024-08-05-16-27-50.png"
							alt="">
					</div>
				</div>
				<div class="w-full md:w-1/3 p-16 md:p-3">
					<div class="px-10 pt-11 text-center bg-gray-100 h-96 rounded-4xl">
						<h3 class="mb-3 text-xl font-bold font-heading leading-normal">Your Product Here!</h3>
						<p class="mb-10 text-gray-600 font-medium leading-relaxed">If we believe your product, open or closed
							source, can truly help our audience; we're happy to feature you as a partner.</p>
						<img
							class="mx-auto h-72 object-cover rounded-3xl shadow-3xl transform hover:translate-y-3 transition ease-in-out duration-1000"
							src="https://static.shuffle.dev/uploads/files/87/8793fff1e1a8f34e2bae79583d28f545e3bc5f34/images.png"
							alt="">
					</div>
				</div>
			</div>
		</div>
	</section>
</template>
