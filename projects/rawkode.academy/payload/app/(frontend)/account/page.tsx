import {headers} from 'next/headers'
import {runtimeAuth} from '../../../src/auth/runtime'
export const dynamic='force-dynamic'
export default async function Account() {
  const session=await (await runtimeAuth()).session(await headers())
  return <main style={{fontFamily:'system-ui',maxWidth:720,margin:'80px auto'}}>
    <h1>Academy preview account</h1>
    {session?<><p>Signed in as {session.user.name||'Academy member'}.</p><p>Access: {session.user.role}. Session expires {new Date(session.expiresAt*1000).toISOString()}.</p>
      {session.user.role==='staff'?<a href="/admin">Open editorial admin</a>:<p>No private projects have been shared with this account. Project sharing is not implemented in this experiment.</p>}
      <form action="/api/auth/logout" method="post"><button type="submit">Sign out of preview</button></form></>:<a href="/api/auth/login">Sign in with Academy</a>}
  </main>
}
