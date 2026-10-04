import config from '@payload-config'
import {getPayload} from 'payload'
import {createCompatibilityYoga} from '../../../src/compat'
export async function GET(request:Request){return createCompatibilityYoga(await getPayload({config})).fetch(request)}
export async function POST(request:Request){return createCompatibilityYoga(await getPayload({config})).fetch(request)}
