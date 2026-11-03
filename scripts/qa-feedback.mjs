import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=process.argv[3]||'http://127.0.0.1:3360';
const browser=await chromium.launch({headless:true,...(process.argv[2]?{executablePath:process.argv[2]}:{})});
const errors=[],submitted=[];
async function setup(viewport,mobile=false) {
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
  await context.addInitScript(()=>{
    window.turnstile={
      ready:fn=>fn(),
      render:(selector,options)=>{document.querySelector(selector).textContent='验证已通过';setTimeout(()=>options.callback('test-browser-token'),20);return 'test-widget';},
      remove:()=>{}
    };
  });
  await context.route('**/api/feedback/config',r=>r.fulfill({json:{sitekey:'browser-test-key'}}));
  await context.route('**/api/feedback/*',r=>{
    if(r.request().url().endsWith('/config'))return r.fallback();
    const id=r.request().url().split('/').at(-1);
    return r.fulfill({json:{id,status:'pending',issue_url:null}});
  });
  let failNext=false;
  await context.route('**/api/feedback',async r=>{
    const body=r.request().postDataJSON();submitted.push(body);
    if(failNext){failNext=false;await r.fulfill({status:503,json:{error:'暂时无法保存，请重试。'}});return;}
    await r.fulfill({status:202,json:{id:body.id,status:'pending',issue_url:null}});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  return {context,page,failOnce:()=>{failNext=true;}};
}
async function select(page,selector) {
  return page.locator(selector).first().evaluate(el=>{
    const range=document.createRange();range.selectNodeContents(el);
    const selected=window.getSelection();selected.removeAllRanges();selected.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    return selected.toString().trim();
  });
}
try {
  const {context,page,failOnce}=await setup({width:1440,height:1000});
  const loaderContext=await browser.newContext({viewport:{width:1440,height:1000}});
  await loaderContext.route('**/api/feedback/config',r=>r.fulfill({json:{sitekey:'browser-test-key'}}));
  await loaderContext.route('https://challenges.cloudflare.com/turnstile/v0/api.js?**',r=>{
    const callback=new URL(r.request().url()).searchParams.get('onload');
    assert(callback,'Async Turnstile must initialize through the documented onload callback');
    return r.fulfill({contentType:'application/javascript',body:'window.turnstile={render:function(s,o){setTimeout(function(){o.callback("test-token")},20);return "loader-test";},remove:function(){}};window['+JSON.stringify(callback)+']();'});
  });
  const loaderPage=await loaderContext.newPage();
  loaderPage.on('pageerror',e=>errors.push(e.message));
  await loaderPage.goto(base+'/assignment1/rope/',{waitUntil:'networkidle'});
  await loaderPage.locator('.reader-tools .feedback-link').click();
  await loaderPage.waitForFunction(()=>!document.querySelector('.feedback-submit').disabled);
  await loaderContext.close();
  await page.goto(base+'/assignment1/rope/',{waitUntil:'networkidle'});
  const fallback=new URL(await page.locator('.reader-tools .feedback-link').getAttribute('href'));
  assert.equal(fallback.searchParams.get('template'),'error-report.yml');
  const quote=await select(page,'.prose>p');
  await page.locator('.selection-feedback').waitFor({state:'visible'});
  await page.screenshot({path:root+'/artifacts/inline-selection-desktop.png'});
  const count=context.pages().length;
  await page.locator('.selection-feedback').click();
  await page.locator('.feedback-dialog').waitFor({state:'visible'});
  assert.equal(context.pages().length,count,'Feedback must not open GitHub or another tab');
  assert.equal(await page.locator('#feedback-excerpt').inputValue(),quote);
  assert.equal(await page.evaluate(()=>CSS.highlights.has('feedback-selection')),true);
  await page.locator('#feedback-description').fill('这是页内反馈体验的验证说明。');
  await page.locator('#feedback-suggestion').fill('建议核对原文。');
  await page.locator('.feedback-submit').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('.feedback-submit').disabled);
  await page.screenshot({path:root+'/artifacts/inline-form-desktop.png'});
  failOnce();
  await page.locator('.feedback-submit').click();
  await page.locator('.feedback-error').waitFor({state:'visible'});
  assert.equal(await page.locator('#feedback-description').inputValue(),'这是页内反馈体验的验证说明。');
  const attemptId=submitted.at(-1).id;
  await page.waitForFunction(()=>!document.querySelector('.feedback-submit').disabled);
  await page.locator('.feedback-submit').click();
  await page.locator('.feedback-success').waitFor({state:'visible'});
  assert.equal(submitted.at(-1).id,attemptId,'Retries must reuse the feedback ID');
  assert.equal(submitted.at(-1).page_anchor,'section-1');
  assert.equal(submitted.at(-1).chapter_slug,'rope');
  assert.equal(submitted.at(-1).excerpt,quote);
  assert.equal(context.pages().length,1);
  await page.screenshot({path:root+'/artifacts/inline-success-desktop.png'});
  await page.locator('.feedback-done').click();
  await page.waitForFunction(()=>!CSS.highlights.has('feedback-selection'));
  assert.equal(await page.evaluate(()=>CSS.highlights.has('feedback-selection')),false);
  await page.locator('.reader-tools .feedback-link').click();
  assert.equal(await page.locator('#feedback-description').inputValue(),'');
  await page.locator('.feedback-close').click();
  await page.goto(base+'/community/',{waitUntil:'networkidle'});
  assert.equal(await page.locator('.discussion-row').count(),25);
  assert(await page.locator('body').textContent().then(s=>s.includes('无需 GitHub 账号')));
  await page.screenshot({path:root+'/artifacts/community-desktop.png'});
  const mobile=await setup({width:390,height:844},true);
  await mobile.page.goto(base+'/assignment1/rope/',{waitUntil:'networkidle'});
  const mobileQuote=await select(mobile.page,'.prose>p');
  await mobile.page.locator('.selection-feedback').waitFor({state:'visible'});
  await mobile.page.screenshot({path:root+'/artifacts/inline-selection-mobile.png'});
  await mobile.page.locator('.selection-feedback').tap();
  assert.equal(await mobile.page.locator('#feedback-excerpt').inputValue(),mobileQuote);
  await mobile.page.locator('#feedback-description').fill('手机端反馈。');
  await mobile.page.waitForFunction(()=>!document.querySelector('.feedback-submit').disabled);
  await mobile.page.screenshot({path:root+'/artifacts/inline-form-mobile.png'});
  assert(await mobile.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert(await mobile.page.locator('.feedback-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await mobile.page.locator('.feedback-submit').tap();
  await mobile.page.locator('.feedback-success').waitFor({state:'visible'});
  assert.equal(mobile.context.pages().length,1);
  await mobile.page.locator('.feedback-done').tap();
  await mobile.page.locator('.menu-toggle').tap();
  await mobile.page.locator('.nav-community').tap();
  await mobile.page.waitForURL('**/community/');
  assert.equal(await mobile.page.locator('.discussion-row').count(),25);
  assert.equal(errors.length,0,JSON.stringify(errors));
  const report={base,api_mode:'mocked browser transport; real backend and sync covered by SQLite integration tests',checks:['Selection-adjacent feedback button','Persistent quote highlight while editing','In-page form and success receipt with no new tabs','Failure preserves draft and retry ID','Chapter and section context included','Mobile selection, form, submission and navigation','No page or dialog overflow','25 chapter discussions retained'],submitted_requests:submitted.length,errors};
  await fs.writeFile(root+'/artifacts/inline-feedback-qa.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
