## 2.5 BPE 训练实验

先在 TinyStories 上训练字节级 BPE。下载方式见第 1 节。开始之前，建议浏览数据，了解语料内容。

### 并行预分词

预分词通常是主要瓶颈。可以用内置的 <code>multiprocessing</code> 库加速。原指导书建议并行预分词时对语料分块，并确保分块边界位于特殊 token 的开头。

允许直接使用课程提供的 [pretokenization_example.py](https://github.com/stanford-cs336/assignment1-basics/blob/main/cs336_basics/pretokenization_example.py) 中用于确定分块边界的起始代码，再把各块分配给不同进程。

这种分块总是有效，因为本来就不希望跨文档边界合并。在本作业中，可以一直这样划分，不必处理超大语料完全没有 <code>&lt;|endoftext|&gt;</code> 的边缘情况。

### 预分词前移除特殊 token

在用正则表达式进行预分词之前，应从语料或并行处理的分块中剔除特殊 token。务必按照特殊 token 进行切分，使合并不能跨越它划定的文本区域。例如：

~~~text
[Doc 1]<|endoftext|>[Doc 2]
~~~

应分别预分词 [Doc 1] 与 [Doc 2]，禁止跨文档边界合并。特殊 token 是训练中的**硬分段边界**，但不应参与合并频次统计。

原文指出，可以用 <code>re.split</code> 配合以 <code>"|".join(special_tokens)</code> 构成的分隔表达式，并谨慎使用 <code>re.escape</code>，因为特殊 token 中可能包含竖线。测试 <code>test_train_bpe_special_tokens</code> 会检查该行为。

### 优化合并步骤

上页的朴素实现每次合并都遍历所有字节对以找出最高频候选，因此速度慢。但每次合并后，只有与被合并对发生重叠的字节对频次会改变。可以索引全部字节对的计数，并增量更新，而不必每次显式遍历所有字节对重新统计。这样可显著加速。不过，BPE 训练中的合并部分在 Python 中无法并行化。

::: tip 低资源提示：性能分析

使用 <code>cProfile</code>、<code>py-spy</code> 等工具找出实现瓶颈，把优化精力放在那里。

:::

::: tip 低资源提示：缩小规模

不要一开始就在整个 TinyStories 上训练。先使用小型“调试数据集”，例如约 2.2 万篇文档的验证集，而不是约 212 万篇文档的完整数据。

更小的数据集、更小的模型等，是加快开发的一般策略。调试规模必须认真选择：要足够大，使主要瓶颈与完整配置一致，优化才能迁移；又不能大到每次运行都很久。

:::

::: problem train_bpe | BPE 分词器训练 | 15

**交付物：** 编写一个函数，接收文本文件路径，训练字节级 BPE 分词器。至少支持以下输入：

| 输入 | 类型 | 含义 |
| --- | --- | --- |
| <code>input_path</code> | <code>str</code> | BPE 训练文本文件的路径。 |
| <code>vocab_size</code> | <code>int</code> | 正整数，定义最终词表大小上限，包括初始字节、合并生成的词项和全部特殊 token。 |
| <code>special_tokens</code> | <code>list[str]</code> | 要加入词表的特殊字符串。训练时将其视为禁止跨越的硬边界，不纳入合并统计。 |

返回：

| 输出 | 类型 | 含义 |
| --- | --- | --- |
| <code>vocab</code> | <code>dict[int, bytes]</code> | 从整数 token ID 映射到 token 字节串的词表。 |
| <code>merges</code> | <code>list[tuple[bytes, bytes]]</code> | 按创建顺序排列的合并；每项表示第一个 token 与第二个 token 合并。 |

实现适配器 <code>adapters.run_train_bpe</code>，再运行 <code>uv run pytest tests/test_train_bpe.py</code>，应通过全部测试。

你也可以选择用 C++ 或 Rust 等系统语言实现关键部分，但可能耗费很多时间。C++ 可考虑 cppyy、nanobind，Rust 可考虑 PyO3。若这样做，请注意哪些操作复制内存、哪些直接读取 Python 内存，并留下构建说明，或保证仅凭 <code>pyproject.toml</code> 就能构建。

多数正则引擎对 GPT-2 正则支持不佳，支持的也多半很慢。课程确认 Oniguruma 速度尚可，支持负向前瞻；不过 Python 的 <code>regex</code> 包甚至更快。

:::

::: problem train_bpe_tinystories | 在 TinyStories 上训练 BPE | 2

**(a)** 在 TinyStories 上训练字节级 BPE，最大词表为 **10,000**，将 <code>&lt;|endoftext|&gt;</code> 加为特殊 token。把词表与合并序列保存到磁盘，以便检查。训练花了多少时间和内存？词表中最长的 token 是什么？是否合理？

**资源要求：** 不使用 GPU，时间 ≤ 30 分钟，内存 ≤ 30 GB。

**原文提示：** 通过并行预分词，并利用以下两点，应该能把 BPE 训练时间降到 2 分钟以内：数据文件用 <code>&lt;|endoftext|&gt;</code> 分隔文档；BPE 合并之前，该 token 会被单独处理。

**交付物：** 一至两句话回答。

**(b)** 对代码进行性能分析。分词器训练的哪一部分最耗时？

**交付物：** 一至两句话回答。

:::

接下来在 OpenWebText 上训练。和之前一样，建议先浏览数据集以了解内容。

::: problem train_bpe_expts_owt | 在 OpenWebText 上训练 BPE | 2

**(a)** 在 OpenWebText 上训练字节级 BPE，最大词表为 **32,000**。保存词表与合并序列。最长的 token 是什么？是否合理？

**资源要求：** 不使用 GPU，时间 ≤ 12 小时，内存 ≤ 100 GB。

**交付物：** 一至两句话回答。

**(b)** 对比在 TinyStories 与 OpenWebText 上训练得到的分词器。

**交付物：** 一至两句话回答。

:::
