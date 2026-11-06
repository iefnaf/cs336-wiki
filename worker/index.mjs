import book from '../book.json' with {type:'json'};
import packageInfo from '../package.json' with {type:'json'};
import { synchronizeFeedback } from './sync.mjs';
const ORIGIN = 'https://cs336.wiki';
const TYPES = new Set(['translation','math-code','layout','other']);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const json = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
class FeedbackError extends Error {
  constructor(status,message) { super(message); this.status=status; }
}
async function readJSON(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new FeedbackError(415,'请使用 JSON 提交反馈。');
  const reader=request.body?.getReader();
  if (!reader) throw new FeedbackError(400,'反馈内容不能为空。');
  const chunks=[]; let size=0;
  for (;;) {
    const {done,value}=await reader.read();
    if(done) break;
    size+=value.byteLength;
    if(size>32768) {await reader.cancel();throw new FeedbackError(413,'反馈内容过长，请缩短后重试。');}
    chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const c of chunks) {bytes.set(c,offset);offset+=c.byteLength;}
  try {return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch {throw new FeedbackError(400,'无法读取反馈内容。');}
}
function text(value,max,required=false) {
  if(typeof value!=='string') {if(required)throw new FeedbackError(400,'请填写引用文字与问题说明。');return '';}
  const clean=value.trim();
  if((required&&!clean)||Array.from(clean).length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(clean)) throw new FeedbackError(400,'内容为空、过长或包含无效字符。');
  return clean;
}
const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
async function hasSyncAccess(request,env) {
  const supplied=request.headers.get('authorization') || '';
  if(!env.FEEDBACK_SYNC_TOKEN) return false;
  const a=await digest(supplied),b=await digest('Bearer '+env.FEEDBACK_SYNC_TOKEN);
  let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);
  return difference===0;
}
function receipt(row) {
  return {id:row.id,status:row.status,issue_url:row.issue_url||null,created_at:row.created_at};
}
export function createFeedbackWorker({fetcher=fetch,now=Date.now}={}) {
  async function submit(request,env) {
    if(request.headers.get('origin')!==ORIGIN) throw new FeedbackError(403,'请从 cs336.wiki 页面内提交反馈。');
    if(!env.FEEDBACK_DB||!env.TURNSTILE_SECRET_KEY||!env.FEEDBACK_SYNC_TOKEN) throw new FeedbackError(503,'反馈服务暂不可用，请稍后重试。');
    const data=await readJSON(request);
    if(!data||typeof data!=='object'||typeof data.id!=='string'||!UUID.test(data.id))throw new FeedbackError(400,'反馈标识无效，请重新打开表单。');
    if(data.website)throw new FeedbackError(400,'无法提交此反馈。');
    const chapter=book.chapters.find(c=>c.slug===data.chapter_slug);
    if(!chapter)throw new FeedbackError(400,'请选择手册中的有效章节。');
    const anchor=text(data.page_anchor,100);
    if(anchor&&!/^[a-zA-Z0-9_-]+$/.test(anchor))throw new FeedbackError(400,'所选位置无效。');
    if(!TYPES.has(data.error_type))throw new FeedbackError(400,'请选择问题类型。');
    const content={chapter_slug:chapter.slug,page_anchor:anchor,excerpt:text(data.excerpt,2000,true),description:text(data.description,2000,true),suggestion:text(data.suggestion,2000),error_type:data.error_type};
    const contentHash=await digest(JSON.stringify(content));
    const existing=await env.FEEDBACK_DB.prepare('SELECT * FROM feedback WHERE id = ?').bind(data.id).first();
    if(existing) {
      if(existing.content_hash!==contentHash)throw new FeedbackError(409,'该反馈已提交；若内容有变更，请重新打开表单。');
      return json(receipt(existing),existing.status==='synced'?200:202);
    }
    const token=text(data.turnstile_token,2048,true);
    let verification;
    try {
      const response=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token,idempotency_key:data.id}),
        signal:AbortSignal.timeout(10000)
      });
      if(!response.ok)throw new Error('verification unavailable');
      verification=await response.json();
    } catch {throw new FeedbackError(503,'验证服务暂不可用，你填写的内容仍保留，请稍后重试。');}
    if(!verification.success||verification.hostname!=='cs336.wiki'||verification.action!=='feedback')throw new FeedbackError(400,'验证已过期或未通过，请重新验证后提交。');
    const clientHash=await digest('feedback-rate-v1\0'+env.FEEDBACK_SYNC_TOKEN+'\0'+(request.headers.get('cf-connecting-ip')||'unknown'));
    const timestamp=now();
    const result=await env.FEEDBACK_DB.prepare(
      "INSERT INTO feedback (id,content_hash,chapter_slug,chapter_title,section,pdf_pages,page_anchor,handout_version,site_version,excerpt,description,suggestion,error_type,created_at,client_hash) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM feedback WHERE client_hash = ? AND created_at > ?) < 5 ON CONFLICT(id) DO NOTHING"
    ).bind(data.id,contentHash,chapter.slug,chapter.title,chapter.section,chapter.pages.join('–'),anchor,book.version,packageInfo.version,content.excerpt,content.description,content.suggestion,content.error_type,timestamp,clientHash,clientHash,timestamp-600000).run();
    if(!result.meta?.changes) {
      const concurrent=await env.FEEDBACK_DB.prepare('SELECT * FROM feedback WHERE id = ?').bind(data.id).first();
      if(concurrent?.content_hash===contentHash)return json(receipt(concurrent),concurrent.status==='synced'?200:202);
      if(concurrent)throw new FeedbackError(409,'该反馈已提交；请勿重复修改已提交的内容。');
      throw new FeedbackError(429,'这段时间提交较多，请 10 分钟后再试。');
    }
    return json({id:data.id,status:'pending',issue_url:null,created_at:timestamp},202);
  }
  const worker={
    async scheduled(controller,env) {
      if(!env.GITHUB_ISSUES_TOKEN) {console.error('Feedback sync skipped: GITHUB_ISSUES_TOKEN is not set');return;}
      const result=await synchronizeFeedback({
        githubToken:env.GITHUB_ISSUES_TOKEN,syncToken:env.FEEDBACK_SYNC_TOKEN,baseURL:ORIGIN,
        fetcher:(url,options)=>url.startsWith(ORIGIN+'/')?worker.fetch(new Request(url,options),env):fetcher(url,options)
      });
      console.log('Feedback sync complete',JSON.stringify(result));
    },
    async fetch(request,env) {
      const url=new URL(request.url);
      if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
      try {
        if(url.pathname==='/api/feedback/config'&&request.method==='GET') {
          if(!env.TURNSTILE_SITE_KEY)return json({error:'反馈服务暂不可用。'},503);
          return json({sitekey:env.TURNSTILE_SITE_KEY});
        }
        if(url.pathname==='/api/feedback'&&request.method==='POST')return await submit(request,env);
        if(url.pathname==='/api/feedback/sync') {
          if(!await hasSyncAccess(request,env))return json({error:'Unauthorized'},401);
          if(request.method==='GET') {
            const batch=await env.FEEDBACK_DB.prepare("SELECT id,chapter_slug,chapter_title,section,pdf_pages,page_anchor,handout_version,site_version,excerpt,description,suggestion,error_type,created_at FROM feedback WHERE status = 'pending' ORDER BY created_at LIMIT 20").all();
            return json({feedback:batch.results||[]});
          }
          if(request.method==='POST') {
            const data=await readJSON(request);
            if(!UUID.test(data?.id||'')||!Number.isSafeInteger(data.issue_number)||data.issue_number<1||data.issue_url!=='https://github.com/iefnaf/cs336-wiki/issues/'+data.issue_number)throw new FeedbackError(400,'Invalid synchronization receipt');
            const result=await env.FEEDBACK_DB.prepare("UPDATE feedback SET status = 'synced', issue_number = ?, issue_url = ?, synced_at = ? WHERE id = ? AND (status = 'pending' OR issue_number = ?)").bind(data.issue_number,data.issue_url,now(),data.id,data.issue_number).run();
            if(!result.meta?.changes)return json({error:'Feedback not found or already linked to another issue'},409);
            return json({ok:true});
          }
        }
        const match=/^\/api\/feedback\/([a-f0-9-]+)$/.exec(url.pathname);
        if(match&&request.method==='GET'&&UUID.test(match[1])) {
          const row=await env.FEEDBACK_DB.prepare('SELECT id,status,issue_url,created_at FROM feedback WHERE id = ?').bind(match[1]).first();
          return row?json(receipt(row)):json({error:'未找到反馈。'},404);
        }
        return json({error:'Not found'},404);
      } catch(error) {
        if(error instanceof FeedbackError)return json({error:error.message},error.status);
        console.error('Feedback request failed',error?.name||'Error');
        return json({error:'反馈暂时未能保存，请保留表单并稍后重试。'},503);
      }
    }
  };
  return worker;
}
export default createFeedbackWorker();
