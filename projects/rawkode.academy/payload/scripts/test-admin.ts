import {chromium,expect} from '@playwright/test'
import {readFileSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const base='http://127.0.0.1:3100'
const credentials=JSON.parse(readFileSync('.runtime/admin.json','utf8'))
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}})
  await page.goto(base+'/admin/login')
  await page.locator('input[name="email"]').fill(credentials.email)
  await page.locator('input[name="password"]').fill(credentials.password)
  await page.getByRole('button',{name:'Login',exact:true}).click()
  await page.waitForURL(base+'/admin')
  await page.goto(base+'/admin/collections/videos/create')
  const id=`ui-${Date.now()}`
  await page.locator('#field-slug').fill(id)
  await page.locator('#field-title').fill('Created through the Workers admin')
  const saved=page.waitForResponse(r=>r.request().method()==='POST' && r.url().includes('/api/videos'))
  await page.getByRole('button',{name:'Save Draft',exact:true}).click()
  const savedResponse=await saved
  assert.ok(savedResponse.ok(),await savedResponse.text())
  const savedDoc=await savedResponse.json()
  await page.waitForURL(base+'/admin/collections/videos/'+savedDoc.doc.id)
  await page.reload()
  await expect(page.locator('#field-title')).toHaveValue('Created through the Workers admin')
  await page.locator('#field-title').fill('Edited through the Workers admin')
  const updated=page.waitForResponse(r=>r.request().method()==='PATCH' && r.url().includes('/api/videos'))
  await page.getByRole('button',{name:'Save Draft',exact:true}).click()
  const updateResponse=await updated
  assert.ok(updateResponse.ok(),await updateResponse.text())
  await page.reload()
  await expect(page.locator('#field-title')).toHaveValue('Edited through the Workers admin')
  await page.screenshot({path:'evidence/admin-edit-view.png',fullPage:true})
  writeFileSync('evidence/admin-test.json',JSON.stringify({at:new Date().toISOString(),runtime:'local workerd',login:true,editViewRendered:true,createDraft:true,editDraft:true,reloadPersistence:true},null,2)+'\n')
}finally{await browser.close()}
