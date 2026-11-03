# CS336.wiki

Stanford CS336 2026 作业 1 的非官方中文电子书，部署在 https://cs336.wiki。

项目源码：[iefnaf/cs336-wiki](https://github.com/iefnaf/cs336-wiki) · [读者社区](https://cs336.wiki/community/) · [错误反馈](https://github.com/iefnaf/cs336-wiki/issues) · [讨论区](https://github.com/iefnaf/cs336-wiki/discussions)

基于本地原版 **CS336 Assignment 1 (basics): Building a Transformer LM — Spring 2026, v26.0.3**，共 47 页。网站分成 25 个阅读章节，保留 38 道练习、109 分的题目要求及 29 个编号公式，不提供新增答案或作业实现。

界面参考 [UC Berkeley CS186 Projects](https://cs186berkeley.net/projects/) 的章节导航方式，支持桌面与手机阅读、页内目录、全文搜索、深色模式、阅读位置记忆、前后章导航、英文原文对照及 PDF 页码链接。

## 纠错与讨论

在正文中选中文字，旁边会出现「反馈这处错误」。点击即可在页内填写问题说明和建议，不跳转 GitHub，也无需登录。引用文字、所在小节、章节和版本随反馈保存；失败时保留草稿，并可安全重试。顶部和末尾的反馈入口也可打开同一表单。

反馈先写入 Cloudflare D1，随后由 GitHub Actions 同步到 Issues。同步任务使用仓库自带的临时 GITHUB_TOKEN，仅授予 Issues 写权限；生产服务不保存个人 GitHub 令牌。同步存在延迟，提交成功表示已可靠保存，不表示 Issue 已即时创建。同步失败时记录仍保留，后续运行会重试并避免重复创建。

每章对应一个固定 GitHub Discussions 讨论帖，全部章节都可从读者社区找到。回复讨论仍使用 GitHub 账号。无 JavaScript 时，反馈入口保留 GitHub Issue 表单作为备选。

修订请参考 [CONTRIBUTING.md](CONTRIBUTING.md)。GitHub Actions 在 PR 和 main 分支更新时核验内容完整性、链接以及反馈接收与同步逻辑；main 更新会自动构建、检查并部署到 Cloudflare，也可由维护者手动部署。

## 内容与来源

- <code>content/*.md</code>：中文正文；直接编辑这些文件维护译文。
- <code>book.json</code>：目录顺序、原文章节、PDF 页码与原文切分标记。
- <code>community.json</code>：GitHub 仓库、社区入口及固定章节讨论链接。
- <code>source/handout.en.txt</code>：从随附 PDF 提取的完整原文，用于对照与内容核验。
- <code>public/source/cs336_assignment1_basics.pdf</code>：原版 PDF。
- <code>public/source/LICENSE.txt</code> 与 <code>LICENSE</code>：保留 Stanford University 原仓库 MIT 许可。
- <code>public/assets/*</code>：样式、交互与原文图像。
- <code>scripts/build.mjs</code>：将 Markdown、KaTeX、目录及原文组装为独立静态 HTML 页面。

源 PDF 的 SHA-256：

~~~text
cf402d1c6d3c66da035bdf33b3e2c1bbc4bb92a78b006ee36577e925a265e328
~~~

中文译文由 AI 辅助整理，未经课程工作人员审校；原文图示和代码示例按原样保留。若有差异，以随附英文 PDF 为准。源码中没有任何学生的作业实现。这个网站与 Stanford University 或课程没有隶属关系。

## 本地维护

要求 Node.js 22 或更高版本。

~~~text
npm ci
npm run build
npm run check
npm run preview
~~~

预览地址为 <code>http://127.0.0.1:3360</code>。

<code>npm run check</code> 检查原文题号覆盖、分值、29 个公式、站内链接、锚点与公式渲染。

浏览器验收：

~~~text
npx playwright install chromium
node scripts/qa.mjs
~~~

也可以把已安装 Chromium 可执行文件的完整路径作为 <code>qa.mjs</code> 的第一个参数，避免重复下载。<code>QA_BASE_URL</code> 可指定要验收的域名。浏览器检查覆盖 25 个桌面页、25 个手机页，以及搜索、导航、主题、原文展开、阅读位置恢复和 404。

## 部署

阅读页面使用 Cloudflare Workers Static Assets；页内纠错通过同一 Worker 的 API 接收，写入 D1，并由 Turnstile 验证提交。<code>wrangler.jsonc</code> 中声明 <code>cs336.wiki</code> 自定义域名，Cloudflare 自动管理 HTTPS。公式与阅读资源随站点部署。只有打开纠错表单时才加载 Turnstile。

~~~text
npx wrangler login
npm run deploy
~~~

首次部署需初始化 D1（迁移位于 migrations/），并在 Worker 配置 TURNSTILE_SECRET_KEY、FEEDBACK_SYNC_TOKEN 两个 Secret。TURNSTILE_SITE_KEY 是公开的站点配置。GitHub 仓库也需配置同值的 FEEDBACK_SYNC_TOKEN Secret。

自动部署使用 GitHub 仓库的 CLOUDFLARE_API_TOKEN Secret；手动部署使用执行者自己的 Cloudflare 登录。凭据不存放在项目目录内。已经绑定的域名由 Wrangler 配置管理。

## 验收证据

- <code>artifacts/content-audit.json</code>：练习清单、分值、公式编号和原文摘要。
- <code>artifacts/validation.json</code>：静态内容与链接检查。
- <code>artifacts/browser-qa.json</code>：最近一次浏览器验收。
- <code>artifacts/deployment.json</code>：部署与线上验证记录。

截图是本地视觉验收产物，默认不纳入版本控制。

## 后续更新原版

当前站点固定对应 v26.0.3。更新 PDF 时，应同步更新 <code>book.json</code> 的版本、页码与校验和，重新提取英文原文、核对中文译文和图片，再运行构建与验收。不要只替换 PDF 而保留旧译文的版本信息。

## 反馈服务验证与维护

~~~text
npm run test:feedback
node scripts/qa-feedback.mjs /path/to/chromium
~~~

服务测试使用真实 SQLite 与模拟的外部 API，覆盖校验、限流、持久保存、幂等重试、同步鉴权以及 Issue 创建后的回执失败恢复。浏览器验收覆盖桌面和手机端的选文按钮、页内表单、失败保留、提交回执与导航；测试中模拟 Turnstile 和提交传输，不向公开仓库制造测试反馈。

同步工作流约每 5 分钟触发，也可在 Actions 中手动运行 Sync reader feedback。GitHub 的调度可能延迟；公开仓库长期无活动时，计划工作流可能被停用，需要维护者重新启用。维护时应定期确认同步任务成功、待处理队列没有积压。接收成功的反馈会一直保留，不会因同步失败丢失。

Worker 的 /api/feedback/sync 仅允许持有同步 Secret 的工作流访问；公开回执接口只返回状态与 Issue 链接，不返回反馈正文。服务不存储原始 IP，只存储用于短时限流的不可逆摘要。
