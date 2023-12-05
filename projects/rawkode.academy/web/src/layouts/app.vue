<script setup lang="ts">
import {
Dialog,
DialogPanel,
Menu,
MenuButton,
MenuItem,
MenuItems,
TransitionChild,

TransitionRoot,
} from '@headlessui/vue';
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/vue/20/solid';
import {
AcademicCapIcon,
Bars3Icon,
BellIcon,
BuildingOfficeIcon,
CalendarDaysIcon,
ChatBubbleLeftEllipsisIcon,
Cog6ToothIcon,
FilmIcon,
HomeIcon,
InformationCircleIcon,
MegaphoneIcon,
NewspaperIcon,
QuestionMarkCircleIcon,
RocketLaunchIcon,
UsersIcon,
VideoCameraIcon,
XMarkIcon
} from '@heroicons/vue/24/outline';
import { ref } from 'vue';

const navigation = [
	{ name: 'Dashboard', href: '#', icon: HomeIcon, current: false },
	{ name: 'Events', href: '#', icon: CalendarDaysIcon, current: false },
	{ name: 'Courses', href: '#', icon: AcademicCapIcon, current: false },
	{ name: 'Shows', href: '#', icon: FilmIcon, current: true },
	{ name: 'All Videos', href: '#', icon: VideoCameraIcon, current: false },
	{ name: 'Articles', href: '#', icon: NewspaperIcon, current: false },
	{ name: 'Community', href: '#', icon: UsersIcon, current: false },
	{ name: 'About', href: '#', icon: InformationCircleIcon, current: false },
	{ name: 'Help', href: '#', icon: QuestionMarkCircleIcon, current: false },
];

const partnerHeadline = "For Organizations"
const teams = [
	{ name: 'Memberships', href: '#', icon: BuildingOfficeIcon, current: false },
	{ name: 'Sponsorships', href: '#', icon: MegaphoneIcon, current: false },
	{ name: 'Collaborations', href: '#', icon: RocketLaunchIcon, current: false },
	{ name: "Let's Chat", href: '#', icon: ChatBubbleLeftEllipsisIcon, current: false },
]
const userNavigation = [
	{ name: 'Your profile', href: '#' },
	{ name: 'Sign out', href: '#' },
]

const sidebarOpen = ref(false)

const pages = [
	{ name: 'Projects', href: '#', current: false },
	{ name: 'Project Nero', href: '#', current: true },
];
</script>


<template>
	<div>
		<TransitionRoot as="template" :show="sidebarOpen">
			<Dialog as="div" class="relative z-50 lg:hidden" @close="sidebarOpen = false">
				<TransitionChild as="template" enter="transition-opacity ease-linear duration-300" enter-from="opacity-0"
					enter-to="opacity-100" leave="transition-opacity ease-linear duration-300" leave-from="opacity-100"
					leave-to="opacity-0">
					<div class="fixed inset-0 bg-gray-900/80" />
				</TransitionChild>

				<div class="fixed inset-0 flex">
					<TransitionChild as="template" enter="transition ease-in-out duration-300 transform"
						enter-from="-translate-x-full" enter-to="translate-x-0" leave="transition ease-in-out duration-300 transform"
						leave-from="translate-x-0" leave-to="-translate-x-full">
						<DialogPanel class="relative mr-16 flex w-full max-w-xs flex-1">
							<TransitionChild as="template" enter="ease-in-out duration-300" enter-from="opacity-0"
								enter-to="opacity-100" leave="ease-in-out duration-300" leave-from="opacity-100" leave-to="opacity-0">
								<div class="absolute left-full top-0 flex w-16 justify-center pt-5">
									<button type="button" class="-m-2.5 p-2.5" @click="sidebarOpen = false">
										<span class="sr-only">Close sidebar</span>
										<XMarkIcon class="h-6 w-6 text-white" aria-hidden="true" />
									</button>
								</div>
							</TransitionChild>
							<!-- Sidebar component, swap this element with another sidebar if you like -->
							<div class="flex grow flex-col gap-y-5 overflow-y-auto bg-gray-900 px-6 pb-4 ring-1 ring-white/10">
								<div class="flex h-16 shrink-0 items-center">
									<img class="h-8 w-auto" src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=500"
										alt="Your Company" />
								</div>
								<nav class="flex flex-1 flex-col">
									<ul role="list" class="flex flex-1 flex-col gap-y-7">
										<li>
											<ul role="list" class="-mx-2 space-y-1">
												<li v-for="item in navigation" :key="item.name">
													<a :href="item.href"
														:class="[item.current ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800', 'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold']">
														<component :is="item.icon" class="h-6 w-6 shrink-0" aria-hidden="true" />
														{{ item.name }}
													</a>
												</li>
											</ul>
										</li>
										<li>
											<div class="text-xs font-semibold leading-6 text-gray-400">{{ partnerHeadline }}</div>
											<ul role="list" class="-mx-2 mt-2 space-y-1">
												<li v-for="item in teams" :key="item.name">
													<a :href="item.href"
														:class="[item.current ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800', 'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold']">
														<component :is="item.icon" class="h-6 w-6 shrink-0" aria-hidden="true" />
														{{ item.name }}
													</a>
												</li>
											</ul>
										</li>
										<li class="mt-auto">
											<a href="#"
												class="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-400 hover:bg-gray-800 hover:text-white">
												<Cog6ToothIcon class="h-6 w-6 shrink-0" aria-hidden="true" />
												Settings
											</a>
										</li>
									</ul>
								</nav>
							</div>
						</DialogPanel>
					</TransitionChild>
				</div>
			</Dialog>
		</TransitionRoot>

		<!-- Static sidebar for desktop -->
		<div class="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
			<!-- Sidebar component, swap this element with another sidebar if you like -->
			<div class="flex grow flex-col gap-y-5 overflow-y-auto bg-gray-900 px-6 pb-4">
				<div class="flex h-16 shrink-0 items-center">
					<img class="h-8 w-auto" src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=500"
						alt="Your Company" />
				</div>
				<nav class="flex flex-1 flex-col">
					<ul role="list" class="flex flex-1 flex-col gap-y-7">
						<li>
							<ul role="list" class="-mx-2 space-y-1">
								<li v-for="item in navigation" :key="item.name">
									<a :href="item.href"
										:class="[item.current ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800', 'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold']">
										<component :is="item.icon" class="h-6 w-6 shrink-0" aria-hidden="true" />
										{{ item.name }}
									</a>
								</li>
							</ul>
						</li>
						<li>
							<div class="text-xs font-semibold leading-6 text-gray-400">{{ partnerHeadline }}</div>
							<ul role="list" class="-mx-2 mt-2 space-y-1">
								<li v-for="item in teams" :key="item.name">
									<a :href="item.href"
										:class="[item.current ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800', 'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold']">
										<component :is="item.icon" class="h-6 w-6 shrink-0" aria-hidden="true" />
										{{ item.name }}
									</a>
								</li>
							</ul>
						</li>
						<li class="mt-auto">
							<a href="#"
								class="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-400 hover:bg-gray-800 hover:text-white">
								<Cog6ToothIcon class="h-6 w-6 shrink-0" aria-hidden="true" />
								Settings
							</a>
						</li>
					</ul>
				</nav>
			</div>
		</div>

		<div class="lg:pl-72 ">
			<div
				class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-gray-900 px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
				<button type="button" class="-m-2.5 p-2.5 text-red-700 lg:hidden" @click="sidebarOpen = true">
					<span class="sr-only">Open sidebar</span>
					<Bars3Icon class="h-6 w-6" aria-hidden="true" />
				</button>

				<!-- Separator -->
				<div class="h-6 w-px bg-gray-900/10 lg:hidden" aria-hidden="true" />

				<div class="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 ">
					<form class="relative flex flex-1" action="#" method="GET">
						<label for="search-field" class="sr-only">Search</label>
						<MagnifyingGlassIcon class="bg-gray-900 pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-white"
							aria-hidden="true" />
						<input id="search-field"
							class="block bg-gray-900 h-full w-full border-0 py-0 pl-8 pr-0 text-white placeholder:text-gray-400 focus:ring-0 sm:text-sm"
							placeholder="Search..." type="search" name="search" />
					</form>
					<div class="flex items-center gap-x-4 lg:gap-x-6">
						<button type="button" class="-m-2.5 p-2.5 text-white hover:text-gray-500">
							<span class="sr-only">View notifications</span>
							<BellIcon class="h-6 w-6" aria-hidden="true" />
						</button>

						<!-- Separator -->
						<div class="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-900/10" aria-hidden="true" />

						<!-- Profile dropdown -->
						<Menu as="div" class="relative">
							<MenuButton class="-m-1.5 flex items-center p-1.5">
								<span class="sr-only">Open user menu</span>
								<img class="h-8 w-8 rounded-full bg-gray-50"
									src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
									alt="" />
								<span class="hidden lg:flex lg:items-center">
									<span class="ml-4 text-sm font-semibold leading-6 text-white" aria-hidden="true">Tom Cook</span>
									<ChevronDownIcon class="ml-2 h-5 w-5 text-gray-400" aria-hidden="true" />
								</span>
							</MenuButton>
							<transition enter-active-class="transition ease-out duration-100"
								enter-from-class="transform opacity-0 scale-95" enter-to-class="transform opacity-100 scale-100"
								leave-active-class="transition ease-in duration-75" leave-from-class="transform opacity-100 scale-100"
								leave-to-class="transform opacity-0 scale-95">
								<MenuItems
									class="absolute right-0 z-10 mt-2.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none">
									<MenuItem v-for="item in userNavigation" :key="item.name" v-slot="{ active }">
									<a :href="item.href"
										:class="[active ? 'bg-gray-50' : '', 'block px-3 py-1 text-sm leading-6 text-gray-900']">{{
											item.name }}</a>
									</MenuItem>
								</MenuItems>
							</transition>
						</Menu>

					</div>

				</div>
			</div>


			<nav class="flex border-b border-gray-200 bg-white" aria-label="Breadcrumb">
				<ol role="list" class="flex w-full max-w-screen-xl space-x-4 px-4 sm:px-6 lg:px-8">
					<li class="flex">
						<div class="flex items-center">
							<a href="#" class="text-gray-400 hover:text-gray-500">
								<HomeIcon class="h-5 w-5 flex-shrink-0" aria-hidden="true" />
								<span class="sr-only">Home</span>
							</a>
						</div>
					</li>
					<li v-for="page in pages" :key="page.name" class="flex">
						<div class="flex items-center">
							<svg class="h-full w-6 flex-shrink-0 text-gray-200" viewBox="0 0 24 44" preserveAspectRatio="none"
								fill="currentColor" aria-hidden="true">
								<path d="M.293 0l22 22-22 22h1.414l22-22-22-22H.293z" />
							</svg>
							<a :href="page.href" class="ml-4 text-sm font-medium text-gray-500 hover:text-gray-700"
								:aria-current="page.current ? 'page' : undefined">{{ page.name }}</a>
						</div>
					</li>
				</ol>
			</nav>

			<main class="py-10">

				<div class="px-4 sm:px-6 lg:px-8">

					<slot />
				</div>
			</main>
		</div>
	</div>
</template>

