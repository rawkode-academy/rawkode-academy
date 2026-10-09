import config from '@payload-config'
import {getPayload} from 'payload'
import {cloudflare} from '../cloudflare'
import {authConfig} from './config'
import {oidcService} from './payload'
export async function runtimeAuth() {
  return oidcService(await getPayload({config}),authConfig(cloudflare.env),cloudflare.env.D1)
}
export const runtimeAuthConfig = () => authConfig(cloudflare.env)
