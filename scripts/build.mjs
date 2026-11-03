import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import { createCommunity } from './community.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const book = JSON.parse(await fs.readFile(path.join(root, 'book.json'), 'utf8'));
const communityConfig = JSON.parse(await fs.readFile(path.join(root, 'community.json'), 'utf8'));
const siteVersion = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version;
const communityFeatures = createCommunity({book, config: communityConfig, siteVersion});
const source = await fs.readFile(path.join(root, 'source/handout.en.txt'), 'utf8');
const pdf = await fs.readFile(path.join(root, 'public/source/cs336_assignment1_basics.pdf'));
if (crypto.createHash('sha256').update(pdf).digest('hex') !== book.source_sha256) throw new Error('Source PDF checksum mismatch');
const dist = path.join(root, 'dist');
await fs.mkdir(dist, { recursive: true });
await fs.cp(path.join(root, 'public'), dist, { recursive: true });
await fs.cp(path.join(root, 'node_modules/katex/dist'), path.join(dist, 'assets/katex'), { recursive: true });
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain = s => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const url = c => '/assignment1/' + c.slug + '/';
const groups = [...new Set(book.chapters.map(c => c.group))];
const md = new MarkdownIt({ html: true, linkify: true, typographer: false })
  .use(texmath, { engine: katex, delimiters: 'dollars', katexOptions: { throwOnError: true, strict: 'error', trust: false } });
const sourceStart = marker => {
  const found = new RegExp('(?:^|[\\n\\f])' + marker.replace(/[.*+?^$()|[\]\\]/g, '\\$&') + '(?=\\n|$)').exec(source);
  return found ? found.index + found[0].length - marker.length : -1;
};
const originalChunks = book.chapters.map((c, i) => {
  const start = sourceStart(c.marker);
  const end = i + 1 < book.chapters.length ? sourceStart(book.chapters[i + 1].marker) : source.length;
  if (start < 0 || end <= start) throw new Error('Source boundary invalid: ' + c.slug);
  return source.slice(start, end).replace(/\n\s*\d+\s*\n\f/g, '\n\n').replace(/\f/g, '\n').trim();
});
const range = (start, end) => {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error('Missing source excerpt: ' + start);
  const lines = source.slice(a, b).replace(/\n\s*\d+\s*\n\f/g, '\n').replace(/\f/g, '').split('\n');
  const indent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
  return lines.map(l => l.slice(indent)).join('\n').trim();
};
const excerpts = {
  'wrong-utf8': range('        def decode_utf8_bytes_to_str_wrong', '\n        Deliverable:'),
  'gpt2-pattern': source.split('\n').find(l => l.startsWith('>>> PAT')),
  'einsum-matmul': range('    import torch\n    from einops', '\n\n\n\n Example (einstein_example2)'),
  'einsum-broadcast': range('    images = torch.randn', '\n   4\n'),
  'einsum-pixels': [
    range('   channels_last = torch.randn', '\n   Instead, using einops:'),
    range('   height = width = 32\n   ## Rearrange', '\n   Or, if you'),
    range('   height = width = 32\n   channels_last_transformed = einx.dot', '\n   The first implementation here')
  ],
  'rmsnorm-dtype': range('  in_dtype = x.dtype', '\n\n\n Problem (rmsnorm)'),
  'sgd-example': range('from collections.abc import Callable', '\nIn __init__'),
  'sgd-loop': range('weights = torch.nn.Parameter', '\nThis is the typical')
};
// The PDF text extractor shifts these five lines one space to the right.
excerpts['sgd-example'] = excerpts['sgd-example'].replace(/^ {17}(?=\S)/gm, '                ');
const codeBlock = code => '<div class="code-wrap"><div class="code-bar"><span>指导书原文</span><button class="copy-code" type="button">复制</button></div><pre><code>' + esc(code) + '</code></pre></div>';
const search = [];
const stats = { chapters: book.chapters.length, problems: [], equations: [], words: 0 };
const rendered = [];
for (let i = 0; i < book.chapters.length; i++) {
  const chapter = book.chapters[i];
  let content = await fs.readFile(path.join(root, 'content', chapter.slug + '.md'), 'utf8');
  const stack = [];
  content = content.replace(/^:::(?: (problem|tip|example|note) (.+))?$/gm, (_, kind, info) => {
    if (!kind) {
      if (!stack.length) throw new Error('Unmatched container in ' + chapter.slug);
      stack.pop();
      return '</section>\n';
    }
    stack.push(kind);
    if (kind === 'problem') {
      const [id, title, points, budget] = info.split('|').map(s => s.trim());
      stats.problems.push({ id, title, points: Number(points), slug: chapter.slug });
      return '<section class="callout problem" id="' + esc(id) + '">\n<div class="callout-label">练习 <code>' + esc(id) + '</code><span>' + esc(points) + ' 分' + (budget ? ' · ' + esc(budget) : '') + '</span></div>\n<h3>' + esc(title) + '</h3>\n';
    }
    if (kind === 'example') {
      const [id, title] = info.split('|').map(s => s.trim());
      return '<section class="callout example" id="' + esc(id) + '">\n<div class="callout-label">原文示例 <code>' + esc(id) + '</code></div>\n<h3>' + esc(title) + '</h3>\n';
    }
    return '<section class="callout ' + kind + '">\n<div class="callout-label">' + (kind === 'tip' ? '低资源提示' : '编者说明') + '</div>\n<h3>' + esc(info.replace(/^低资源提示[：:]?/, '')) + '</h3>\n';
  });
  if (stack.length) throw new Error('Unclosed container in ' + chapter.slug);
  for (const match of content.matchAll(/\\tag\{(\d+)\}/g)) stats.equations.push(Number(match[1]));
  const tokens = md.parse(content, {});
  const toc = [];
  let counter = 0;
  for (let t = 0; t < tokens.length; t++) {
    if (tokens[t].type === 'heading_open') {
      const title = tokens[t + 1].content;
      const id = 'section-' + (++counter);
      tokens[t].attrSet('id', id);
      toc.push({ title, id, level: tokens[t].tag });
    }
  }
  let html = md.renderer.render(tokens, md.options, {});
  html = html.replace(/<div data-excerpt="([^"]+)"><\/div>/g, (_, key) => {
    if (!excerpts[key]) throw new Error('Missing excerpt: ' + key);
    return Array.isArray(excerpts[key]) ? excerpts[key].map(codeBlock).join('\n') : codeBlock(excerpts[key]);
  });
  html = html.replace(/<table>/g, '<div class="table-scroll" tabindex="0" role="region" aria-label="可横向滚动的表格"><table>').replace(/<\/table>/g, '</table></div>');
  html = html.replace(/<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g, (_, level, id, text) =>
    '<h' + level + ' id="' + id + '">' + text + '<a class="heading-link" href="#' + id + '" aria-label="此节永久链接">#</a></h' + level + '>');
  const text = plain(html);
  stats.words += (text.match(/[\u3400-\u9fff]/g) || []).length;
  const description = chapter.title + '：CS336 2026 作业 1 中文指导书，第 ' + chapter.section + ' 节。保留题目要求、公式和英文原文对照。';
  search.push({ title: chapter.title, group: chapter.group, section: chapter.section, url: url(chapter), text });
  for (const problem of stats.problems.filter(p => p.slug === chapter.slug)) search.push({title: problem.title, group: '练习 · ' + problem.id, section: chapter.section, url: url(chapter) + '#' + problem.id, text: problem.id + ' ' + problem.title });
  rendered.push({ chapter, html, toc, description, original: originalChunks[i] });
}

const icon = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 7h8a4 4 0 0 1 4 4v15a5 5 0 0 0-4-2H5V7Z" stroke="currentColor" stroke-width="1.6"/><path d="M17 11a4 4 0 0 1 4-4h6v17h-6a5 5 0 0 0-4 2" stroke="currentColor" stroke-width="1.6"/></svg>';
function sidebar(current) {
  return '<aside class="sidebar" id="sidebar"><a class="brand" href="/">' + icon + '<div><strong>CS336<span>.wiki</span></strong><small>从零开始，理解语言模型</small></div></a><div class="edition"><span class="status-dot"></span>2026 春季 · v' + book.version + '</div><button class="search-trigger" type="button"><span>⌕ &nbsp; 搜索手册</span><kbd>⌘ K</kbd></button><nav aria-label="章节目录"><a class="nav-home ' + (!current ? 'active' : '') + '" href="/">阅读指南</a>' + groups.map((g, i) =>
    '<div class="nav-group"><p><span>0' + (i + 1) + '</span>' + esc(g) + '</p>' +
    book.chapters.filter(c => c.group === g).map(c => '<a href="' + url(c) + '"' + (current === c.slug ? ' class="active" aria-current="page"' : '') + '><span class="nav-section">' + esc(c.section) + '</span><span>' + esc(c.title) + '</span></a>').join('') + '</div>').join('') + '</nav><div class="sidebar-foot"><button class="theme-toggle sidebar-theme" aria-label="切换深色模式">◐ <span>切换阅读外观</span></button><a href="/source/cs336_assignment1_basics.pdf" target="_blank" rel="noopener">↗ 英文原版 PDF</a><p>非官方中文翻译 · MIT 许可</p></div></aside>';
}
function shell({title, description, slug, content, toc = []}) {
  const canonical = 'https://cs336.wiki' + (slug === 'community' ? '/community/' : slug ? '/assignment1/' + slug + '/' : '/');
  const html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>' + esc(title) + ' · CS336 中文实验手册</title><meta name="description" content="' + esc(description) + '"><link rel="canonical" href="' + canonical + '"><meta property="og:title" content="' + esc(title) + ' · CS336.wiki"><meta property="og:description" content="' + esc(description) + '"><meta property="og:type" content="book"><meta property="og:locale" content="zh_CN"><meta property="og:url" content="' + canonical + '"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/katex/katex.min.css"><link rel="stylesheet" href="/assets/style.css"><script src="/assets/theme.js"></script><script src="/assets/app.js" defer></script></head><body data-chapter="' + esc(slug || '') + '"><a class="skip-link" href="#main">跳到正文</a><div class="reading-progress" aria-hidden="true"></div><header class="mobile-header"><button class="menu-toggle" aria-label="打开章节目录" aria-controls="sidebar" aria-expanded="false">☰</button><a href="/">CS336.wiki</a><button class="search-trigger" aria-label="搜索手册">⌕</button></header><div class="nav-scrim"></div>' + sidebar(slug) + '<div class="page"><header class="topbar"><div><a href="/">CS336 中文实验手册</a><span>/</span><span>' + esc(book.chapters.find(c => c.slug === slug)?.group || (slug === 'community' ? '读者社区' : '阅读指南')) + '</span></div><button class="theme-toggle" aria-label="切换深色模式" title="切换深色模式">◐ <span>阅读外观</span></button></header><div class="reading-layout"><main id="main" tabindex="-1">' + content + '</main><aside class="page-toc" aria-label="本页目录"><p>本页内容</p><nav>' + toc.map(t => '<a class="' + (t.level === 'h3' ? 'sub' : '') + '" href="#' + t.id + '">' + esc(t.title) + '</a>').join('') + '</nav><div class="toc-foot">读有所获，学有所成。<br>以英文原版为准。</div></aside></div><footer class="site-footer"><span>CS336.wiki · 非官方中文阅读版</span><a href="/assignment1/references/#section-2">来源与翻译说明</a><span>© Stanford University · <a href="/source/LICENSE.txt">MIT</a></span></footer></div><dialog class="search-dialog" aria-label="搜索手册"><form method="dialog"><div class="search-input-row"><span aria-hidden="true">⌕</span><input id="search-input" type="search" placeholder="搜索章节、概念或题号…" aria-label="搜索关键词" autocomplete="off"><button aria-label="关闭搜索">Esc</button></div></form><div id="search-results" aria-live="polite"><p class="search-help">输入中文、英文术语或题号，例如 RoPE、检查点、train_bpe。</p></div><div class="search-footer">↑ ↓ 选择 &nbsp; ↵ 打开 &nbsp; Esc 关闭<span>全文搜索 · 本地完成</span></div></dialog><div class="toast" role="status"></div></body></html>';
  return communityFeatures.decorate(html, {title, slug});
}

for (let i = 0; i < rendered.length; i++) {
  const {chapter, html, toc, description, original} = rendered[i];
  const prev = book.chapters[i - 1], next = book.chapters[i + 1];
  const originalLink = '/source/cs336_assignment1_basics.pdf#page=' + chapter.pages[0];
  const header = '<div class="chapter-eyebrow">ASSIGNMENT 01 <span>/</span> ' + esc(chapter.section) + '</div><h1>' + esc(chapter.title) + '</h1><div class="chapter-meta"><span>2026 春季 · v26.0.3</span><span>原文 p. ' + chapter.pages.join('–') + '</span><a href="' + originalLink + '" target="_blank" rel="noopener">对照 PDF ↗</a></div>';
  const originalHTML = '<details class="original" id="original"><summary><span>English original</span> 展开本章英文原文 <small>PDF 文本提取</small></summary><div><p>下列文本提取自本地原版 PDF。图表和公式的准确布局请<a href="' + originalLink + '" target="_blank" rel="noopener">对照 PDF</a>。</p><pre lang="en">' + esc(original) + '</pre></div></details>';
  const pager = '<nav class="pager" aria-label="翻页">' + (prev ? '<a href="' + url(prev) + '"><small>← 上一章</small><strong>' + esc(prev.title) + '</strong></a>' : '<a href="/"><small>← 返回</small><strong>阅读指南</strong></a>') + (next ? '<a class="next" href="' + url(next) + '"><small>下一章 →</small><strong>' + esc(next.title) + '</strong></a>' : '<a class="next" href="/"><small>已读至末章</small><strong>返回阅读指南 ↗</strong></a>') + '</nav>';
  const out = path.join(dist, 'assignment1', chapter.slug);
  await fs.mkdir(out, {recursive: true});
  await fs.writeFile(path.join(out, 'index.html'), shell({title: chapter.title, description, slug: chapter.slug, toc, content: header + communityFeatures.readerTools(chapter) + '<article class="prose">' + html + '</article>' + communityFeatures.readerSupport(chapter) + originalHTML + pager}));
}
const homeToc = groups.map((title, i) => ({ title, id: 'part-' + i, level: 'h2' }));
const home = '<div class="home-eyebrow"><span class="status-dot"></span> STANFORD CS336 · SPRING 2026</div><h1 class="home-title">从零构建<br>Transformer <em>语言模型</em></h1><p class="home-subtitle">CS336 作业 1 · 中文实验手册</p><p class="home-description">从第一个字节，到第一段生成文本。把 47 页实验指导书，变成可以逐章阅读、检索与对照的中文电子书。</p><div class="home-actions"><a class="primary-button" href="/assignment1/overview/">开始阅读 <span>→</span></a><a class="continue-link" hidden href="/assignment1/overview/">继续上次阅读 ↗</a><a class="pdf-button" href="/source/cs336_assignment1_basics.pdf" target="_blank" rel="noopener">英文原版 PDF ↗</a></div><div class="book-facts"><div><strong>25</strong><span>阅读章节</span></div><div><strong>' + stats.problems.length + '</strong><span>原版练习</span></div><div><strong>v26.0.3</strong><span>原文版本</span></div></div><div class="translation-note"><strong>关于这个版本</strong><p>非官方中文翻译，保留原版题号、分值、公式和交付要求。每章附英文原文与 PDF 页码。译文由 AI 辅助整理，尚未经课程工作人员审校；如有差异，以所附英文 PDF 为准。</p></div><div class="contents-heading"><div class="chapter-eyebrow">CONTENTS</div><h2>阅读目录</h2><p>循着指导书的顺序，也可以从你正在学习的章节开始。</p></div>' + groups.map((g, i) => '<section class="contents-part" id="part-' + i + '"><h2><span>0' + (i + 1) + '</span>' + esc(g) + '</h2>' + book.chapters.filter(c => c.group === g).map(c => '<a class="contents-row" href="' + url(c) + '"><span class="contents-number">' + esc(c.section) + '</span><strong>' + esc(c.title) + '</strong><span class="contents-pages">p. ' + c.pages.join('–') + '</span><span class="contents-arrow">↗</span></a>').join('') + '</section>').join('') + '<div class="end-note">一本手册，一次从零开始的练习。<br><a href="https://cs336.stanford.edu/">课程网站 ↗</a> &nbsp; <a href="https://github.com/stanford-cs336/assignment1-basics">原始作业 ↗</a></div>';
await fs.writeFile(path.join(dist, 'index.html'), shell({title: '从零构建 Transformer 语言模型', description: 'Stanford CS336 2026 作业 1 中文电子书：BPE 分词器、Transformer、AdamW、训练与实验。按章节阅读，支持搜索、公式和英文原文对照。', content: home, toc: homeToc}));
await fs.mkdir(path.join(dist, 'community'), {recursive:true});
await fs.writeFile(path.join(dist, 'community/index.html'), shell({title:'读者社区',description:'CS336.wiki 读者纠错与章节讨论。反馈翻译、公式或排版问题，参与每章的 GitHub Discussions，共同修订中文手册。',slug:'community',content:communityFeatures.communityPage(),toc:[{title:'反馈与修订',id:'feedback',level:'h2'},{title:'章节讨论',id:'chapters',level:'h2'},{title:'参与共建',id:'contribute',level:'h2'}]}));
search.push({title:'读者社区',group:'反馈与讨论',section:'社区',url:'/community/',text:'错误反馈 纠错 翻译问题 GitHub Issues Discussions 讨论 共建 修订'});
await fs.writeFile(path.join(dist, 'search-index.json'), JSON.stringify(search));
await fs.writeFile(path.join(dist, '404.html'), shell({title: '没有找到这一页', description: 'CS336 中文实验手册', content:'<div class="chapter-eyebrow">404</div><h1>这一页还没有写进书里。</h1><p>检查链接，或从目录重新开始。</p><a class="primary-button" href="/">返回阅读指南 →</a>'}));
await fs.writeFile(path.join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://cs336.wiki/sitemap.xml\n');
await fs.writeFile(path.join(dist, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://cs336.wiki/</loc></url><url><loc>https://cs336.wiki/community/</loc></url>' + book.chapters.map(c => '<url><loc>https://cs336.wiki' + url(c) + '</loc></url>').join('') + '</urlset>');
await fs.mkdir(path.join(root, 'artifacts'), {recursive: true});
await fs.writeFile(path.join(root, 'artifacts/content-audit.json'), JSON.stringify({...stats, source_sha256: book.source_sha256}, null, 2));
console.log('Built ' + stats.chapters + ' chapters, ' + stats.problems.length + ' exercises, ' + stats.words + ' Chinese characters.');
