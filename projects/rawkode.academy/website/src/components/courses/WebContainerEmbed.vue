<template>
 <div :class="s.workbench">
 <!-- Header -->
 <div :class="s.toolbar">
 <div :class="s.actions">
 <h3 :class="s.title">{{ title }}</h3>
 <div v-if="status === 'booting'" :class="s.status">
 <div :class="s.spinner"></div>
 <span>Starting container...</span>
 </div>
 <div v-else-if="status === 'installing'" :class="s.status">
 <div :class="s.status">●</div>
 <span>Installing dependencies...</span>
 </div>
 <div v-else-if="status === 'error'" :class="s.error" role="alert">Container unavailable. Check the terminal for details, then retry.</div>
 <div v-else-if="status === 'ready'" :class="s.ready">
 <div>●</div>
 <span>Ready</span>
 </div>
 </div>
 <div :class="s.actions">
 <button
 @click="restart"
 :disabled="status !== 'ready' && status !== 'error'"
 :class="s.button"
 title="Restart"
 aria-label="Restart container"
 type="button"
 >
 <svg :class="s.icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
 </svg>
 </button>
 </div>
 </div>

 <!-- Split View -->
 <div :class="s.split">
 <!-- Editor -->
 <div :class="s.pane">
 <div :class="s.filebar">
 <select
 v-model="selectedFile"
 aria-label="File to edit"
 :class="s.select"
 :disabled="fileList.length === 0"
 >
 <option v-if="fileList.length === 0" value="">No files loaded</option>
 <option v-for="file in fileList" :key="file" :value="file">
 {{ file }}
 </option>
 </select>
 </div>
 <div :class="s.editorFrame">
 <textarea
 v-if="selectedFile && fileContents[selectedFile] !== undefined"
 v-model="fileContents[selectedFile]"
 :aria-label="`Edit ${selectedFile}`"
 @input="onFileChange"
 :class="s.editor"
 :placeholder="`Edit ${selectedFile}...`"
 spellcheck="false"
 ></textarea>
 <div v-else :class="s.placeholder">
 Select a file to edit
 </div>
 </div>
 </div>

 <!-- Preview -->
 <div :class="s.pane">
 <div :class="s.filebar">
 <div :class="s.actions">
 <span :class="s.status">Preview:</span>
 <a 
 v-if="previewUrl"
 :href="previewUrl" 
 target="_blank"
 rel="noopener noreferrer"
 :class="s.link"
 @click.stop
 >
 {{ previewUrl }}
 <svg :class="s.smallIcon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
 </svg>
 </a>
 <span v-else :class="s.status">{{ status === 'ready' ? 'Server ready (check terminal for URL)' : 'Waiting for server...' }}</span>
 </div>
 </div>
 <div :class="s.editorFrame">
 <iframe
 v-if="previewUrl"
 :src="previewUrl"
 :title="`${title} preview`"
 :class="s.preview"
 frameborder="0"
 ></iframe>
 <div v-else :class="s.placeholder">
 <div :class="s.placeholder">
 <svg :class="s.icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
 </svg>
 <p>Waiting for server...</p>
 </div>
 </div>
 </div>
 </div>
 </div>

 <!-- Terminal -->
 <div :class="s.terminal">
 <div :class="s.toolbar">
 <span :class="s.status">Terminal</span>
 <button
 @click="clearTerminal"
 :class="s.button"
 >
 Clear
 </button>
 </div>
 <div
 ref="terminalOutput"
 :class="s.terminalOutput"
 >
 <div
 v-for="(line, index) in terminalLines"
 :key="index"
 :class="getTerminalLineClass(line)"
 v-text="formatTerminalLine(line)"
 ></div>
 </div>
 </div>
 </div>
</template>

<script setup lang="ts">
import { academyCourse } from "@rawkodeacademy/design-system";
const s = academyCourse();
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { WebContainer } from "@webcontainer/api";

interface Props {
	title: string;
	files: Record<string, string>;
	startCommand?: string | undefined;
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
	if (line.startsWith("[error]")) return s.error;
	if (line.startsWith("[success]")) return s.ready;
	if (line.startsWith("[info]")) return s.terminalLine;
	return s.terminalLine;
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
	const [cmd = "npm", ...args] = command.trim().split(/\s+/);

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
		webcontainerInstance.value.on("server-ready", (_port, url) => {
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
			fileContents.value[selectedFile.value] ?? "",
		);
	} catch (error) {
		writeTerminal(`Failed to save ${selectedFile.value}: ${error}`, "error");
	}
};

const restart = async () => {

	writeTerminal("Restarting container...", "info");
	previewUrl.value = "";
	status.value = "booting";

	// Kill existing processes
	await webcontainerInstance.value?.teardown();
	webcontainerInstance.value = null;

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
