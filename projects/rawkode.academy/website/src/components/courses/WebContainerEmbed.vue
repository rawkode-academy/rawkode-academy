<template>
 <div class="h-full flex flex-col bg-[var(--terminal-bg)] text-[var(--terminal-text)]">
 <!-- Header -->
 <div class="flex items-center justify-between p-4 bg-[var(--terminal-surface)] border-b border-[var(--terminal-border)]">
 <div class="flex items-center gap-4">
 <h3 class="text-lg font-semibold">{{ title }}</h3>
 <div v-if="status === 'booting'" class="flex items-center gap-2 text-sm text-[var(--terminal-text-dim)]">
 <div class="animate-spin rounded-full h-4 w-4 border-2 border-[var(--terminal-text-dim)] border-t-transparent"></div>
 <span>Starting container...</span>
 </div>
 <div v-else-if="status === 'installing'" class="flex items-center gap-2 text-sm text-primary">
 <div class="animate-pulse">●</div>
 <span>Installing dependencies...</span>
 </div>
 <div v-else-if="status === 'ready'" class="flex items-center gap-2 text-sm text-green-400">
 <div>●</div>
 <span>Ready</span>
 </div>
 </div>
 <div class="flex items-center gap-2">
 <button
 @click="restart"
 :disabled="status !== 'ready'"
 class="p-2 text-[var(--terminal-text-dim)] hover:text-[var(--terminal-text)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 title="Restart"
 >
 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
 </svg>
 </button>
 </div>
 </div>

 <!-- Split View -->
 <div class="flex-1 flex overflow-hidden">
 <!-- Editor -->
 <div class="w-1/2 flex flex-col border-r border-[var(--terminal-border)]">
 <div class="p-2 bg-[var(--terminal-surface)] border-b border-[var(--terminal-border)] relative z-10">
 <select
 v-model="selectedFile"
 class="w-full px-3 py-1 bg-[var(--terminal-bg)] text-[var(--terminal-text)] rounded border border-[var(--terminal-border)] hover:bg-[var(--terminal-surface)] focus:border-primary focus:outline-none cursor-pointer transition-colors"
 :disabled="fileList.length === 0"
 >
 <option v-if="fileList.length === 0" value="">No files loaded</option>
 <option v-for="file in fileList" :key="file" :value="file">
 {{ file }}
 </option>
 </select>
 </div>
 <div class="flex-1 relative">
 <textarea
 v-if="selectedFile && fileContents[selectedFile] !== undefined"
 v-model="fileContents[selectedFile]"
 @input="onFileChange"
 class="absolute inset-0 w-full h-full p-4 bg-[var(--terminal-bg)] text-[var(--terminal-text)] font-mono text-sm resize-none focus:outline-none"
 :placeholder="`Edit ${selectedFile}...`"
 spellcheck="false"
 ></textarea>
 <div v-else class="absolute inset-0 w-full h-full p-4 bg-[var(--terminal-bg)] text-[var(--terminal-text-dim)] font-mono text-sm">
 Select a file to edit
 </div>
 </div>
 </div>

 <!-- Preview -->
 <div class="w-1/2 flex flex-col">
 <div class="p-2 bg-[var(--terminal-surface)] border-b border-[var(--terminal-border)]">
 <div class="flex items-center gap-2">
 <span class="text-sm text-[var(--terminal-text-dim)]">Preview:</span>
 <a 
 v-if="previewUrl"
 :href="previewUrl" 
 target="_blank"
 rel="noopener noreferrer"
 class="text-sm text-primary hover:text-primary/90 underline decoration-primary/30 hover:decoration-primary transition-all cursor-pointer flex items-center gap-1"
 @click.stop
 >
 {{ previewUrl }}
 <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
 </svg>
 </a>
 <span v-else class="text-sm text-[var(--terminal-text-dim)] italic">{{ status === 'ready' ? 'Server ready (check terminal for URL)' : 'Waiting for server...' }}</span>
 </div>
 </div>
 <div class="flex-1 relative bg-[var(--surface-card)]">
 <iframe
 v-if="previewUrl"
 :src="previewUrl"
 class="absolute inset-0 w-full h-full"
 frameborder="0"
 ></iframe>
 <div v-else class="absolute inset-0 flex items-center justify-center text-muted">
 <div class="text-center">
 <svg class="w-16 h-16 mx-auto mb-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
 </svg>
 <p>Waiting for server...</p>
 </div>
 </div>
 </div>
 </div>
 </div>

 <!-- Terminal -->
 <div class="h-48 flex-shrink-0 bg-black border-t border-[var(--terminal-border)] overflow-hidden flex flex-col">
 <div class="p-2 bg-[var(--terminal-surface)] border-b border-[var(--terminal-border)] flex items-center justify-between">
 <span class="text-sm text-[var(--terminal-text-dim)]">Terminal</span>
 <button
 @click="clearTerminal"
 class="text-xs text-[var(--terminal-text-dim)] hover:text-[var(--terminal-text)] transition-colors"
 >
 Clear
 </button>
 </div>
 <div
 ref="terminalOutput"
 class="h-[calc(100%-2rem)] overflow-y-auto p-2 font-mono text-xs"
 >
 <div
 v-for="(line, index) in terminalLines"
 :key="index"
 :class="getTerminalLineClass(line)"
 v-html="formatTerminalLine(line)"
 ></div>
 </div>
 </div>
 </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { WebContainer } from "@webcontainer/api";

interface Props {
	title: string;
	files: Record<string, string>;
	startCommand?: string;
}

const props = defineProps<Props>();

// State
const webcontainerInstance = ref<WebContainer | null>(null);
const status = ref<"idle" | "booting" | "installing" | "ready" | "error">(
	"idle",
);
const selectedFile = ref("");
const fileContents = ref<Record<string, string>>({});
const terminalLines = ref<string[]>([]);
const previewUrl = ref("");
const terminalOutput = ref<HTMLElement>();

// Computed
const fileList = computed(() => {
	return Object.keys(fileContents.value);
});

// Methods
const writeTerminal = (
	text: string,
	type: "info" | "error" | "success" = "info",
) => {
	terminalLines.value.push(`[${type}] ${text}`);
	nextTick(() => {
		if (terminalOutput.value) {
			terminalOutput.value.scrollTop = terminalOutput.value.scrollHeight;
		}
	});
};

const clearTerminal = () => {
	terminalLines.value = [];
};

const getTerminalLineClass = (line: string) => {
	if (line.startsWith("[error]")) return "text-red-400";
	if (line.startsWith("[success]")) return "text-green-400";
	if (line.startsWith("[info]")) return "text-[var(--terminal-text)]";
	return "text-[var(--terminal-text-dim)]";
};

const formatTerminalLine = (line: string) => {
	return line.replace(/\[(\w+)\]\s/, "");
};

const mountFiles = async () => {
	if (!webcontainerInstance.value) return;

	// Create all necessary directories first
	const directories = new Set<string>();
	for (const path of Object.keys(props.files)) {
		const parts = path.split("/");
		for (let i = 1; i < parts.length; i++) {
			directories.add(parts.slice(0, i).join("/"));
		}
	}

	// Create directories
	for (const dir of directories) {
		try {
			await webcontainerInstance.value.fs.mkdir(dir, { recursive: true });
		} catch (e) {
			// Directory might already exist
		}
	}

	// Write files
	for (const [path, content] of Object.entries(props.files)) {
		await webcontainerInstance.value.fs.writeFile(path, content);
	}
};

const installDependencies = async () => {
	if (!webcontainerInstance.value) return;

	status.value = "installing";
	writeTerminal("Installing dependencies with npm...", "info");

	const installProcess = await webcontainerInstance.value.spawn("npm", [
		"install",
	]);

	installProcess.output.pipeTo(
		new WritableStream({
			write(data) {
				writeTerminal(data, "info");
			},
		}),
	);

	const installExitCode = await installProcess.exit;

	if (installExitCode !== 0) {
		throw new Error("Failed to install dependencies");
	}

	writeTerminal("Dependencies installed successfully!", "success");
};

const startDevServer = async () => {
	if (!webcontainerInstance.value) return;

	const command = props.startCommand || "npm run dev";
	const [cmd, ...args] = command.split(" ");

	writeTerminal(`Starting dev server: ${command}`, "info");

	try {
		const serverProcess = await webcontainerInstance.value.spawn(cmd, args);

		serverProcess.output.pipeTo(
			new WritableStream({
				write(data) {
					writeTerminal(data, "info");
				},
			}),
		);

		// Wait for server to be ready
		webcontainerInstance.value.on("server-ready", (port, url) => {
			previewUrl.value = url;
			status.value = "ready";
			writeTerminal(`Server ready at ${url}`, "success");
		});

		// Check exit code
		serverProcess.exit.then((exitCode) => {
			if (exitCode !== 0) {
				writeTerminal(`Server process exited with code ${exitCode}`, "error");
			}
		});
	} catch (error) {
		writeTerminal(`Failed to start server: ${error}`, "error");
	}
};

const onFileChange = async () => {
	if (!webcontainerInstance.value || !selectedFile.value) return;

	try {
		await webcontainerInstance.value.fs.writeFile(
			selectedFile.value,
			fileContents.value[selectedFile.value],
		);
	} catch (error) {
		writeTerminal(`Failed to save ${selectedFile.value}: ${error}`, "error");
	}
};

const restart = async () => {
	if (!webcontainerInstance.value) return;

	writeTerminal("Restarting container...", "info");
	previewUrl.value = "";
	status.value = "booting";

	// Kill existing processes
	await webcontainerInstance.value.teardown();

	// Reinitialize
	await initWebContainer();
};

const initWebContainer = async () => {
	try {
		status.value = "booting";
		writeTerminal("Booting WebContainer...", "info");

		webcontainerInstance.value = await WebContainer.boot();
		writeTerminal("WebContainer booted successfully!", "success");

		await mountFiles();
		writeTerminal("Files mounted successfully!", "success");

		// Only install if package.json exists
		if (props.files["package.json"]) {
			await installDependencies();
		}

		await startDevServer();
	} catch (error) {
		status.value = "error";
		writeTerminal(`Error: ${error}`, "error");
	}
};

// Lifecycle
onMounted(async () => {
	// Initialize file contents
	fileContents.value = { ...props.files };
	const files = Object.keys(props.files);
	selectedFile.value = files[0] || "";

	await initWebContainer();
});

onUnmounted(async () => {
	if (webcontainerInstance.value) {
		try {
			await webcontainerInstance.value.teardown();
		} catch (error) {
			writeTerminal(`Error during teardown: ${error}`, "error");
		}
	}
});

// Watch for external file changes
watch(
	() => props.files,
	(newFiles) => {
		fileContents.value = { ...newFiles };
		if (webcontainerInstance.value && status.value === "ready") {
			mountFiles();
		}
	},
	{ deep: true },
);
</script>
