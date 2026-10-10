import { d2SourcesFromBody, putD2Artifact } from '../../src/diagrams'

/** Static imports render in this Node process; the site Worker never imports D2.js/WASM. */
const packageName = '@terrastruct/d2'
type Renderer = {
  compile(source: string, options: { noXMLTag: boolean }): Promise<{ diagram: unknown; renderOptions: unknown }>
  render(diagram: unknown, options: unknown): Promise<string>
}
let rendererPromise: Promise<Renderer> | undefined
let renderQueue = Promise.resolve()

function renderer(): Promise<Renderer> {
  // 0.1.33 has no dispose() method. Reuse one worker for this short-lived import process.
  return rendererPromise ??= import(packageName).then(({ D2 }) => new D2() as Renderer)
}

export async function precomputeD2Artifacts(body: string | undefined, bucket: R2Bucket): Promise<number> {
  const sources = await d2SourcesFromBody(body)
  if (!sources.length) return 0
  // Serialize calls: this package release does not support concurrent operations
  // on one instance, and the importer invokes this helper once per document.
  const result = renderQueue.then(async () => {
    const instance = await renderer()
    for (const source of sources) {
      const compiled = await instance.compile(source.source, { noXMLTag: true })
      const svg = await instance.render(compiled.diagram, compiled.renderOptions)
      await putD2Artifact(bucket, source.sourceHash, svg)
    }
  })
  renderQueue = result.then(() => undefined, () => undefined)
  await result
  return sources.length
}
