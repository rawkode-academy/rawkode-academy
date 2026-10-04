import {writeFileSync} from 'node:fs'
const enabled=process.argv.includes('--enable')
writeFileSync('src/optional-mcp.ts',enabled
  ? "import {academyMcpPlugin,academyMcpGlobal} from './mcp'\nexport const optionalPlugins=[academyMcpPlugin]\nexport const optionalGlobals=[academyMcpGlobal]\n"
  : "import type {Plugin,GlobalConfig} from 'payload'\nexport const optionalPlugins:Plugin[]=[]\nexport const optionalGlobals:GlobalConfig[]=[]\n")
console.log(enabled?'MCP evaluation enabled. Rebuild Worker; do not deploy.':'MCP excluded from default Worker module graph. Rebuild Worker.')
