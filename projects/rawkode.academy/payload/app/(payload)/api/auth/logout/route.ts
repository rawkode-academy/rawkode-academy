import {runtimeAuth} from '../../../../../src/auth/runtime'
export async function POST(request:Request) {return (await runtimeAuth()).logout(request)}
