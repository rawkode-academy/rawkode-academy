import config from '@payload-config'
import '@payloadcms/next/css'
import './custom.css'
import type { ServerFunctionClient } from 'payload'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import { Red_Hat_Display, Red_Hat_Mono, Red_Hat_Text } from 'next/font/google'
import { importMap } from './admin/importMap'

// Variable names are pinned: custom.css reads --font-red-hat-*.
const display = Red_Hat_Display({ subsets: ['latin'], variable: '--font-red-hat-display', display: 'swap' })
const body = Red_Hat_Text({ subsets: ['latin'], variable: '--font-red-hat-text', display: 'swap' })
const mono = Red_Hat_Mono({ subsets: ['latin'], variable: '--font-red-hat-mono', display: 'swap' })

const serverFunction: ServerFunctionClient = async (args) => {
  'use server'
  return handleServerFunctions({...args,config,importMap})
}
export default function Layout({children}:{children:React.ReactNode}) {
  return <RootLayout config={config} htmlProps={{className:`${display.variable} ${body.variable} ${mono.variable}`}} importMap={importMap} serverFunction={serverFunction}>{children}</RootLayout>
}
