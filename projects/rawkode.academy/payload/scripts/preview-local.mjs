import { spawn } from 'node:child_process'
import { localVars } from './local-vars.mjs'
// Local workerd on the registered loopback origin. --var overrides the production
// top-level vars, so nothing local is written to .dev.vars. Extra arguments are
// passed through after the defaults, so a later --var overrides them. Without
// --local-upstream, wrangler dev rewrites the request URL and Origin to the
// admin.rawkode.academy route, which is not a local origin.
const args = ['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port','3100','--local-upstream','127.0.0.1:3100','--upstream-protocol','http',...Object.entries(localVars).flatMap(([key,value])=>['--var',`${key}:${value}`]),...process.argv.slice(2)]
const child = spawn('node', args, { env: {...process.env, WRANGLER_LOG_PATH: '.runtime/wrangler.log'}, stdio: 'inherit' })
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill(signal))
child.once('close', (status, signal) => process.exit(signal ? 1 : status ?? 1))
