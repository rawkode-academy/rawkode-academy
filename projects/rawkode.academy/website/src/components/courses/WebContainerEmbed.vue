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
import { ref, shallowRef, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { WebContainer } from "@webcontainer/api";

interface Props {
	title: string;
	files: Record<string, string>;
	startCommand?: string | undefined;
}

const props = defineProps<Props>();

// State
const webcontainerInstance = shallowRef<WebContainer | null>(null);
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

let generation = 0;
let disposed = false;
let stopServerListener: (() => void) | undefined;
const isCurrent = (run: number) => !disposed && run === generation;

const mountFiles = async (instance: WebContainer, files: Record<string, string>) => {
	const directories = new Set<string>();
	for (const path of Object.keys(files)) {
		const parts = path.split("/");
		for (let i = 1; i < parts.length; i++) directories.add(parts.slice(0, i).join("/"));
	}
	for (const dir of directories) await instance.fs.mkdir(dir, { recursive: true });
	for (const [path, content] of Object.entries(files)) await instance.fs.writeFile(path, content);
};

const pipeOutput = (output: ReadableStream<string>, run: number) => {
	void output.pipeTo(new WritableStream({
		write(data) { if (isCurrent(run)) writeTerminal(data); },
	})).catch(error => {
		if (isCurrent(run)) writeTerminal(`Terminal output unavailable: ${error}`, "error");
	});
};

const startDevServer = async (instance: WebContainer, run: number) => {
	const command = props.startCommand?.trim() || "npm run dev";
	const [cmd = "npm", ...args] = command.split(/\s+/);
	writeTerminal(`Starting dev server: ${command}`);
	// Subscribe before spawning: a fast server can become ready during spawn.
	stopServerListener = instance.on("server-ready", (_port, url) => {
		if (!isCurrent(run)) return;
		previewUrl.value = url;
		status.value = "ready";
		writeTerminal(`Server ready at ${url}`, "success");
	});
	const server = await instance.spawn(cmd, args);
	if (!isCurrent(run)) return;
	pipeOutput(server.output, run);
	void server.exit.then(code => {
		if (!isCurrent(run)) return;
		previewUrl.value = "";
		status.value = "error";
		writeTerminal(`Server stopped with code ${code}. Restart to try again.`, "error");
	}).catch(error => {
		if (!isCurrent(run)) return;
		status.value = "error";
		previewUrl.value = "";
		writeTerminal(`Server failed: ${error}`, "error");
	});
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

const stopContainer = () => {
	generation++;
	stopServerListener?.();
	stopServerListener = undefined;
	webcontainerInstance.value?.teardown();
	webcontainerInstance.value = null;
	previewUrl.value = "";
};

const initWebContainer = async () => {
	const run = ++generation;
	try {
		status.value = "booting";
		writeTerminal("Booting WebContainer...");
		const instance = await WebContainer.boot();
		if (!isCurrent(run)) { instance.teardown(); return; }
		webcontainerInstance.value = instance;
		await mountFiles(instance, { ...fileContents.value });
		if (!isCurrent(run)) return;
		if (fileContents.value["package.json"]) {
			status.value = "installing";
			writeTerminal("Installing dependencies with npm...");
			const install = await instance.spawn("npm", ["install"]);
			if (!isCurrent(run)) return;
			pipeOutput(install.output, run);
			const code = await install.exit;
			if (!isCurrent(run)) return;
			if (code !== 0) throw new Error("Failed to install dependencies");
		}
		await startDevServer(instance, run);
	} catch (error) {
		if (!isCurrent(run)) return;
		status.value = "error";
		writeTerminal(`Error: ${error}`, "error");
	}
};

const restart = async () => {
	stopContainer();
	await initWebContainer();
};

onMounted(() => {
	fileContents.value = { ...props.files };
	selectedFile.value = Object.keys(props.files)[0] || "";
	void initWebContainer();
});
onUnmounted(() => { disposed = true; stopContainer(); });

watch(() => props.files, newFiles => {
	fileContents.value = { ...newFiles };
	if (!(selectedFile.value in newFiles)) selectedFile.value = Object.keys(newFiles)[0] || "";
	const instance = webcontainerInstance.value;
	if (instance && status.value === "ready") {
		void mountFiles(instance, { ...newFiles }).catch(error => {
			if (!disposed) writeTerminal(`Failed to update files: ${error}`, "error");
		});
	}
}, { deep: true });
</script>
