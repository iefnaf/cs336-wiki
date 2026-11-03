const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const external = ' target="_blank" rel="noopener noreferrer"';

export function createCommunity({book, config, siteVersion}) {
  const repo = new URL(config.repository_url);
  if (repo.origin !== 'https://github.com' || repo.pathname !== '/' + config.repository) throw new Error('Invalid community repository');
  for (const chapter of book.chapters) {
    if (!config.chapters[chapter.slug]?.startsWith(config.repository_url + '/discussions/')) throw new Error('Missing chapter discussion: ' + chapter.slug);
  }
  function feedbackURL(chapter) {
    const issue = new URL(config.issues_url + '/new');
    const label = chapter ? chapter.section + ' ' + chapter.title : '阅读指南';
    issue.searchParams.set('template', 'error-report.yml');
    issue.searchParams.set('title', '[纠错] ' + label);
    issue.searchParams.set('chapter', label);
    issue.searchParams.set('page_url', 'https://cs336.wiki' + (chapter ? '/assignment1/' + chapter.slug + '/' : '/'));
    issue.searchParams.set('version', '原文 v' + book.version + ' · 网站 v' + siteVersion);
    issue.searchParams.set('pdf_pages', chapter ? chapter.pages.join('–') : '1–47');
    return issue.href;
  }
  function feedbackLink(chapter, label = '纠错反馈') {
    return '<a class="feedback-link" href="' + esc(feedbackURL(chapter)) + '"' + external + ' aria-label="' + esc(label.replace(' ↗','')) + '（在页内填写）">' + esc(label) + '</a>';
  }
  function readerTools(chapter) {
    return '<div class="reader-tools" aria-label="章节反馈与讨论">' + feedbackLink(chapter) +
      '<a class="chapter-discussion" href="#discussion">本章讨论 ↓</a>' +
      '<a href="' + esc(config.repository_url + '/blob/main/content/' + chapter.slug + '.md') + '"' + external + '>查看本章源码 ↗</a></div>';
  }
  function readerSupport(chapter) {
    return '<section class="reader-support" aria-label="反馈与讨论"><h2>一起把这一章读得更好</h2><p>发现翻译、公式或排版错误？欢迎反馈。概念疑问和学习心得，也可以在本章讨论中交流。</p><div class="reader-support-actions">' + feedbackLink(chapter, '反馈本章错误') +
      '<a class="chapter-discussion" href="#discussion">参与本章讨论 ↓</a><a href="/community/">读者社区 →</a></div><small>直接选中正文，点击旁边的「反馈这处错误」，即可在页内填写并提交，无需登录。</small></section>';
  }
  function comments(chapter) {
    const number=new URL(config.chapters[chapter.slug]).pathname.split("/").at(-1);
    return '<section class="chapter-comments" id="discussion" aria-labelledby="discussion-title" data-repository="' + esc(config.repository) + '" data-repository-id="' + esc(config.comments.repository_id) + '" data-category="' + esc(config.comments.category) + '" data-category-id="' + esc(config.comments.category_id) + '" data-discussion-number="' + esc(number) + '"><div class="comments-heading"><h2 id="discussion-title">本章讨论</h2><a href="' + esc(config.chapters[chapter.slug]) + '"' + external + '>在 GitHub 查看记录 ↗</a></div><p class="comments-intro">关于这一章的疑问、理解与心得，都可以在这里交流。阅读无需登录；发表评论或回复时使用 GitHub 账号。</p><div class="comments-loading" role="status">正在加载本章讨论…</div><div class="giscus"></div><div class="comments-error" hidden><p>本章讨论暂时无法加载，请稍后重试。</p><button type="button" class="comments-retry">重新加载</button></div><noscript>启用 JavaScript 后，可以直接在这里阅读与参与本章讨论。</noscript><p class="comments-guidance">欢迎交流概念与阅读疑问，请勿发布作业完整实现或题目答案。</p></section>';
  }
  function decorate(html, {slug}) {
    const isCommunity = slug === 'community';
    html = html.replace('<link rel="stylesheet" href="/assets/style.css">','<link rel="stylesheet" href="/assets/style.css"><link rel="stylesheet" href="/assets/community.css"><link rel="stylesheet" href="/assets/comments.css?v=' + esc(siteVersion) + '"><link rel="stylesheet" href="/assets/feedback.css?v=' + esc(siteVersion) + '">');
    html = html.replace('<script src="/assets/app.js" defer></script>','<script src="/assets/app.js" defer></script><script src="/assets/comments.js?v=' + esc(siteVersion) + '" defer></script><script src="/assets/feedback.js?v=' + esc(siteVersion) + '" defer></script>');
    html = html.replace('href="/">阅读指南</a>', 'href="/">阅读指南</a><a class="nav-community' + (isCommunity ? ' active' : '') + '" href="/community/"' + (isCommunity ? ' aria-current="page"' : '') + '>读者社区 <span aria-hidden="true">↗</span></a>');
    html = html.replace('<div class="sidebar-foot">','<div class="sidebar-foot"><a class="repo-link" href="' + esc(config.repository_url) + '"' + external + '>↗ GitHub 项目</a>');
    html = html.replace('<button class="theme-toggle" aria-label="切换深色模式" title=', '<a class="topbar-community" href="/community/">反馈与讨论</a><button class="theme-toggle" aria-label="切换深色模式" title=');
    if (isCommunity) html = html.replace('data-chapter="community"','data-chapter="" data-page="community"');
    if (!slug) html = html.replace('<div class="contents-heading">','<div class="community-invite"><span>一起完善中文手册：报告阅读错误，或与其他读者交流。</span><a href="/community/">前往读者社区 →</a></div><div class="contents-heading">');
    return html;
  }
  function communityPage() {
    const groups = [...new Set(book.chapters.map(c=>c.group))];
    return '<div class="chapter-eyebrow">COMMUNITY <span>/</span> CS336.WIKI</div><h1>一起把这本手册读得更好</h1><p class="community-intro">译文中的一个小错误，也值得认真修正。这里连接读者反馈与章节讨论，让每一次阅读都能帮助这本手册变得更清楚。</p>' +
      '<div class="community-choices"><section class="community-choice"><div class="chapter-eyebrow">GITHUB ISSUES</div><h2>发现错误</h2><p>翻译、术语、公式、排版或链接有问题？在章节中选中错误文字，即可原地填写说明并提交。</p><a href="/assignment1/overview/">前往手册选文纠错 →</a><a class="sub-link" href="' + esc(config.issues_url) + '"' + external + '>查看已有反馈与修订进展 ↗</a></section>' +
      '<section class="community-choice"><div class="chapter-eyebrow">GITHUB DISCUSSIONS</div><h2>一起讨论</h2><p>每个章节的正文下方都有讨论区，可以直接阅读、发表评论和回复，不需要离开当前页面。</p><a href="#chapters">选择章节参与讨论 ↓</a><a class="sub-link" href="' + esc(config.welcome_url) + '"' + external + '>初次来访？先读社区欢迎帖 ↗</a></section></div>' +
      '<p class="community-note">页内纠错无需 GitHub 账号，提交后会自动同步到 Issues。公开反馈与讨论可以直接阅读；回复讨论需要 GitHub 账号。请遵守课程的学习要求，交流思路与概念，避免发布作业完整实现或题目答案。</p>' +
      '<section class="community-section" id="feedback"><h2>反馈会怎样变成修订</h2><p>页内提交的反馈会先保存，再由后台同步到 GitHub Issues；同步可能需要几分钟。维护者对照英文 PDF 核实后修订中文内容，并记录上线结果。</p><div class="community-stages"><span>待核实</span><i>→</i><span>已确认</span><i>→</i><span>修订中</span><i>→</i><span>已发布</span></div><div class="community-further"><a href="' + esc(config.issues_url + '?q=is%3Aissue+is%3Aopen+label%3Aerrata') + '"' + external + '>待处理的纠错 ↗</a><a href="' + esc(config.issues_url + '?q=is%3Aissue+label%3Afixed') + '"' + external + '>已发布的修订 ↗</a></div></section>' +
      '<section class="community-section" id="chapters"><h2>按章节参与讨论</h2><p>打开相应章节下方的讨论区，读者的提问与回复会持续保留。</p>' +
      groups.map(group=>'<div class="discussion-group"><h3>' + esc(group) + '</h3>' + book.chapters.filter(c=>c.group===group).map(c=>'<div class="discussion-row"><span class="contents-number">' + esc(c.section) + '</span><a href="/assignment1/' + c.slug + '/"><strong>' + esc(c.title) + '</strong></a><a href="/assignment1/' + c.slug + '/#discussion">参与讨论 →</a></div>').join('') + '</div>').join('') + '</section>' +
      '<section class="community-section" id="contribute"><h2>也欢迎直接修订</h2><p>中文正文和网站源码已经公开。可以阅读对应章节的 Markdown，提交修订 PR，并关联读者反馈；每个 PR 都会自动检查内容完整性与站内链接。</p><div class="community-further"><a href="' + esc(config.repository_url) + '"' + external + '>查看项目源码 ↗</a><a href="' + esc(config.repository_url + '/blob/main/CONTRIBUTING.md') + '"' + external + '>共建指南 ↗</a><a href="' + esc(config.discussions_url + '/categories/ideas') + '"' + external + '>提出功能建议 ↗</a></div></section>';
  }
  return {feedbackURL, feedbackLink, readerTools, readerSupport, comments, decorate, communityPage};
}
