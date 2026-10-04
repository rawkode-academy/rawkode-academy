import { withPayload } from '@payloadcms/next/withPayload'
export default withPayload({
  serverExternalPackages: ['jose', 'pg-cloudflare'],
  webpack(config) {
    config.resolve.extensionAlias = { '.cjs':['.cts','.cjs'], '.js':['.ts','.tsx','.js','.jsx'], '.mjs':['.mts','.mjs'] }
    return config
  },
}, { devBundleServerPackages: false })
