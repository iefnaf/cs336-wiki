# CS336.wiki

Stanford CS336 2026 作业 1 的非官方中文电子书，部署在 https://cs336.wiki。

项目源码：[iefnaf/cs336-wiki](https://github.com/iefnaf/cs336-wiki) · [读者社区](https://cs336.wiki/community/) · [错误反馈](https://github.com/iefnaf/cs336-wiki/issues) · [讨论区](https://github.com/iefnaf/cs336-wiki/discussions)

基于本地原版 **CS336 Assignment 1 (basics): Building a Transformer LM — Spring 2026, v26.0.3**，共 47 页。网站分成 25 个阅读章节，保留 38 道练习、109 分的题目要求及 29 个编号公式，不提供新增答案或作业实现。

界面参考 [UC Berkeley CS186 Projects](https://cs186berkeley.net/projects/) 的章节导航方式，支持桌面与手机阅读、页内目录、全文搜索、深色模式、阅读位置记忆、前后章导航、英文原文对照及 PDF 页码链接。

## 纠错与讨论

每章顶部与末尾有「纠错反馈」和「本章讨论」。反馈入口会打开 GitHub Issue 表单，预填章节、页面链接、原文与网站版本、PDF 页码。先选中正文再点击反馈，还会自动带上文字引用及所在小节的锚点。选文很长时只预填一段引用，完整说明可在 GitHub 表单中补充。

反馈不会在点击网页入口时直接发布；读者需要登录 GitHub 并在表单中确认提交。使用 Issue 模板自动设置标签，普通读者的反馈 URL 不依赖标签管理权限。

每章对应一个固定 GitHub Discussions 讨论帖，全部章节都可从读者社区找到。讨论使用 GitHub 原生页面，无需安装额外评论应用。

中文正文与站点代码已经公开，修订请参考 [CONTRIBUTING.md](CONTRIBUTING.md)。GitHub Actions 会在 PR 和 main 分支更新时构建并核验题目、分值、公式、链接与反馈入口；部署仍由维护者执行。

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

站点是纯静态内容，使用 Cloudflare Workers Static Assets。<code>wrangler.jsonc</code> 中声明 <code>cs336.wiki</code> 自定义域名，Cloudflare 自动管理 HTTPS。无数据库、服务端应用或第三方 CDN 依赖。

~~~text
npx wrangler login
npm run deploy
~~~

部署使用执行者自己的 Cloudflare 登录。凭据不存放在项目目录内。已经绑定的域名由 Wrangler 配置管理。

## 验收证据

- <code>artifacts/content-audit.json</code>：练习清单、分值、公式编号和原文摘要。
- <code>artifacts/validation.json</code>：静态内容与链接检查。
- <code>artifacts/browser-qa.json</code>：最近一次浏览器验收。
- <code>artifacts/deployment.json</code>：部署与线上验证记录。

截图是本地视觉验收产物，默认不纳入版本控制。

## 后续更新原版

当前站点固定对应 v26.0.3。更新 PDF 时，应同步更新 <code>book.json</code> 的版本、页码与校验和，重新提取英文原文、核对中文译文和图片，再运行构建与验收。不要只替换 PDF 而保留旧译文的版本信息。
