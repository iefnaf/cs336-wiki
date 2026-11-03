import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=process.argv[3]||'http://127.0.0.1:3360';
const browser=await chromium.launch({headless:true,...(process.argv[2]?{executablePath:process.argv[2]}:{})});
const errors=[];
async function contextFor(mobile=false) {
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
  await context.route('https://giscus.app/client.js',async route=>{
    await route.fulfill({contentType:'application/javascript',body:[
      'const s=document.currentScript;',
      'const iframe=document.createElement("iframe");iframe.className="giscus-frame";iframe.title="本章讨论";',
      'iframe.src="https://giscus.app/test-widget?number="+s.dataset.term+"&theme="+s.dataset.theme;',
      'iframe.style.height="410px";s.parentElement.append(iframe);'
    ].join('')});
  });
  await context.route('https://giscus.app/test-widget?**',async route=>{
    const url=new URL(route.request().url()),number=url.searchParams.get('number'),theme=url.searchParams.get('theme');
    await route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh-CN" data-theme="'+theme+'"><head><meta charset="utf-8"><style>body{font:14px system-ui;color:#273240;background:#fff;margin:16px 4px}h3{font-size:14px}textarea{box-sizing:border-box;width:100%;height:110px;padding:12px;border:1px solid #d6dce6;border-radius:6px;font:inherit}button{background:#3158a2;color:white;border:0;border-radius:4px;padding:10px 15px;margin-top:12px}p{line-height:1.9;color:#687184}small{color:#8993a2}html[data-theme=dark] body{background:#171b22;color:#e1e6ee}html[data-theme=dark] textarea{background:#202733;color:#e1e6ee;border-color:#374356}</style></head><body><h3>0 条评论</h3><p>使用 GitHub 账号登录后，在此发表评论或回复。</p><textarea aria-label="评论内容" placeholder="分享你的理解或提出问题…"></textarea><button>使用 GitHub 登录</button><p><small>由 GitHub Discussions 支持 · 当前章节 #'+number+'</small></p><script>parent.postMessage({giscus:{discussion:{url:"https://github.com/iefnaf/cs336-wiki/discussions/'+number+'"}}},"*");window.addEventListener("message",e=>{if(e.data?.giscus?.setConfig?.theme)document.documentElement.dataset.theme=e.data.giscus.setConfig.theme});</script></body></html>'});
  });
  return context;
}
try {
  const context=await contextFor();
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/assignment1/rope/',{waitUntil:'networkidle'});
  assert.equal(await page.locator('.chapter-comments').count(),1);
  const pages=context.pages().length;
  await page.locator('.reader-tools .chapter-discussion').click();
  await page.waitForURL('**/assignment1/rope/#discussion');
  await page.locator('iframe.giscus-frame').waitFor();
  await page.locator('.comments-loading').waitFor({state:'hidden'});
  assert.equal(context.pages().length,pages);
  const frame=page.frameLocator('iframe.giscus-frame');
  await frame.getByRole('textbox',{name:'评论内容'}).fill('关于这一章的阅读疑问。');
  assert((await page.locator('iframe.giscus-frame').getAttribute('src')).includes('number=11'));
  await page.locator('.chapter-comments').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('.chapter-comments').getBoundingClientRect().top<innerHeight/2);
  await page.screenshot({path:root+'/artifacts/comments-desktop.png'});
  await page.locator('.topbar .theme-toggle').click();
  await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  await frame.locator('html[data-theme="dark"]').waitFor();
  await page.screenshot({path:root+'/artifacts/comments-dark.png'});
  await page.evaluate(()=>window.postMessage({giscus:{error:'untrusted'}},"*"));
  assert(await page.locator('.comments-error').isHidden());
  await frame.locator('body').evaluate(()=>parent.postMessage({giscus:{error:'temporary failure'}},"*"));
  await page.locator('.comments-error').waitFor({state:'visible'});
  await page.locator('.comments-retry').click();
  await page.locator('.comments-error').waitFor({state:'hidden'});
  await page.goto(base+'/assignment1/unicode/#discussion',{waitUntil:'networkidle'});
  await page.locator('iframe.giscus-frame').waitFor();
  assert((await page.locator('iframe.giscus-frame').getAttribute('src')).includes('number=3'));
  const mobileContext=await contextFor(true);
  const mobile=await mobileContext.newPage();mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(base+'/assignment1/rope/',{waitUntil:'networkidle'});
  await mobile.locator('.reader-tools .chapter-discussion').tap();
  await mobile.locator('iframe.giscus-frame').waitFor();
  await mobile.locator('.comments-loading').waitFor({state:'hidden'});
  assert.equal(mobileContext.pages().length,1);
  assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await mobile.locator('.chapter-comments').scrollIntoViewIfNeeded();
  await mobile.waitForFunction(()=>document.querySelector('.chapter-comments').getBoundingClientRect().top<innerHeight/2);
  await mobile.screenshot({path:root+'/artifacts/comments-mobile.png'});
  await mobile.goto(base+'/community/',{waitUntil:'networkidle'});
  const row=mobile.locator('.discussion-row').filter({hasText:'旋转位置嵌入 RoPE'});
  await row.getByRole('link',{name:'参与讨论'}).tap();
  await mobile.waitForURL('**/assignment1/rope/#discussion');
  assert.equal(errors.length,0,JSON.stringify(errors));
  const report={base,provider_mode:'mocked giscus widget; no comments published',checks:['Embedded chapter discussion below navigation','Top discussion link scrolls within the same page','Exact existing thread number per chapter','Editor visible in chapter page','Theme follows website','Provider errors have retry UI','Untrusted postMessage ignored','Mobile layout and community links stay within site'],errors};
  await fs.writeFile(root+'/artifacts/comments-qa.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
