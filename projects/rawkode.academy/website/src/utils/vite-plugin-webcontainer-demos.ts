import type { Plugin } from "vite";
import { readdir, readFile, access } from "node:fs/promises";
import { join, relative } from "node:path";

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

// Auto-discover all demos in the courses directory
async function discoverDemos(coursesDir: string): Promise<DemoInfo[]> {
	const demos: DemoInfo[] = [];

	try {
		const courses = await readdir(coursesDir, { withFileTypes: true });

		for (const course of courses) {
			if (!course.isDirectory()) continue;

			const coursePath = join(coursesDir, course.name);
			const examplesPath = join(coursePath, "examples");

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
				// No examples directory for this course
			}
		}
	} catch (error) {
		console.error("Failed to discover demos:", error);
	}

	return demos;
}

export function webcontainerDemosPlugin(): Plugin {
	let demos: DemoInfo[] = [];

	return {
		name: "vite-plugin-webcontainer-demos",

		async configResolved(config) {
			// Discover all demos at build time
			const root = config.root || process.cwd();
			const coursesDir = join(root, "content", "courses");
			demos = await discoverDemos(coursesDir);
			console.log(`Discovered ${demos.length} WebContainer demos`);
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
				const globPattern = `/content/courses/${demo.path}/**/*`;

				imports.push(
					`const demo${index} = import.meta.glob('${globPattern}', { as: 'raw', eager: true });`,
				);
				demoMap.push(
					`'${key}': { files: demo${index}, config: ${JSON.stringify(demo.config)}, path: '${demo.path}' }`,
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
  const basePath = \`/content/courses/\${demo.path}/\`;
  
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
