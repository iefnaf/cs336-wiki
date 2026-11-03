# 参与共建

网站：https://cs336.wiki

## 反馈阅读错误

在正文中选中错误文字，点击旁边的「反馈这处错误」，即可原地填写说明并提交，无需 GitHub 账号。章节、引用、小节和版本会一起保存，后台随后同步到 Issues。提交内容会公开显示，请勿填写私人信息。

请说明有问题的文字、问题原因，以及可选的建议译法。公式、代码显示问题可以附截图；排版问题请注明设备与浏览器。

也可以从 [Issues 模板](https://github.com/iefnaf/cs336-wiki/issues/new/choose) 开始。提交前可搜索现有反馈，避免重复。

## 参与讨论

每章都有固定讨论帖，链接位于章节顶部、末尾和网站的[读者社区](https://cs336.wiki/community/)。

概念理解、阅读疑问与学习心得可在章节讨论中交流；功能和内容组织建议可在 Ideas 分类提出。请遵守课程的学习要求，不发布作业完整实现或题目答案。

## 修订译文

1. 先对照随附英文 PDF 核实，记录对应章节、题号与页码。
2. 修改对应的 <code>content/*.md</code>；站点样式和交互位于 <code>public/assets/</code>。
3. 运行 <code>npm ci</code>、<code>npm run build</code> 和 <code>npm run check</code>。
4. 提交 PR 并关联反馈 Issue，解释修订依据。GitHub Actions 会自动检查章节、题目、分值、公式与站内链接。
5. 维护者合并、部署并验证后，在 Issue 中记录上线结果，再关闭反馈。

原文有歧义时，保留原意并在 Issue 中说明，不自行更改作业要求、分值或增加解答。

## 反馈处理状态

| 标签 | 含义 |
| --- | --- |
| needs-triage | 等待核实 |
| confirmed | 已对照原文确认 |
| in-progress | 正在修订 |
| fixed | 修订已部署 |

使用 <code>translation</code>、<code>math-code</code>、<code>layout</code> 区分问题类型，<code>errata</code> 表示读者纠错。
