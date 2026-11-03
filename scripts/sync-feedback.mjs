const repository='iefnaf/cs336-wiki';
const api='https://api.github.com/repos/'+repository;
const site=process.env.FEEDBACK_BASE_URL||'https://cs336.wiki';
const kinds={'translation':'翻译或术语','math-code':'公式或原文代码显示','layout':'排版、链接或阅读功能','other':'其他'};
function issueBody(f) {
  const quote=f.excerpt.split('\n').map(line=>'> '+line).join('\n');
  return '<!-- cs336-feedback:'+f.id+' -->\n\n来自网页内匿名纠错；维护者可通过反馈标识核对来源。\n\n'+
    '### 所在章节\n'+f.section+' '+f.chapter_title+'\n\n### 页面链接\nhttps://cs336.wiki/assignment1/'+f.chapter_slug+'/'+(f.page_anchor?'#'+f.page_anchor:'')+
    '\n\n### 阅读版本\n原文 v'+f.handout_version+' · 网站 v'+f.site_version+'\n\n### 对应英文 PDF 页码\n'+f.pdf_pages+
    '\n\n### 问题类型\n'+kinds[f.error_type]+'\n\n### 有问题的文字\n'+quote+'\n\n### 问题描述\n'+f.description+
    '\n\n### 建议修改\n'+(f.suggestion||'未填写')+'\n\n---\n反馈标识：'+f.id;
}
export async function synchronizeFeedback({fetcher=fetch,githubToken,syncToken,baseURL=site}) {
  if(!githubToken||!syncToken)throw new Error('Missing feedback synchronization credentials');
  async function request(url,options={},github=false) {
    const response=await fetcher(url,{...options,headers:{
      Accept:'application/vnd.github+json',
      Authorization:'Bearer '+(github?githubToken:syncToken),
      ...(github?{'X-GitHub-Api-Version':'2022-11-28','User-Agent':'cs336-wiki-feedback'}:{}),
      ...(options.body?{'Content-Type':'application/json'}:{}),
      ...options.headers
    },signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error('Feedback sync HTTP '+response.status+' at '+new URL(url).pathname);
    return response.json();
  }
  const pending=await request(baseURL+'/api/feedback/sync');
  if(!pending.feedback.length)return {created:0,recovered:0};
  const existing=new Map();
  for(let page=1;;page++) {
    const issues=await request(api+'/issues?state=all&labels=reader-feedback&per_page=100&page='+page,{},true);
    for(const issue of issues) {
      const marker=/<!-- cs336-feedback:([a-f0-9-]+) -->/.exec(issue.body||'');
      if(marker)existing.set(marker[1],issue);
    }
    if(issues.length<100)break;
  }
  let created=0,recovered=0;
  for(const feedback of pending.feedback) {
    let issue=existing.get(feedback.id);
    if(!issue) {
      issue=await request(api+'/issues',{method:'POST',body:JSON.stringify({
        title:'[页内纠错] '+feedback.section+' '+feedback.chapter_title,
        body:issueBody(feedback),
        labels:['errata','needs-triage','reader-feedback',...(feedback.error_type==='other'?[]:[feedback.error_type])]
      })},true);
      existing.set(feedback.id,issue);created++;
    } else recovered++;
    await request(baseURL+'/api/feedback/sync',{method:'POST',body:JSON.stringify({id:feedback.id,issue_number:issue.number,issue_url:issue.html_url})});
  }
  return {created,recovered};
}
if(import.meta.url===new URL(process.argv[1],'file:').href) {
  synchronizeFeedback({githubToken:process.env.GH_TOKEN,syncToken:process.env.FEEDBACK_SYNC_TOKEN})
    .then(result=>console.log('Feedback sync complete: '+JSON.stringify(result)))
    .catch(error=>{console.error(error.message);process.exitCode=1;});
}
