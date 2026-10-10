# Course module resources

Course resources live in Payload. After the initial content import, edit the
course module and its `contentResources` field in Payload; the repository's MDX
files are import input, not the day-to-day publishing workflow. Keep the
existing website slug when editing a record so its URL remains stable.

`contentResources` is an array of resource objects:

| Field | Purpose |
| --- | --- |
| `title` | Label shown to learners |
| `description` | Optional short explanation |
| `type` | `url`, `file`, or `embed` |
| `url` | Destination for a `url` resource |
| `filePath` | Existing resource path for a downloadable `file` |
| `embedConfig` | Embed settings for an `embed` resource |
| `category` | `slides`, `code`, `documentation`, `demos`, or `other` |

## WebContainer demos

A WebContainer resource stores its source files with that resource in Payload.
The public course page receives only the resource's display details. When a
learner opens the demo, Astro requests that one demo from Payload and renders
the interactive page on the server. Ordinary content reads do not include demo
file contents.

Example `contentResources` item:

```json
{
  "title": "OAuth PKCE Demo",
  "description": "Try the OAuth PKCE flow in your browser.",
  "type": "embed",
  "category": "code",
  "embedConfig": {
    "container": "webcontainer",
    "src": "oauth-pkce-app",
    "height": "800px",
    "startCommand": "bun run dev",
    "files": {
      "package.json": "{\"scripts\":{\"dev\":\"node server.js\"}}",
      "server.js": "console.log('Demo ready')"
    }
  }
}
```

File paths inside `embedConfig.files` must be relative and stay within the
demo. Store text files only. The importer and public bridge enforce limits on
path length, file count, and total size. Do not add local filesystem paths to
Payload.

For the initial import and later repository reimports, the importer can read
legacy `embedConfig.import.localDir` from an existing course module. It only
reads the matching `content/courses/<course>/examples/<resource>` directory,
copies bounded text files into Payload's `embedConfig.files`, and removes the
local path. `.webcontainer.json` can provide `startCommand`; the resource's
`startCommand` is used when that file does not provide one. This is a migration
helper, not a Payload field editors should use.

The CMS and website both check publication status. A scheduled or draft course
module cannot expose its demo before it becomes public.

## Other resources

- For an external destination, set `type` to `url` and provide `url`.
- For a download, set `type` to `file` and provide its existing `filePath`.
- For an iframe embed, set `type` to `embed` and use
  `embedConfig.container: "iframe"` with the destination in `embedConfig.src`.

The imported course and module slugs remain the website URL slugs. Change a
slug only when a URL change is intended.
