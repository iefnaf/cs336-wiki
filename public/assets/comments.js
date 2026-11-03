(() => {
  const section=document.querySelector('.chapter-comments');
  if(!section)return;
  const container=section.querySelector('.giscus');
  const loading=section.querySelector('.comments-loading');
  const error=section.querySelector('.comments-error');
  let initialized=false,timer,client;
  function theme(){return document.documentElement.dataset.theme==='dark'?'dark':'light';}
  function updateTheme(){
    const frame=container.querySelector('iframe.giscus-frame');
    frame?.contentWindow?.postMessage({giscus:{setConfig:{theme:theme()}}},'https://giscus.app');
  }
  function failed(){
    clearTimeout(timer);loading.hidden=true;error.hidden=false;container.hidden=true;
  }
  function pending(){
    loading.hidden=false;error.hidden=true;container.hidden=false;
    clearTimeout(timer);timer=setTimeout(failed,25000);
  }
  function initialize(){
    if(initialized)return;
    initialized=true;pending();
    client=document.createElement('script');
    client.src='https://giscus.app/client.js';
    client.async=true;client.crossOrigin='anonymous';
    Object.assign(client.dataset,{
      repo:section.dataset.repository,
      repoId:section.dataset.repositoryId,
      category:section.dataset.category,
      categoryId:section.dataset.categoryId,
      mapping:'number',term:section.dataset.discussionNumber,
      strict:'1',reactionsEnabled:'1',emitMetadata:'1',
      inputPosition:'top',theme:theme(),lang:'zh-CN',loading:'lazy'
    });
    client.onerror=failed;
    container.append(client);
  }
  window.addEventListener('message',event=>{
    const frame=container.querySelector('iframe.giscus-frame');
    if(event.origin!=='https://giscus.app'||!frame||event.source!==frame.contentWindow)return;
    const data=event.data?.giscus;
    if(!data||typeof data!=='object')return;
    if(data.error){failed();return;}
    if(data.discussion){
      clearTimeout(timer);loading.hidden=true;error.hidden=true;container.hidden=false;
    }
  });
  section.querySelector('.comments-retry').addEventListener('click',()=>{
    const frame=container.querySelector('iframe.giscus-frame');
    if(frame){pending();frame.src=frame.src;updateTheme();}
    else{client?.remove();initialized=false;initialize();}
  });
  document.querySelectorAll('a.chapter-discussion').forEach(a=>a.addEventListener('click',initialize));
  new MutationObserver(updateTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(e=>e.isIntersecting)){initialize();observer.disconnect();}
    },{rootMargin:'500px 0px'});
    observer.observe(section);
  }else initialize();
  if(location.hash==='#discussion')initialize();
})();
