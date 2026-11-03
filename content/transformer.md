## 3.5 完整的 Transformer 语言模型

现在开始组装 Transformer 块，可回看图 2。每个块包含多头自注意力和 SwiGLU 前馈网络两个子层。每个子层先进行 RMSNorm，再执行主要运算，最后加上残差。

具体而言，第一个子层应从输入 $x$ 得到：

$$
y=x+\operatorname{MultiHeadSelfAttention}(\operatorname{RMSNorm}(x)) \tag{15}
$$

::: problem transformer_block | 实现 Transformer 块 | 3

按照第 3.4 节及图 2，实现预归一化 Transformer 块，至少接收：

| 参数 | 类型 | 含义 |
| --- | --- | --- |
| <code>d_model</code> | <code>int</code> | 输入维数。 |
| <code>num_heads</code> | <code>int</code> | 多头自注意力的头数。 |
| <code>d_ff</code> | <code>int</code> | 逐位置前馈网络的内部维数。 |

实现 <code>adapters.run_transformer_block</code>，运行 <code>uv run pytest -k test_transformer_block</code>。

**交付物：** 通过所给测试的 Transformer 块代码。

:::

按照图 1 组装完整模型：第 3.1 节的 token 嵌入，接 <code>num_layers</code> 个 Transformer 块，之后接最终归一化与 LM head，得到词表上的未归一化分数，即 logits。

::: problem transformer_lm | 实现 Transformer 语言模型 | 3

按照第 3.1 节与图 1，实现完整模型。除前述块的构造参数外，至少增加：

| 参数 | 类型 | 含义 |
| --- | --- | --- |
| <code>vocab_size</code> | <code>int</code> | 词表大小，用于确定 token 嵌入矩阵形状。 |
| <code>context_length</code> | <code>int</code> | 最大上下文长度，用于确定 RoPE 正弦、余弦缓冲区形状。 |
| <code>num_layers</code> | <code>int</code> | Transformer 块数量。 |

实现 <code>adapters.run_transformer_lm</code>，运行 <code>uv run pytest -k test_transformer_lm</code>。

**交付物：** 通过上述测试的 Transformer LM 模块。

:::

### 资源核算

理解各组件的计算、内存需求很有用。Transformer 的绝大多数 FLOPs 来自矩阵乘法，因此基本核算方法是：列出一次前向传播的全部矩阵乘法，再将其换算为 FLOPs。

**规则：** 若 $A\in\mathbb{R}^{m\times n}$、$B\in\mathbb{R}^{n\times p}$，则 $AB$ 需要 $2mnp$ 次浮点运算。

这是因为输出的每一项是长度为 $n$ 的点积，按此约定计 $n$ 次加法与 $n$ 次乘法；输出有 $mp$ 项，因此总计 $2mnp$ FLOPs。

做下一题前，可以逐个检查 Transformer 块和完整模型的组件，列出对应的矩阵乘法及成本。

::: problem transformer_accounting | Transformer 语言模型资源核算 | 5

**(a)** 考虑使用本作业架构的 GPT-2 XL 规模模型：

| 配置 | 值 |
| --- | --- |
| <code>vocab_size</code> | 50,257 |
| <code>context_length</code> | 1,024 |
| <code>num_layers</code> | 48 |
| <code>d_model</code> | 1,600 |
| <code>num_heads</code> | 25 |
| <code>d_ff</code> | 4,288，即最接近 $\frac{8}{3}\times1600$ 的 64 的倍数。 |

它有多少可训练参数？每个参数采用单精度浮点数时，仅加载模型需要多少内存？

**交付物：** 一至两句话回答。

**(b)** 列出该 GPT-2 XL 形状模型完成一次前向传播所需的矩阵乘法。输入长度等于 <code>context_length</code> 时，总共需要多少 FLOPs？

**交付物：** 带说明的矩阵乘法列表，以及 FLOPs 总数。

**(c)** 根据上述分析，模型哪部分消耗最多 FLOPs？

**交付物：** 一至两句话回答。

**(d)** 对 GPT-2 small（12 层、768 维、12 头）、medium（24 层、1024 维、16 头）、large（36 层、1280 维、20 头）重复分析。模型变大时，各组件占总 FLOPs 的比例如何变化？

**交付物：** 每个模型的组件 FLOPs 比例明细，以及一至两句话描述规模变化对占比的影响。

**(e)** 把 GPT-2 XL 上下文长度增加到 16,384。一次前向传播的总 FLOPs 如何变化？各组件的 FLOPs 相对贡献如何变化？

**交付物：** 一至两句话回答。

:::
