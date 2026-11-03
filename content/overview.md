## 1 作业概览

在这份作业中，你将从零构建训练一个标准 Transformer 语言模型（language model，LM）所需的全部组件，并训练一些模型。

### 需要实现的内容

1. 字节对编码（byte-pair encoding，BPE）分词器，见第 2 节。
2. Transformer 语言模型，见第 3 节。
3. 交叉熵损失函数和 AdamW 优化器，见第 4 节。
4. 支持保存、加载模型与优化器状态的训练循环，见第 5 节。

### 需要运行的内容

1. 在 TinyStories 数据集上训练 BPE 分词器。
2. 用训练好的分词器将数据集编码成整数 ID 序列。
3. 在 TinyStories 上训练 Transformer 语言模型。
4. 用训练好的模型生成样本，并评估困惑度（perplexity）。
5. 在 OpenWebText 上训练模型，将得到的困惑度提交到排行榜。

### 允许使用什么

本作业要求从零构建每个组件。除下列项目外，不得使用 <code>torch.nn</code>、<code>torch.nn.functional</code> 或 <code>torch.optim</code> 中的任何定义：

- <code>torch.nn.Parameter</code>。
- <code>torch.nn</code> 中的容器类，例如 <code>Module</code>、<code>ModuleList</code>、<code>Sequential</code> 等。[完整容器列表](https://pytorch.org/docs/stable/nn.html#containers)见 PyTorch 文档。
- <code>torch.optim.Optimizer</code> 基类。

你可以使用 PyTorch 中的其他定义。如果不确定某个函数或类是否允许使用，请在课程 Slack 上提问。拿不准时，请考虑它是否违背作业“从零实现”的精神。

### 关于 AI 工具的声明

AI 已能完全自主地解决作业的许多部分，这会妨碍你深入接触和学习课程内容。

允许使用 AI 回答高层次的概念问题，或提供函数签名、库 API 等底层编程文档。**不允许用 AI 实现任何作业的任何部分**，包括编码代理（例如 Cursor Agents、Codex、Claude Code）和 AI 自动补全（例如 Cursor Tab、GitHub Copilot）。使用 AI 代理时，务必让它遵循仓库提供的 <code>AGENTS.md</code>；使用聊天机器人时，也应把该提示词放入对话。

强烈建议做作业时关闭 IDE 中的 AI 自动补全；非 AI 的函数名补全等功能完全可以使用。往届同学反馈，关闭 AI 自动补全后更容易深入学习材料。完整规定见[课程 AI 政策](https://docs.google.com/document/d/1SZAlExB1qAc9izHt54gwunNpjKE6wXb8Y7yA_e-baK8/edit?tab=t.0)。

### 代码结构

作业代码及本指导书位于 [stanford-cs336/assignment1-basics](https://github.com/stanford-cs336/assignment1-basics)。请克隆该仓库。若有更新，课程会通知你拉取最新版本。

| 路径 | 用途 |
| --- | --- |
| <code>cs336_basics/*</code> | 编写实现的地方。这里几乎没有代码，你可以自由组织自己的从零实现。 |
| <code>adapters.py</code> | 课程要求实现的功能接口。每个适配器（如 <code>run_scaled_dot_product_attention</code>）只应调用你的实现，不应包含实质逻辑。 |
| <code>test_*.py</code> | 必须通过的测试，通过适配器调用你的代码。不要修改测试文件。 |

### 如何提交

运行仓库提供的 <code>make_submission.sh</code> 生成提交压缩包。如果有不希望打包的大型数据文件或检查点，请把它们加入脚本中的排除列表。

向 Gradescope 提交：

- <code>writeup.pdf</code>：全部书面问题的回答，请使用排版工具制作。
- <code>code.zip</code>：你编写的全部代码。

排行榜通过向 [assignment1-basics-leaderboard](https://github.com/stanford-cs336/assignment1-basics-leaderboard) 提交 PR 参加，具体说明见该仓库的 README。

### 数据集从哪里获取

本作业使用经过预处理的 TinyStories [1] 和 OpenWebText [2]，二者均为单个大型纯文本文件。

如果你是正式选课学生，下载说明见课程的计算资源指南。如果你在家自学，请使用作业仓库 README 中提供的下载命令。

::: tip 低资源提示：贯穿课程的建议

指导书会用提示框介绍 GPU 较少或没有 GPU 时的做法，例如缩小数据集、缩小模型，或在 Mac 集成 GPU、CPU 上运行训练。即使有课程服务器可用，这些建议也有助于加快迭代、节约时间，建议阅读。

:::

::: tip 低资源提示：在 Apple Silicon 或 CPU 上完成作业 1

课程工作人员的参考实现能在配备 36 GB 内存的 Apple M4 Max 上训练出较流畅的语言模型：Metal GPU（MPS）不到 5 分钟，CPU 约 30 分钟。暂时不理解这些术语也没关系：只要笔记本较新，实现正确且高效，就可以训练一个能较流畅地生成简单儿童故事的小模型。后文会说明 CPU、MPS 对应的配置调整。

这些时间是原指导书报告的特定运行结果，不是对所有硬件和训练配置的保证。

:::
