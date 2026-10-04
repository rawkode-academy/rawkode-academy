import {runtimeAuth} from '../../../../../src/auth/runtime'
export async function GET(request:Request) {return (await runtimeAuth()).callback(request)}
