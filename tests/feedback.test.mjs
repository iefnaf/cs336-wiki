import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createFeedbackWorker } from '../worker/index.mjs';
import { synchronizeFeedback } from '../scripts/sync-feedback.mjs';
const schema=await readFile(new URL('../migrations/0001_feedback.sql',import.meta.url),'utf8');
function setup(verification={success:true,hostname:'cs336.wiki',action:'feedback'}) {
  const db=new DatabaseSync(':memory:');db.exec(schema);
  const env={TURNSTILE_SITE_KEY:'test-public-site-key',TURNSTILE_SECRET_KEY:['test','turnstile'].join('-'),FEEDBACK_SYNC_TOKEN:['test','synchronization'].join('-'),ASSETS:{fetch:()=>new Response('asset')}};
  const prepared=(sql,args=[])=>({
    bind:(...values)=>prepared(sql,values),
    first:async()=>db.prepare(sql).get(...args)||null,
    all:async()=>({results:db.prepare(sql).all(...args)}),
    run:async()=>({meta:{changes:db.prepare(sql).run(...args).changes}})
  });
  env.FEEDBACK_DB={prepare:sql=>prepared(sql)};
  let verifyCalls=0;
  const worker=createFeedbackWorker({fetcher:async()=>{verifyCalls++;return Response.json(verification)},now:()=>1730000000000});
  const call=(pathname,body,headers={})=>worker.fetch(new Request('https://cs336.wiki'+pathname,{...(body?{method:'POST',body:JSON.stringify(body)}:{}),headers:{'Content-Type':'application/json',Origin:'https://cs336.wiki','CF-Connecting-IP':'192.0.2.1',...headers}}),env);
  return {db,env,call,worker,verifyCalls:()=>verifyCalls};
}
const feedback=()=>({id:randomUUID(),chapter_slug:'rope',page_anchor:'section-1',excerpt:'相对位置嵌入 RoPE 😀',description:'请核对这段译文是否与原文一致。',suggestion:'建议统一术语。',error_type:'translation',turnstile_token:'valid-test-token',website:''});
test('validated feedback is durable, retry-safe and readable without leaking contents',async()=>{
  const ctx=setup(),body=feedback();
  assert.equal((await ctx.call('/api/feedback',body)).status,202);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM feedback').get().count,1);
  assert.equal((await ctx.call('/api/feedback',body)).status,202);
  assert.equal(ctx.verifyCalls(),1);
  assert.equal((await ctx.call('/api/feedback',{...body,description:'changed'})).status,409);
  const saved=ctx.db.prepare('SELECT * FROM feedback').get();
  assert.equal(saved.excerpt,body.excerpt);assert.equal(saved.chapter_title,'旋转位置嵌入 RoPE');
  assert(!saved.client_hash.includes('192.0.2.1'));
  const receipt=await (await ctx.call('/api/feedback/'+body.id)).json();
  assert.equal(receipt.status,'pending');assert(!('excerpt' in receipt));assert(!('description' in receipt));
  ctx.db.close();
});
test('origin, schema, content size and verification are enforced',async()=>{
  const ctx=setup();
  assert.equal((await ctx.call('/api/feedback',feedback(),{Origin:'https://other.example'})).status,403);
  assert.equal((await ctx.call('/api/feedback',{...feedback(),chapter_slug:'does-not-exist'})).status,400);
  assert.equal((await ctx.call('/api/feedback',{...feedback(),description:''})).status,400);
  assert.equal((await ctx.call('/api/feedback',{...feedback(),excerpt:'字'.repeat(2001)})).status,400);
  assert.equal((await ctx.call('/api/feedback',{...feedback(),website:'spam.example'})).status,400);
  assert.equal((await ctx.call('/api/feedback',{...feedback(),extra:'x'.repeat(40000)})).status,413);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM feedback').get().count,0);
  for(const verification of [{success:false},{success:true,hostname:'other.example',action:'feedback'},{success:true,hostname:'cs336.wiki',action:'other'}]) {
    const invalid=setup(verification);assert.equal((await invalid.call('/api/feedback',feedback())).status,400);invalid.db.close();
  }
  ctx.db.close();
});
test('concurrent retries create only one durable feedback record',async()=>{
  const ctx=setup(),body=feedback();
  const responses=await Promise.all([ctx.call('/api/feedback',body),ctx.call('/api/feedback',body)]);
  assert.deepEqual(responses.map(r=>r.status),[202,202]);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS count FROM feedback').get().count,1);
  ctx.db.close();
});
test('per-reader submission limits and authorized synchronization receipts are enforced',async()=>{
  const ctx=setup(),bodies=Array.from({length:6},feedback);
  for(const b of bodies.slice(0,5))assert.equal((await ctx.call('/api/feedback',b)).status,202);
  assert.equal((await ctx.call('/api/feedback',bodies[5])).status,429);
  assert.equal((await ctx.call('/api/feedback/sync')).status,401);
  const auth={Authorization:'Bearer '+ctx.env.FEEDBACK_SYNC_TOKEN};
  const pending=await (await ctx.call('/api/feedback/sync',null,auth)).json();
  assert.equal(pending.feedback.length,5);assert(!('client_hash' in pending.feedback[0]));
  const ack={id:bodies[0].id,issue_number:27,issue_url:'https://github.com/iefnaf/cs336-wiki/issues/27'};
  assert.equal((await ctx.call('/api/feedback/sync',{...ack,issue_url:'https://other.example'},auth)).status,400);
  assert.equal((await ctx.call('/api/feedback/sync',ack,auth)).status,200);
  assert.equal((await ctx.call('/api/feedback/sync',ack,auth)).status,200);
  assert.equal((await ctx.call('/api/feedback/sync',{...ack,issue_number:28,issue_url:'https://github.com/iefnaf/cs336-wiki/issues/28'},auth)).status,409);
  assert.equal((await (await ctx.call('/api/feedback/'+bodies[0].id)).json()).status,'synced');
  ctx.db.close();
});
test('sync creates an Issue once, and recovers if acknowledgment failed',async()=>{
  const ctx=setup(),body=feedback();await ctx.call('/api/feedback',body);
  const issues=[];let failAck=true;
  const fetcher=async(url,options={})=>{
    if(url.startsWith('https://cs336.wiki')) {
      if(options.method==='POST'&&failAck){failAck=false;return Response.json({error:'temporary failure'},{status:503});}
      return ctx.worker.fetch(new Request(url,options),ctx.env);
    }
    assert.equal(options.headers.Authorization,'Bearer test-repository-token');
    if(options.method==='POST') {
      const issue=JSON.parse(options.body);assert(issue.body.includes(body.excerpt));assert(issue.labels.includes('reader-feedback'));
      const record={...issue,number:27,html_url:'https://github.com/iefnaf/cs336-wiki/issues/27'};issues.push(record);return Response.json(record,{status:201});
    }
    return Response.json(issues);
  };
  const options={fetcher,githubToken:'test-repository-token',syncToken:ctx.env.FEEDBACK_SYNC_TOKEN};
  await assert.rejects(synchronizeFeedback(options),/503/);
  assert.equal(issues.length,1);
  assert.deepEqual(await synchronizeFeedback(options),{created:0,recovered:1});
  assert.equal(issues.length,1);
  assert.equal(ctx.db.prepare('SELECT status FROM feedback').get().status,'synced');
  ctx.db.close();
});
