(() => {
  const article=document.querySelector('article.prose');
  const links=[...document.querySelectorAll('a.feedback-link')];
  if(!article||!links.length)return;
  const metadata=new URL(links[0].href).searchParams;
  const chapterSlug=document.body.dataset.chapter;
  const bubble=document.createElement('button');
  bubble.type='button';bubble.className='selection-feedback';bubble.hidden=true;
  bubble.textContent='反馈这处错误';bubble.setAttribute('aria-label','反馈选中的文字');
  document.body.append(bubble);
  const panel=document.createElement('dialog');
  panel.className='feedback-dialog';panel.setAttribute('aria-labelledby','feedback-title');
  panel.innerHTML=[
    '<div class="feedback-heading"><div><small>帮助完善这一章</small><h2 id="feedback-title">反馈这处错误</h2></div><button type="button" class="feedback-close" aria-label="关闭反馈">×</button></div>',
    '<form class="feedback-form"><p class="feedback-location"></p>',
    '<label for="feedback-excerpt">有问题的文字</label><textarea id="feedback-excerpt" name="excerpt" rows="3" maxlength="4000" required placeholder="先选中正文中的错误文字，也可以在这里填写。"></textarea>',
    '<p class="feedback-truncation" hidden>选文较长，引用保留前 2,000 字。可以缩小选中范围，让定位更准确。</p>',
    '<label for="feedback-kind">问题类型</label><select id="feedback-kind" name="error_type"><option value="translation">翻译或术语</option><option value="math-code">公式或原文代码显示</option><option value="layout">排版、链接或阅读功能</option><option value="other">其他</option></select>',
    '<label for="feedback-description">哪里有问题？ <span>必填</span></label><textarea id="feedback-description" name="description" rows="3" maxlength="2000" required placeholder="例如：这句话与英文原文的意思不一致……"></textarea>',
    '<label for="feedback-suggestion">建议怎样修改？ <span>选填</span></label><textarea id="feedback-suggestion" name="suggestion" rows="2" maxlength="2000" placeholder="可以填写建议译法或原文依据。"></textarea>',
    '<div class="feedback-trap" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>',
    '<div class="feedback-verification"><div id="feedback-challenge"></div><span class="feedback-verification-status" role="status">正在准备验证…</span><button type="button" class="feedback-reverify" hidden>重新验证</button></div>',
    '<p class="feedback-error" role="alert" hidden></p><div class="feedback-submit-row"><small>无需登录；提交后将公开同步到 GitHub。</small><button type="submit" class="feedback-submit" disabled>提交反馈</button></div></form>',
    '<div class="feedback-success" hidden><span class="feedback-success-icon" aria-hidden="true">✓</span><h3>反馈已收到</h3><p>已保存，会由后台同步到 GitHub。你可以继续阅读。</p><small class="feedback-receipt"></small><a class="feedback-issue" target="_blank" rel="noopener noreferrer" hidden>查看对应 Issue ↗</a><button type="button" class="feedback-done">继续阅读</button></div>'
  ].join('');
  document.body.append(panel);
  const form=panel.querySelector('form');
  const excerpt=panel.querySelector('#feedback-excerpt');
  const description=panel.querySelector('#feedback-description');
  const suggestion=panel.querySelector('#feedback-suggestion');
  const kind=panel.querySelector('#feedback-kind');
  const submit=panel.querySelector('.feedback-submit');
  const error=panel.querySelector('.feedback-error');
  const verifyStatus=panel.querySelector('.feedback-verification-status');
  const reverify=panel.querySelector('.feedback-reverify');
  let selected=null,draft=null,widgetId=null,turnstileToken='',verificationGeneration=0;
  let busy=false,succeeded=false,pollTimer,selectionTimer,turnstilePromise,turnstileLoadSequence=0;
  function selectionContext() {
    const selection=window.getSelection();
    if(!selection||selection.isCollapsed||!selection.rangeCount||!article.contains(selection.anchorNode)||!article.contains(selection.focusNode))return null;
    const range=selection.getRangeAt(0).cloneRange(),quote=selection.toString().trim();
    if(!quote)return null;
    const parent=range.startContainer.nodeType===Node.ELEMENT_NODE?range.startContainer:range.startContainer.parentElement;
    let section=parent.closest('section[id]');
    if(!section)section=[...article.querySelectorAll('h2[id],h3[id]')].filter(h=>h.contains(range.startContainer)||(h.compareDocumentPosition(range.startContainer)&Node.DOCUMENT_POSITION_FOLLOWING)).at(-1);
    return {quote:Array.from(quote).slice(0,2000).join(''),truncated:Array.from(quote).length>2000,anchor:section?.id||location.hash.slice(1),range};
  }
  function showSelection() {
    if(panel.open)return;
    selected=selectionContext();
    if(!selected){bubble.hidden=true;return;}
    const rects=[...selected.range.getClientRects()].filter(r=>r.width&&r.height);
    if(!rects.length){bubble.hidden=true;return;}
    const last=rects.at(-1),first=rects[0];
    if(last.bottom<0||first.top>innerHeight){bubble.hidden=true;return;}
    bubble.hidden=false;
    const width=bubble.offsetWidth,height=bubble.offsetHeight;
    bubble.style.left=Math.min(innerWidth-width-12,Math.max(12,last.right-width/2))+'px';
    bubble.style.top=(last.bottom+height+16<innerHeight?last.bottom+8:Math.max(10,first.top-height-8))+'px';
  }
  function scheduleSelection(){clearTimeout(selectionTimer);selectionTimer=setTimeout(showSelection,90);}
  document.addEventListener('selectionchange',scheduleSelection);
  document.addEventListener('pointerup',scheduleSelection);
  window.addEventListener('scroll',scheduleSelection,{passive:true});
  window.addEventListener('resize',scheduleSelection);
  function highlight(range) {
    if(globalThis.CSS?.highlights&&globalThis.Highlight&&range)CSS.highlights.set('feedback-selection',new Highlight(range));
  }
  function clearHighlight(){globalThis.CSS?.highlights?.delete('feedback-selection');}
  function loadTurnstile() {
    if(window.turnstile)return Promise.resolve(window.turnstile);
    if(turnstilePromise)return turnstilePromise;
    turnstilePromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      const callbackName='cs336TurnstileLoaded'+(++turnstileLoadSequence);
      const timeout=setTimeout(()=>{script.remove();delete window[callbackName];reject(new Error('验证组件加载较慢，请重试。'));},15000);
      window[callbackName]=()=>{clearTimeout(timeout);delete window[callbackName];resolve(window.turnstile);};
      script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload='+callbackName;script.async=true;
      script.onerror=()=>{clearTimeout(timeout);script.remove();delete window[callbackName];reject(new Error('验证组件未能加载，请检查网络后重试。'));};
      document.head.append(script);
    }).catch(e=>{turnstilePromise=null;throw e;});
    return turnstilePromise;
  }
  async function prepareVerification() {
    const generation=++verificationGeneration;
    turnstileToken='';submit.disabled=true;reverify.hidden=true;verifyStatus.textContent='正在准备验证…';
    if(widgetId!==null&&window.turnstile){window.turnstile.remove(widgetId);widgetId=null;}
    try {
      const [response,turnstile]=await Promise.all([fetch('/api/feedback/config',{signal:AbortSignal.timeout(12000)}),loadTurnstile()]);
      if(!response.ok)throw new Error('反馈服务暂不可用，请稍后重试。');
      const config=await response.json();
      if(!panel.open||generation!==verificationGeneration)return;
      verifyStatus.textContent='正在验证…';
      widgetId=turnstile.render('#feedback-challenge',{
        sitekey:config.sitekey,action:'feedback',theme:document.documentElement.dataset.theme==='dark'?'dark':'light',language:'zh-cn',size:'flexible',
        callback:token=>{if(generation!==verificationGeneration)return;turnstileToken=token;submit.disabled=busy;verifyStatus.textContent='验证已通过';reverify.hidden=true;},
        'expired-callback':()=>{if(generation!==verificationGeneration)return;turnstileToken='';submit.disabled=true;verifyStatus.textContent='验证已过期，请重新验证。';reverify.hidden=false;},
        'error-callback':()=>{if(generation!==verificationGeneration)return;turnstileToken='';submit.disabled=true;verifyStatus.textContent='验证暂未通过，请重试。';reverify.hidden=false;}
      });
    } catch(e) {
      if(!panel.open||generation!==verificationGeneration)return;
      verifyStatus.textContent=e.message;reverify.hidden=false;
    }
  }
  function openFeedback(context) {
    if(panel.open)return;
    if(succeeded){form.reset();draft=null;succeeded=false;}
    const quote=context?.quote||draft?.quote||'';
    if(!draft||quote!==draft.quote){form.reset();draft={id:crypto.randomUUID(),quote,anchor:context?.anchor||location.hash.slice(1)};}
    else if(context)draft.anchor=context.anchor;
    excerpt.value=quote;panel.querySelector('.feedback-truncation').hidden=!context?.truncated;
    panel.querySelector('.feedback-location').textContent=metadata.get('chapter')+' · 原文 p. '+metadata.get('pdf_pages');
    error.hidden=true;form.hidden=false;panel.querySelector('.feedback-success').hidden=true;
    bubble.hidden=true;highlight(context?.range);panel.showModal();
    if(quote)description.focus();else excerpt.focus();
    prepareVerification();
  }
  bubble.addEventListener('pointerdown',e=>e.preventDefault());
  bubble.addEventListener('click',()=>openFeedback(selected));
  links.forEach(link=>{
    let pending;
    link.addEventListener('pointerdown',()=>{pending=selectionContext();});
    link.addEventListener('click',e=>{e.preventDefault();openFeedback(pending||selectionContext());pending=null;});
  });
  panel.querySelector('.feedback-close').addEventListener('click',()=>{if(!busy)panel.close();});
  panel.querySelector('.feedback-done').addEventListener('click',()=>panel.close());
  panel.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  panel.addEventListener('close',()=>{
    verificationGeneration++;clearTimeout(pollTimer);clearHighlight();
    if(widgetId!==null&&window.turnstile){window.turnstile.remove(widgetId);widgetId=null;}
    bubble.hidden=true;window.getSelection()?.removeAllRanges();
    if(!succeeded&&draft)draft.quote=excerpt.value;
  });
  reverify.addEventListener('click',prepareVerification);
  async function pollReceipt(id) {
    if(!panel.open)return;
    try {
      const response=await fetch('/api/feedback/'+id,{signal:AbortSignal.timeout(10000)});
      if(response.ok) {
        const status=await response.json();
        if(status.issue_url?.startsWith('https://github.com/iefnaf/cs336-wiki/issues/')) {
          const link=panel.querySelector('.feedback-issue');link.href=status.issue_url;link.hidden=false;
          panel.querySelector('.feedback-success>p').textContent='已同步到 GitHub。感谢你帮助完善这本手册。';return;
        }
      }
    } catch {}
    pollTimer=setTimeout(()=>pollReceipt(id),15000);
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy||!form.reportValidity())return;
    if(!turnstileToken){verifyStatus.textContent='请先完成验证。';return;}
    busy=true;submit.disabled=true;submit.textContent='正在提交…';error.hidden=true;
    panel.querySelector('.feedback-close').disabled=true;
    try {
      const response=await fetch('/api/feedback',{
        method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),
        body:JSON.stringify({id:draft.id,chapter_slug:chapterSlug,page_anchor:draft.anchor,excerpt:excerpt.value,description:description.value,suggestion:suggestion.value,error_type:kind.value,website:form.elements.website.value,turnstile_token:turnstileToken})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'暂时未能提交，请稍后重试。');
      if(data.id!==draft.id||!['pending','synced'].includes(data.status))throw new Error('服务响应异常，请保留表单并重试。');
      succeeded=true;form.hidden=true;panel.querySelector('.feedback-success').hidden=false;
      panel.querySelector('.feedback-issue').hidden=true;
      panel.querySelector('.feedback-success>p').textContent='已保存，会由后台同步到 GitHub。你可以继续阅读。';
      panel.querySelector('.feedback-receipt').textContent='反馈编号：'+data.id;
      panel.querySelector('.feedback-done').focus();pollReceipt(data.id);
    } catch(e) {
      error.textContent=e.name==='TimeoutError'?'请求超时，你填写的内容仍保留，请重试。':e.message;error.hidden=false;
      prepareVerification();
    } finally {busy=false;submit.disabled=!turnstileToken;submit.textContent='提交反馈';panel.querySelector('.feedback-close').disabled=false;}
  });
})();
