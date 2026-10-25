import { access, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { createLogger } from "../lib/logger";

const logger = createLogger("webcontainer-demos");

// Minimal Vite Plugin type definition to avoid direct vite import
interface VitePlugin {
	name: string;
	configResolved?: (config: { root?: string }) => void | Promise<void>;
	resolveId?: (id: string) => string | null | undefined;
	load?: (
		id: string,
	) => string | null | undefined | Promise<string | null | undefined>;
}

// Root-relative, as import.meta.glob expects; keys come back in this form.
const GLOB_BASE = "/src/webcontainer-demos";
const VIRTUAL_MODULE_ID = "virtual:webcontainer-demos";
const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID;

interface DemoConfig {
	title?: string;
	startCommand?: string;
	description?: string;
}

interface DemoInfo {
	courseId: string;
	demoId: string;
	path: string;
	config: DemoConfig;
}

// Demo trees live in src/webcontainer-demos/<course>/<demo> (they moved out of
// content/courses/<course>/examples when course content moved to D1). Course
// resources reference them by `embedConfig.import.localDir` = "<course>/<demo>".
async function discoverDemos(coursesDir: string): Promise<DemoInfo[]> {
	const demos: DemoInfo[] = [];

	try {
		const courses = await readdir(coursesDir, { withFileTypes: true });

		for (const course of courses) {
			if (!course.isDirectory()) continue;

			const examplesPath = join(coursesDir, course.name);

			try {
				await access(examplesPath);
				const examples = await readdir(examplesPath, { withFileTypes: true });

				for (const example of examples) {
					if (!example.isDirectory()) continue;

					const demoPath = join(examplesPath, example.name);
					let config: DemoConfig = {};

					// Check for .webcontainer.json config file
					try {
						const configPath = join(demoPath, ".webcontainer.json");
						const configContent = await readFile(configPath, "utf-8");
						config = JSON.parse(configContent);
					} catch {
						// No config file, use defaults
						config = {
							title: example.name
								.replace(/-/g, " ")
								.replace(/\b\w/g, (l) => l.toUpperCase()),
							startCommand: "npm run dev",
						};
					}

					demos.push({
						courseId: course.name,
						demoId: example.name,
						path: relative(coursesDir, demoPath),
						config,
					});
				}
			} catch {
				// Unreadable course directory
			}
		}
	} catch (error) {
		logger.error("Failed to discover demos", error);
	}

	return demos;
}

export function webcontainerDemosPlugin(): VitePlugin {
	let demos: DemoInfo[] = [];
	let coursesDir: string;

	return {
		name: "vite-plugin-webcontainer-demos",

		async configResolved(config) {
			// Discover all demos at build time
			coursesDir = resolve(
				config.root ?? process.cwd(),
				"src/webcontainer-demos",
			);
			demos = await discoverDemos(coursesDir);
			logger.info(`Discovered ${demos.length} WebContainer demos`);
		},

		resolveId(id) {
			if (id === VIRTUAL_MODULE_ID) {
				return RESOLVED_VIRTUAL_MODULE_ID;
			}
			return null;
		},

		async load(id) {
			if (id !== RESOLVED_VIRTUAL_MODULE_ID) {
				return null;
			}

			// Generate import statements for each demo
			const imports: string[] = [];
			const demoMap: string[] = [];

			demos.forEach((demo, index) => {
				const key = `${demo.courseId}/${demo.demoId}`;
				const globPattern = `${GLOB_BASE}/${demo.path}/**/*`;

				// Use Vite's updated glob options: `query` + `import`
				imports.push(
					`const demo${index} = import.meta.glob('${globPattern}', { query: '?raw', import: 'default', eager: true });`,
				);
				demoMap.push(
					`'${key}': { files: demo${index}, config: ${JSON.stringify(
						demo.config,
					)}, path: '${demo.path}' }`,
				);
			});

			return `
${imports.join("\n")}

const demoRegistry = {
  ${demoMap.join(",\n  ")}
};

export function loadDemoFiles(courseId, demoId) {
  const key = \`\${courseId}/\${demoId}\`;
  const demo = demoRegistry[key];
  
  if (!demo) {
    throw new Error(\`Demo not found: \${key}\`);
  }
  
  const processedFiles = {};
  const basePath = \`${GLOB_BASE}/\${demo.path}/\`;
  
  for (const [path, content] of Object.entries(demo.files)) {
    if (path.startsWith(basePath)) {
      const relativePath = path.slice(basePath.length);
      processedFiles[relativePath] = content;
    }
  }
  
  return {
    files: processedFiles,
    config: demo.config
  };
}

export function listAvailableDemos() {
  return Object.keys(demoRegistry).map(key => {
    const [courseId, demoId] = key.split('/');
    return {
      courseId,
      demoId,
      ...demoRegistry[key].config
    };
  });
}
`;
		},
	};
}
