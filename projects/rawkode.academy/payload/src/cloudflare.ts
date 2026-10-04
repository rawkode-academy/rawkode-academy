import {getCloudflareContext} from '@opennextjs/cloudflare'
const isCli = process.env.POC_CLI === '1' || process.env.NODE_ENV !== 'production'
const wranglerOptions = {
  remoteBindings: process.env.POC_REMOTE_BINDINGS === '1',
  ...(process.env.POC_CLOUDFLARE_CONFIG_PATH ? {configPath: process.env.POC_CLOUDFLARE_CONFIG_PATH} : {}),
  ...(process.env.POC_CLOUDFLARE_ENV_FILE ? {envFiles: [process.env.POC_CLOUDFLARE_ENV_FILE]} : {}),
  ...(process.env.POC_BUILD === '1' ? {persist: false} : {}),
}
export const cloudflare = isCli
  ? await import(/* webpackIgnore: true */ `${'__wrangler'.replaceAll('_','')}`).then(({getPlatformProxy}) => getPlatformProxy(wranglerOptions))
  : await getCloudflareContext({async:true})
