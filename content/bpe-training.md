## 2.4 BPE 分词器训练

BPE 训练包含三个主要步骤。

### 初始化词表

分词器词表在字节串 token 与整数 ID 之间建立一一映射。字节级 BPE 的初始词表就是全部字节；字节有 256 种可能值，因此初始词表大小为 256。

### 预分词

理论上可以直接统计语料中相邻字节的频率，从最频繁的一对开始合并，但每次合并都重新遍历完整语料会非常昂贵。直接跨语料合并，还可能产生仅标点不同的 token，例如 “dog!” 与 “dog.”；它们语义可能很接近，却拥有完全不同的 ID。

为此，先对语料进行**预分词（pre-tokenization）**，即一种粗粒度切分，用来帮助统计字符对。假设预词项 “text” 出现 10 次，那么其中相邻的 “t”“e” 可以一次计数 10，而不必每次回到语料中查找。在字节级 BPE 中，每个预词项都表示为 UTF-8 字节序列。

Sennrich 等人 [3] 的原始实现简单地按空白切分；基于 SentencePiece 的一些分词器，如 Llama 1、2，也采用这种方式。多数现代分词器沿用 GPT-2 [6] 的正则预分词方法。本作业使用来自 [tiktoken PR #234](https://github.com/openai/tiktoken/pull/234/files) 的等价、略易读版本：

<div data-excerpt="gpt2-pattern"></div>

原文交互示例将 “some text that i'll pre-tokenize” 切分为 “some”、“ text”、“ that”、“ i”、“'ll”、“ pre”、“-”、“tokenize”。建议交互尝试一些文本来理解行为。实际构建预词项频次映射时，应该使用 <code>re.finditer</code>，避免额外保存全部预分词结果；该正则需要 <code>regex</code> 包。

### 计算 BPE 合并

将文本转成预词项、再表示为 UTF-8 字节后，就可以训练 BPE：迭代统计相邻字节对，找出频率最高的一对 (“A”, “B”)，将其所有出现位置替换为新 token “AB”，再把新 token 加入词表。因此，最终词表大小为初始词表大小加上执行的合并次数。

为了效率，训练时**不考虑跨预词项边界的字节对**。若多个候选对频率相同，必须确定性地选择**字典序较大**的一对。例如 (“A”, “B”)、(“A”, “C”)、(“B”, “ZZ”)、(“BA”, “A”) 并列时，应选 (“BA”, “A”)。

原始 BPE [3] 使用词尾 token。本作业的字节级 BPE 不额外加入词尾 token，因为空白和标点也已包含在字节词表中，学到的合并会自然反映这些边界。

### 特殊 token

某些字符串用于表示文档边界等元数据，例如 <code>&lt;|endoftext|&gt;</code>。编码时，它们应始终保留为单个 token，即单个整数 ID，而不能被拆开；模型也据此知道何时停止生成。因此，特殊 token 必须加入词表，并具有固定 ID。

Sennrich 等人 [3] 的算法 1 提供了一个较低效、基本遵循上述步骤的 BPE 训练实现。原指导书建议先实现并测试这一过程，以检查理解。

::: example bpe_example | BPE 训练示例

以下是改编自 [3] 的简化例子。语料为：

~~~text
low low low low low
lower lower widest widest widest
newest newest newest newest newest newest
~~~

词表含有特殊 token <code>&lt;|endoftext|&gt;</code>。

**词表。** 用该特殊 token 与 256 个字节值初始化词表。

**预分词。** 为突出合并过程，此例只按空白切分，得到频次表：

~~~text
{low: 5, lower: 2, widest: 3, newest: 6}
~~~

可用 <code>dict[tuple[bytes, ...], int]</code> 表示，例如 <code>{(l,o,w): 5, …}</code>。即使只有单个字节，在 Python 中也使用 <code>bytes</code> 对象；Python 没有单独的 byte 类型，就像没有单独的 char 类型。

**合并。** 首轮相邻字节对频次为：

~~~text
{lo: 7, ow: 7, we: 8, er: 2, wi: 3, id: 3,
 de: 3, es: 9, st: 9, ne: 6, ew: 6}
~~~

(“e”, “s”) 与 (“s”, “t”) 并列，故选字典序更大的 (“s”, “t”)。合并后得到：

~~~text
{(l,o,w): 5, (l,o,w,e,r): 2,
 (w,i,d,e,st): 3, (n,e,w,e,st): 6}
~~~

第二轮最频繁的是 (e, st)，计数为 9，得到：

~~~text
{(l,o,w): 5, (l,o,w,e,r): 2,
 (w,i,d,est): 3, (n,e,w,est): 6}
~~~

继续下去，合并序列为：

~~~text
['s t', 'e st', 'o w', 'l ow', 'w est', 'n e',
 'ne west', 'w i', 'wi d', 'wid est', 'low e', 'lowe r']
~~~

若只执行 6 次合并，词表为特殊 token、256 个字节以及 st、est、ow、low、west、ne。使用该词表与合并序列，单词 newest 编码为 [ne, west]。

:::
