const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const readStorage = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const writeStorage = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const menu = $('.menu-toggle');
function closeMenu() {
  document.body.classList.remove('nav-open');
  menu?.setAttribute('aria-expanded', 'false');
  menu?.setAttribute('aria-label', '打开章节目录');
}
menu?.addEventListener('click', () => {
  const open = document.body.classList.toggle('nav-open');
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? '关闭章节目录' : '打开章节目录');
});
$('.nav-scrim')?.addEventListener('click', closeMenu);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
$$('.theme-toggle').forEach(button => button.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('cs336-theme', next); } catch {}
}));
const active = $('.sidebar [aria-current="page"]');
if (active && matchMedia('(min-width: 801px)').matches) {
  const nav = $('.sidebar nav');
  const offset = active.getBoundingClientRect().top - nav.getBoundingClientRect().top;
  if (offset > nav.clientHeight - 80) nav.scrollTop = offset - nav.clientHeight / 2;
}
let toastTimer;
function toast(message) {
  $('.toast').textContent = message;
  $('.toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('.toast').classList.remove('show'), 1800);
}
$$('.copy-code').forEach(button => button.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(button.closest('.code-wrap').querySelector('pre').textContent);
    toast('已复制原文代码');
  } catch { toast('复制失败，请手动选择文本'); }
}));
const title = $('main h1')?.textContent;
const chapter = document.body.dataset.chapter;
const previous = readStorage('cs336-last-read');
if (!chapter && previous?.path?.startsWith('/assignment1/')) {
  const link = $('.continue-link');
  if (link) { link.hidden = false; link.href = previous.path; link.textContent = '继续：' + previous.title + ' ↗'; }
}
if (chapter && !location.hash && previous?.path === location.pathname && previous.scroll > 0) {
  requestAnimationFrame(() => window.scrollTo({ top: previous.scroll, behavior: 'instant' }));
}
function saveReading() {
  if (chapter) writeStorage('cs336-last-read', { path: location.pathname, title, scroll: window.scrollY });
}
let scrollTimer;
window.addEventListener('scroll', () => {
  const available = document.documentElement.scrollHeight - innerHeight;
  $('.reading-progress').style.width = (available > 0 ? scrollY / available * 100 : 0) + '%';
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(saveReading, 250);
}, { passive: true });
window.addEventListener('pagehide', saveReading);
if (chapter) setTimeout(saveReading, 300);
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      $$('.page-toc a').forEach(a => a.classList.toggle('active', a.hash === '#' + entry.target.id));
    }
  }, {rootMargin:'-80px 0px -65% 0px'});
  $$('main h2[id], main h3[id], main section[id]').forEach(h => observer.observe(h));
}
document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName) || $('.search-dialog').open || document.activeElement?.isContentEditable) return;
  if (e.key === 'ArrowRight') $('.pager .next')?.click();
  if (e.key === 'ArrowLeft') $('.pager a:not(.next)')?.click();
});

const dialog = $('.search-dialog');
const input = $('#search-input');
const results = $('#search-results');
let searchIndexPromise;
let selected = -1;
let searchVersion = 0;
function openSearch() {
  closeMenu();
  dialog.showModal();
  input.focus();
  searchIndexPromise ||= fetch('/search-index.json').then(r => {
    if (!r.ok) throw new Error('index unavailable');
    return r.json();
  }).catch(e => { searchIndexPromise = null; throw e; });
  searchIndexPromise.catch(() => { results.textContent = '搜索暂时不可用，请重试或使用左侧目录。'; });
}
$$('.search-trigger').forEach(b => b.addEventListener('click', openSearch));
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    dialog.open ? dialog.close() : openSearch();
  }
});
dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
function highlight(node, text, terms) {
  const term = terms.find(t => text.toLowerCase().includes(t));
  if (!term) { node.textContent = text; return; }
  const position = text.toLowerCase().indexOf(term);
  node.append(document.createTextNode(text.slice(0, position)));
  const mark = document.createElement('mark');
  mark.textContent = text.slice(position, position + term.length);
  node.append(mark, document.createTextNode(text.slice(position + term.length)));
}
async function runSearch() {
  const version = ++searchVersion;
  const query = input.value.trim().toLowerCase();
  selected = -1;
  if (!query) { results.innerHTML = '<p class="search-help">输入中文、英文术语或题号，例如 RoPE、检查点、train_bpe。</p>'; return; }
  let index;
  try { index = await searchIndexPromise; } catch { return; }
  if (version !== searchVersion) return;
  const terms = query.split(/\s+/).filter(Boolean);
  const matches = index.map(item => {
    const heading = (item.title + ' ' + item.group + ' ' + item.section).toLowerCase();
    const body = item.text.toLowerCase();
    if (!terms.every(t => heading.includes(t) || body.includes(t))) return null;
    const score = terms.reduce((s,t) => s + (item.title.toLowerCase().includes(t) ? 50 : 0) + (heading.includes(t) ? 15 : 0) + (body.includes(t) ? 1 : 0), 0);
    return {item,score};
  }).filter(Boolean).sort((a,b) => b.score-a.score).slice(0,14);
  results.replaceChildren();
  if (!matches.length) { const p = document.createElement('p'); p.className = 'search-help'; p.textContent = '没有找到“' + input.value.trim() + '”。试试英文术语或更短的关键词。'; results.append(p); return; }
  for (const {item} of matches) {
    const link = document.createElement('a'); link.href = item.url; link.className = 'search-result';
    const group = document.createElement('small'); group.textContent = item.group + ' · ' + item.section;
    const strong = document.createElement('strong'); highlight(strong, item.title, terms);
    const p = document.createElement('p');
    const location = Math.max(0, item.text.toLowerCase().indexOf(terms[0]));
    const start = Math.max(0, location - 32);
    highlight(p, (start ? '…' : '') + item.text.slice(start, start + 125) + (item.text.length > start + 125 ? '…' : ''), terms);
    link.append(group,strong,p); results.append(link);
  }
}
input.addEventListener('input', runSearch);
input.addEventListener('keydown', e => {
  const links = $$('.search-result');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!links.length) return;
    selected = (selected + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
    links.forEach((a,i) => a.classList.toggle('selected', i === selected));
    links[selected].scrollIntoView({block:'nearest'});
  } else if (e.key === 'Enter') {
    e.preventDefault();
    links[selected >= 0 ? selected : 0]?.click();
  }
});
