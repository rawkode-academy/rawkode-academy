import config from '@payload-config'
import '@payloadcms/next/css'
import type { ServerFunctionClient } from 'payload'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import { importMap } from './admin/importMap'
const serverFunction: ServerFunctionClient = async (args) => {
  'use server'
  return handleServerFunctions({...args,config,importMap})
}
export default function Layout({children}:{children:React.ReactNode}) {
  return <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>{children}</RootLayout>
}
