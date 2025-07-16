<template>
  <div class="h-screen flex flex-col bg-gray-900 text-gray-100">
    <!-- Header -->
    <div class="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
      <div class="flex items-center gap-4">
        <div v-if="status === 'booting'" class="flex items-center gap-2 text-sm text-gray-400">
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
          <span>Starting container...</span>
        </div>
        <div v-else-if="status === 'installing'" class="flex items-center gap-2 text-sm text-blue-400">
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
          class="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
      <div class="w-1/2 flex flex-col border-r border-gray-700">
        <div class="p-2 bg-gray-800 border-b border-gray-700 relative z-10">
          <select
            v-model="selectedFile"
            class="w-full px-3 py-1 bg-gray-700 text-white rounded border border-gray-600 hover:bg-gray-600 focus:border-blue-500 focus:outline-none cursor-pointer transition-colors"
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
            class="absolute inset-0 w-full h-full p-4 bg-gray-900 text-gray-100 font-mono text-sm resize-none focus:outline-none"
            :placeholder="`Edit ${selectedFile}...`"
            spellcheck="false"
          ></textarea>
          <div v-else class="absolute inset-0 w-full h-full p-4 bg-gray-900 text-gray-500 font-mono text-sm">
            Select a file to edit
          </div>
        </div>
      </div>

      <!-- Preview -->
      <div class="w-1/2 flex flex-col">
        <div class="p-2 bg-gray-800 border-b border-gray-700">
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-400">Preview:</span>
            <a 
              v-if="previewUrl"
              :href="previewUrl" 
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm text-blue-500 hover:text-blue-400 underline decoration-blue-500/30 hover:decoration-blue-400 transition-all cursor-pointer flex items-center gap-1"
              @click.stop
            >
              {{ previewUrl }}
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
              </svg>
            </a>
            <span v-else class="text-sm text-gray-500 italic">{{ status === 'ready' ? 'Server ready (check terminal for URL)' : 'Waiting for server...' }}</span>
          </div>
        </div>
        <div class="flex-1 relative bg-white">
          <iframe
            v-if="previewUrl"
            :src="previewUrl"
            class="absolute inset-0 w-full h-full"
            frameborder="0"
          ></iframe>
          <div v-else class="absolute inset-0 flex items-center justify-center text-gray-500">
            <div class="text-center">
              <svg class="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p>Waiting for server...</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Terminal -->
    <div class="h-48 flex-shrink-0 bg-black border-t border-gray-700 overflow-hidden flex flex-col">
      <div class="p-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <span class="text-sm text-gray-400">Terminal</span>
        <button
          @click="clearTerminal"
          class="text-xs text-gray-500 hover:text-gray-300 transition-colors"
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { WebContainer } from '@webcontainer/api';

interface Props {
  title: string;
  files: Record<string, string>;
  startCommand?: string;
}

const props = defineProps<Props>();

// State
const webcontainerInstance = ref<WebContainer | null>(null);
const status = ref<'idle' | 'booting' | 'installing' | 'ready' | 'error'>('idle');
const selectedFile = ref('');
const fileContents = ref<Record<string, string>>({});
const terminalLines = ref<string[]>([]);
const previewUrl = ref('');
const terminalOutput = ref<HTMLElement>();

// Computed
const fileList = computed(() => {
  return Object.keys(fileContents.value);
});

// Methods
const writeTerminal = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
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
  if (line.startsWith('[error]')) return 'text-red-400';
  if (line.startsWith('[success]')) return 'text-green-400';
  if (line.startsWith('[info]')) return 'text-gray-300';
  return 'text-gray-400';
};

const formatTerminalLine = (line: string) => {
  return line.replace(/\[(\w+)\]\s/, '');
};

const mountFiles = async () => {
  if (!webcontainerInstance.value) return;

  // Create all necessary directories first
  const directories = new Set<string>();
  for (const path of Object.keys(props.files)) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      directories.add(parts.slice(0, i).join('/'));
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
  
  status.value = 'installing';
  writeTerminal('Installing dependencies with npm...', 'info');

  const installProcess = await webcontainerInstance.value.spawn('npm', ['install']);
  
  installProcess.output.pipeTo(new WritableStream({
    write(data) {
      writeTerminal(data, 'info');
    }
  }));

  const installExitCode = await installProcess.exit;
  
  if (installExitCode !== 0) {
    throw new Error('Failed to install dependencies');
  }
  
  writeTerminal('Dependencies installed successfully!', 'success');
};

const startDevServer = async () => {
  if (!webcontainerInstance.value) return;

  const command = props.startCommand || 'npm run dev';
  const [cmd, ...args] = command.split(' ');
  
  writeTerminal(`Starting dev server: ${command}`, 'info');
  
  try {
    const serverProcess = await webcontainerInstance.value.spawn(cmd, args);
    
    serverProcess.output.pipeTo(new WritableStream({
      write(data) {
        writeTerminal(data, 'info');
      }
    }));

    // Wait for server to be ready
    webcontainerInstance.value.on('server-ready', (port, url) => {
      previewUrl.value = url;
      status.value = 'ready';
      writeTerminal(`Server ready at ${url}`, 'success');
    });
    
    // Check exit code
    serverProcess.exit.then(exitCode => {
      if (exitCode !== 0) {
        writeTerminal(`Server process exited with code ${exitCode}`, 'error');
      }
    });
  } catch (error) {
    writeTerminal(`Failed to start server: ${error}`, 'error');
  }
};

const onFileChange = async () => {
  if (!webcontainerInstance.value || !selectedFile.value) return;
  
  try {
    await webcontainerInstance.value.fs.writeFile(
      selectedFile.value,
      fileContents.value[selectedFile.value]
    );
  } catch (error) {
    writeTerminal(`Failed to save ${selectedFile.value}: ${error}`, 'error');
  }
};

const restart = async () => {
  if (!webcontainerInstance.value) return;
  
  writeTerminal('Restarting container...', 'info');
  previewUrl.value = '';
  status.value = 'booting';
  
  // Kill existing processes
  await webcontainerInstance.value.teardown();
  
  // Reinitialize
  await initWebContainer();
};

const initWebContainer = async () => {
  try {
    status.value = 'booting';
    writeTerminal('Booting WebContainer...', 'info');
    
    webcontainerInstance.value = await WebContainer.boot();
    writeTerminal('WebContainer booted successfully!', 'success');
    
    await mountFiles();
    writeTerminal('Files mounted successfully!', 'success');
    
    // Skip npm install since we don't have any dependencies
    // The app is self-contained with no external packages
    
    writeTerminal('Starting development server...', 'info');
    await startDevServer();
  } catch (error) {
    status.value = 'error';
    writeTerminal(`Error: ${error}`, 'error');
  }
};

// Lifecycle
onMounted(async () => {
  // Initialize file contents
  fileContents.value = { ...props.files };
  const files = Object.keys(props.files);
  selectedFile.value = files[0] || '';
  
  await initWebContainer();
});

onUnmounted(() => {
  if (webcontainerInstance.value) {
    webcontainerInstance.value.teardown();
  }
});

// Watch for external file changes
watch(() => props.files, (newFiles) => {
  fileContents.value = { ...newFiles };
  if (webcontainerInstance.value && status.value === 'ready') {
    mountFiles();
  }
}, { deep: true });

</script>