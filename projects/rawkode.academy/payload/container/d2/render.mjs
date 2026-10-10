import { D2 } from '@terrastruct/d2'

// The locked 0.1.33 release has no dispose() API. Keep its worker alive for the
// Container process lifetime instead of leaking one worker per render.
const renderer = new D2()
let renderQueue = Promise.resolve()

/** Run only in the pinned Node container. D2.js uses Node workers and dynamic code. */
export async function renderD2(source) {
  const result = renderQueue.then(async () => {
    const compiled = await renderer.compile(source, { noXMLTag: true })
    return renderer.render(compiled.diagram, compiled.renderOptions)
  })
  renderQueue = result.then(() => undefined, () => undefined)
  return result
}
