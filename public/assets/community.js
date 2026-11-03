(() => {
  const article = document.querySelector('article.prose');
  function selectedContext() {
    const selection = window.getSelection();
    if (!article || !selection || selection.isCollapsed || !selection.anchorNode || !selection.focusNode) return null;
    if (!article.contains(selection.anchorNode) || !article.contains(selection.focusNode)) return null;
    const excerpt = selection.toString().trim();
    if (!excerpt) return null;
    const start = selection.getRangeAt(0).startContainer;
    const parent = start.nodeType === Node.ELEMENT_NODE ? start : start.parentElement;
    let section = parent.closest('section[id]');
    if (!section) {
      section = [...article.querySelectorAll('h2[id],h3[id]')].filter(h => h.contains(start) || (h.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING)).at(-1);
    }
    return {excerpt, hash: section?.id ? '#' + section.id : location.hash};
  }
  document.querySelectorAll('a.feedback-link').forEach(link => {
    const base = link.href;
    let pendingSelection = null;
    link.addEventListener('pointerdown', () => { pendingSelection = selectedContext(); });
    link.addEventListener('click', () => {
      const context = pendingSelection || selectedContext();
      pendingSelection = null;
      const issue = new URL(base);
      const page = new URL(issue.searchParams.get('page_url'));
      page.hash = context?.hash || location.hash;
      issue.searchParams.set('page_url', page.href);
      if (context) {
        let excerpt = Array.from(context.excerpt).slice(0, 500).join('');
        const truncated = context.excerpt.length > excerpt.length;
        issue.searchParams.set('excerpt', excerpt + (truncated ? '\n\n（选中文字较长，仅预填前 500 字；可在此继续补充。）' : ''));
        while (issue.href.length > 7500 && excerpt.length > 0) {
          excerpt = Array.from(excerpt).slice(0, -50).join('');
          issue.searchParams.set('excerpt', excerpt + '\n\n（选中文字较长，已缩短引用；可在此继续补充。）');
        }
      }
      link.href = issue.href;
    });
  });
})();
