import {readFileSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
const base='http://127.0.0.1:3100'
const fixture=JSON.parse(readFileSync('.runtime/oidc-fixtures.json','utf8'))
const auth=(token:string)=>({origin:base,cookie:`poc-oidc-session=${token}`,'content-type':'application/json'})
const a:any=await fetch(base+'/api/auth/session',{headers:auth(fixture.tokens.a)}).then(r=>r.json())
assert.equal(a.user.role,'staff')
const b:any=await fetch(base+'/api/auth/session',{headers:auth(fixture.tokens.b)}).then(r=>r.json())
assert.equal(b.user.role,'customer')
assert.equal((await fetch(base+`/api/videos/${fixture.privateVideoId}?draft=true`,{headers:auth(fixture.tokens.a)})).status,200)
const id='oidc-staff-'+Date.now()
const created=await fetch(base+'/api/articles',{method:'POST',headers:auth(fixture.tokens.a),body:JSON.stringify({slug:id,title:'Created by synthetic OIDC staff',_status:'draft'})})
assert.equal(created.status,201)
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000}})
 await context.addCookies([{name:'poc-oidc-session',value:fixture.tokens.a,url:base,httpOnly:true,sameSite:'Lax'}])
 const page=await context.newPage()
 await page.goto(base+`/admin/collections/videos/${fixture.privateVideoId}`)
 await expect(page.locator('#field-title')).toHaveValue('Private staff-only fixture')
 await page.screenshot({path:'evidence/oidc-staff-admin.png'})
}finally{await browser.close()}
writeFileSync('evidence/oidc-staff.json',JSON.stringify({at:new Date().toISOString(),passed:true,runtime:'local workerd and headless Chrome',checks:['Exact allowlisted synthetic subject receives staff','Other synthetic subject remains customer','OIDC staff reads private draft and creates article','Opaque OIDC session opens actual Payload admin editor'],limits:['Locally seeded session, not a live provider sign-in','Fixture allowlist override only; default allowlist remains empty']},null,2)+'\n')
console.log('Synthetic OIDC staff authorization and browser admin checks passed')
