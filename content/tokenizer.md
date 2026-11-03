## 2.6 BPE 分词器：编码与解码

上一部分训练得到了词表与 BPE 合并列表。现在实现一个分词器，加载这些结果，在文本与整数 token ID 之间进行编码和解码。

### 2.6.1 文本编码

编码过程与词表训练相呼应，主要有两个步骤：

1. **预分词。** 和训练时一样，把输入切分为预词项，再表示为 UTF-8 字节序列。各预词项独立处理，不允许跨边界合并。
2. **应用合并。** 按训练时的创建顺序，把学到的合并应用到各预词项上。

::: example bpe_encoding | BPE 编码示例

设输入为 “the cat ate”，词表为：

~~~text
{0: b' ', 1: b'a', 2: b'c', 3: b'e', 4: b'h', 5: b't',
 6: b'th', 7: b' c', 8: b' a', 9: b'the', 10: b' at'}
~~~

学到的合并为：

~~~text
[(b't', b'h'), (b' ', b'c'), (b' ', b'a'),
 (b'th', b'e'), (b' a', b't')]
~~~

预分词结果是 “the”、“ cat”、“ ate”。

第一个预词项最初是 [b't', b'h', b'e']。第一个适用的合并 (b't', b'h') 将其变为 [b'th', b'e']；随后适用的 (b'th', b'e') 将其变为 [b'the']。整个预词项已合并为一个 token，不再有可用合并，对应整数序列 [9]。

同样，“ cat” 合并为 [b' c', b'a', b't']，对应 [7, 1, 5]；“ ate” 合并为 [b' at', b'e']，对应 [10, 3]。

最终编码结果是 **[9, 7, 1, 5, 10, 3]**。

:::

### 特殊 token

编码时，分词器必须正确处理构造函数接收的用户自定义特殊 token。

### 内存方面的考虑

如果要处理无法全部装入内存的大型文本文件或其他数据流，需要将其切成可管理的块，逐块处理，使内存复杂度保持常数，而不是随文本大小线性增长。

与此同时，必须确保 token 不会跨越分块边界，否则结果会与一次性在内存中处理完整序列的朴素方法不同。

### 2.6.2 文本解码

把整数 token ID 序列转回文本时，逐个查词表得到字节序列，拼接后再解码为 Unicode 字符串。

输入 ID 不保证能够拼成有效 Unicode，因为用户可能传入任意 ID 序列。如果出现无效字节，应该替换为 Unicode 官方替换字符 **U+FFFD**。<code>bytes.decode</code> 的 <code>errors</code> 参数控制错误处理；<code>errors='replace'</code> 会自动加入替换标记。原文附有[替换字符说明](https://en.wikipedia.org/wiki/Specials_(Unicode_block)#Replacement_character)。

::: problem tokenizer | 实现分词器 | 15

**交付物：** 实现一个 <code>Tokenizer</code> 类，根据词表和合并列表将文本编码为整数 ID，并将 ID 解码为文本。支持用户提供的特殊 token；如果尚不在词表中，应追加到词表。

建议接口如下。这里列的是原指导书的接口要求，不包含实现。

| 方法 | 参数与返回 | 要求 |
| --- | --- | --- |
| <code>__init__</code> | <code>vocab: dict[int, bytes]</code>、<code>merges: list[tuple[bytes, bytes]]</code>、<code>special_tokens: list[str] \| None = None</code> | 从词表、合并列表和可选特殊 token 构造分词器。 |
| <code>from_files</code> | <code>vocab_filepath: str</code>、<code>merges_filepath: str</code>，以及可选特殊 token | 类方法，从训练程序保存的同格式词表、合并文件构造并返回分词器。 |
| <code>encode</code> | <code>text: str → list[int]</code> | 将输入文本编码成 token ID 序列。 |
| <code>encode_iterable</code> | <code>iterable: Iterable[str] → Iterator[int]</code> | 接收字符串可迭代对象，例如文件句柄；返回惰性产出 token ID 的生成器，用于低内存处理大型文件。 |
| <code>decode</code> | <code>ids: list[int] → str</code> | 将 token ID 序列解码为文本。 |

实现 <code>adapters.get_tokenizer</code> 后，运行 <code>uv run pytest tests/test_tokenizer.py</code>，应通过全部测试。

:::

## 2.7 实验

::: problem tokenizer_experiments | 分词器实验 | 4

**(a)** 从 TinyStories 和 OpenWebText 各抽取 10 篇文档，用各自训练好的分词器（词表大小分别为 10K、32K）编码为整数 ID。每个分词器的压缩率（bytes/token）是多少？

**交付物：** 一至两句话回答。

**(b)** 如果用 TinyStories 分词器处理 OpenWebText 样本，会发生什么？比较压缩率，和／或从定性角度描述现象。

**交付物：** 一至两句话回答。

**(c)** 估算分词器的吞吐量，例如每秒处理多少字节。处理有 825 GB 文本的 Pile 数据集需要多久？

**交付物：** 一至两句话回答。

**(d)** 用 TinyStories、OpenWebText 分词器分别编码各自的训练集和开发集，得到供后续训练使用的整数 token ID 序列。建议保存为 <code>uint16</code> 类型的 NumPy 数组。为什么 <code>uint16</code> 合适？

**交付物：** 一至两句话回答。

:::
