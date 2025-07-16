import { readdir, readFile } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';

export interface WebContainerFiles {
  [path: string]: string;
}

export async function loadWebContainerFiles(baseDir: string): Promise<WebContainerFiles> {
  const files: WebContainerFiles = {};
  
  async function walkDir(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and other common directories
        if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          await walkDir(fullPath);
        }
      } else if (entry.isFile()) {
        // Skip hidden files but allow lock files
        if (!entry.name.startsWith('.')) {
          const relativePath = relative(baseDir, fullPath);
          // Security check: prevent path traversal
          if (relativePath.startsWith('../') || relativePath.includes('..\\') || isAbsolute(relativePath)) {
            continue; // Skip files outside baseDir
          }
          const content = await readFile(fullPath, 'utf-8');
          files[relativePath] = content;
        }
      }
    }
  }
  
  await walkDir(baseDir);
  return files;
}