import {readFileSync} from 'node:fs'
const base='http://127.0.0.1:3100'
const credentials=JSON.parse(readFileSync('.runtime/admin.json','utf8'))
await fetch(base+'/api/users/first-register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(credentials)})
const response=await fetch(base+'/api/users/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(credentials)})
if(!response.ok) throw new Error(`Local staff bootstrap/login failed: ${response.status}`)
console.log('Local staff login verified. Credentials remain in .runtime/admin.json.')
