# Course Module Resources Documentation

This document explains how to add resource attachments to course modules.

## Adding Resources to a Course Module

In your course module frontmatter (e.g., `content/courses/your-course/01-introduction.mdx`), add a `resources` array:

```yaml
---
title: "Module Title"
# ... other fields ...
resources:
  - title: "Module Slides"
    type: "file"
    filePath: "courses/your-course/module-01-slides.pdf"
    category: "slides"
  - title: "Code Examples"
    description: "Examples for this module"
    type: "url"
    url: "https://github.com/your-org/examples/module-01"
    category: "code"
---
```

## Resource Properties

- **title** (required): Display name of the resource
- **description** (optional): Brief description of the resource
- **type** (required): One of `"url"` for external links, `"file"` for downloadable files, or `"embed"` for interactive demos
- **url** (optional): Required for `type: "url"`, the external URL
- **filePath** (optional): Required for `type: "file"`, relative path from `/public/resources/`
- **embedConfig** (optional): Required for `type: "embed"`, configuration for embedded applications
  - **container**: One of `"stackblitz"`, `"codesandbox"`, `"codepen"`, or `"iframe"`
  - **src**: The source URL or project ID
  - **height** (optional): Height of the embed (default: "600px")
  - **width** (optional): Width of the embed (default: "100%")
- **category** (required): One of `"slides"`, `"code"`, `"documentation"`, or `"other"`

## File Resources

For file resources:
1. Place your files in `/public/resources/courses/your-course/`
2. Reference them with `filePath: "courses/your-course/filename.pdf"`
3. Files will be served from `/resources/courses/your-course/filename.pdf`

## Embedded Application Resources

For embedded applications, you can use popular web containers:

### StackBlitz Example
```yaml
resources:
  - title: "Astro Starter Template"
    description: "Interactive Astro starter project"
    type: "embed"
    embedConfig:
      container: "stackblitz"
      src: "github/withastro/astro/tree/latest/examples/minimal"
      height: "700px"
    category: "code"
```

### CodeSandbox Example
```yaml
resources:
  - title: "React Tutorial"
    description: "Interactive React coding environment"
    type: "embed"
    embedConfig:
      container: "codesandbox"
      src: "new-react"
      height: "600px"
    category: "code"
```

### CodePen Example
```yaml
resources:
  - title: "CSS Animation Demo"
    description: "Interactive CSS animation example"
    type: "embed"
    embedConfig:
      container: "codepen"
      src: "https://codepen.io/pen/abcdef"
    category: "code"
```

### Generic iframe Example
```yaml
resources:
  - title: "Custom Web App"
    description: "Embedded custom application"
    type: "embed"
    embedConfig:
      container: "iframe"
      src: "https://your-app.com/embed"
      height: "800px"
    category: "other"
```

### WebContainer Example (Full Node.js Environment)

WebContainers provide a full Node.js environment running in the browser. You can either:

1. **Import from local directory** (recommended for larger projects):
```yaml
resources:
  - title: "OAuth PKCE Demo"
    description: "Interactive OAuth PKCE flow demonstration"
    type: "embed"
    embedConfig:
      container: "webcontainer"
      src: "oauth-pkce-demo"
      height: "800px"
      startCommand: "bun run dev"
      import:
        localDir: "./examples/oauth-pkce-app"  # Path relative to the module file
    category: "code"
```

Place your app files in `content/courses/your-course/examples/oauth-pkce-app/`.

2. **Inline files** (for simple examples):
```yaml
resources:
  - title: "Simple Node.js Demo"
    description: "Basic Node.js server example"
    type: "embed"
    embedConfig:
      container: "webcontainer"
      src: "node-demo"
      height: "600px"
      startCommand: "node server.js"
      files:
        "package.json": |
          {
            "name": "node-demo",
            "type": "module",
            "scripts": {
              "start": "node server.js"
            }
          }
        "server.js": |
          import { createServer } from 'http';
          
          const server = createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Hello from WebContainer!</h1>');
          });
          
          server.listen(3000, () => {
            console.log('Server running at http://localhost:3000');
          });
    category: "code"
```

## Complete Example

Here's a complete example for a Zitadel course module with various resource types:

```yaml
---
title: "Introduction to Zitadel"
description: "Getting started with Zitadel identity management"
course: "complete-guide-zitadel"
order: 1
publishedAt: "2025-07-02"
isDraft: false
resources:
  - title: "Module Slides"
    description: "Introduction presentation slides"
    type: "file"
    filePath: "courses/complete-guide-zitadel/01-introduction-slides.pdf"
    category: "slides"
  - title: "Zitadel Documentation"
    description: "Official getting started guide"
    type: "url"
    url: "https://zitadel.com/docs/guides/start/quickstart"
    category: "documentation"
  - title: "Hello World Example"
    description: "Simple example application"
    type: "url"
    url: "https://github.com/zitadel/examples/tree/main/hello-world"
    category: "code"
  - title: "Setup Checklist"
    description: "PDF checklist for initial setup"
    type: "file"
    filePath: "courses/complete-guide-zitadel/setup-checklist.pdf"
    category: "other"
  - title: "Zitadel Playground"
    description: "Interactive Zitadel configuration demo"
    type: "embed"
    embedConfig:
      container: "stackblitz"
      src: "zitadel-demo"
      height: "700px"
    category: "code"
---
```