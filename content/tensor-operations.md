## 3.2 批处理、Einsum 与高效计算

Transformer 中许多计算都要对多个具有“批次性质”的输入执行相同操作，例如：

- **批内样本：** 每个样本都执行相同的 Transformer 前向计算。
- **序列位置：** RMSNorm、前馈网络等逐位置操作，对每个位置执行相同计算。
- **注意力头：** 多头注意力在每个头上独立执行同样的注意力操作。

理想的表达方式应能充分使用 GPU，并便于阅读。许多 PyTorch 运算允许张量开头带有额外的批次维，并高效地在这些维度上重复或广播计算。

例如，数据张量 $D$ 的形状是 <code>(batch_size, sequence_length, d_model)</code>，矩阵 $A$ 的形状是 <code>(d_model, d_model)</code>。使用矩阵乘法 <code>D @ A</code> 就会高效地在前两个维度上批量执行向量与矩阵的乘法。

因此，应假设函数可能接收额外的批次维，并始终把它们放在张量形状的前部。若用多次 <code>view</code>、<code>reshape</code>、<code>transpose</code> 调整张量，代码容易繁琐，也很难看清各维度的意义。

更方便的方式是使用 <code>torch.einsum</code>，或者框架无关的 <code>einops</code>、<code>einx</code>。两个核心操作是：

- <code>einsum</code>：对任意维度的输入执行张量收缩。
- <code>rearrange</code>：重排、合并、拆分维度。

机器学习中的绝大多数运算都是维度调整与张量收缩，再配合偶尔使用的非线性函数，通常是逐元素函数。因此，einsum 记法能让大量代码更易读、更灵活。

课程强烈建议学习并使用 einsum。初学者先阅读 [einops 基础文档](https://einops.rocks/1-einops-basics/)；熟悉 einops 后可以学习更一般的 [einx](https://einx.readthedocs.io/en/stable/gettingstarted/basics.html)。课程环境已经安装二者。相比 einops，einx 经过的实际检验较少，遇到限制或缺陷时，可以退回 einops 加普通 PyTorch。

下面的示例是对文档的补充，应先阅读文档。

::: example einstein_example1 | 使用 einops.einsum 进行批量矩阵乘法

普通矩阵乘法很难直接看出输入、输出形状及其含义，也不容易判断意外广播是否发生。原文展示了如何为每个维度命名，并用省略号支持任意数量的前导批次维，让表达式本身成为文档。

<div data-excerpt="einsum-matmul"></div>

:::

::: example einstein_example2 | 使用 einops.rearrange 进行广播操作

给定一批图像，要按不同缩放系数，为每张图生成 10 个亮度逐渐变化的版本。原文先通过重排添加单例维来广播相乘，再展示如何直接用一次 einsum 表达相同运算。

<div data-excerpt="einsum-broadcast"></div>

:::

::: example einstein_example3 | 使用 einops.rearrange 混合像素

假设图像张量形状为 <code>(batch, height, width, channel)</code>，希望对每个通道独立地对全部像素做线性变换。变换矩阵 $B$ 的形状为 <code>(height * width, height * width)</code>。

原文比较了用 <code>view</code> 加 <code>transpose</code> 的做法、用 <code>rearrange</code> 与 <code>einsum</code> 的做法，以及用 <code>einx.dot</code> 一次完成的写法。第一种做法也可以加形状注释改善，但会更繁琐、容易产生与实现不一致的注释。einsum 记法使形状说明直接成为运算的一部分。

<div data-excerpt="einsum-pixels"></div>

:::

einsum 不仅能处理任意数量的输入批次维，也有自文档化的优势：输入输出的相关形状更清楚。对其他张量，可以考虑用 [jaxtyping](https://github.com/patrick-kidger/jaxtyping) 等库添加类型标注，它并不专属于 JAX。

作业 2 会进一步讨论 einsum 的性能影响。目前可以认为它们几乎总比替代写法更合适。

## 3.2.1 数学记法与内存顺序

许多机器学习论文使用行向量，这与 NumPy、PyTorch 默认的行优先内存布局相适应。行向量的线性变换写作：

$$
y=xW^\top \tag{1}
$$

其中 $W\in\mathbb{R}^{d_{\mathrm{out}}\times d_{\mathrm{in}}}$，$x\in\mathbb{R}^{1\times d_{\mathrm{in}}}$。增加最外侧维度即可形成批次，用 $X\in\mathbb{R}^{\mathrm{batch}\times d_{\mathrm{in}}}$ 替代 $x$。

线性代数更常使用列向量：

$$
y=Wx \tag{2}
$$

此时 $x\in\mathbb{R}^{d_{\mathrm{in}}}$。若在这种数学表达中批量处理输入，批次维需要放在最后，使用 $\widetilde X\in\mathbb{R}^{d_{\mathrm{in}}\times\mathrm{batch}}$。

**本指导书的数学表达主要使用列向量。** 但若在 PyTorch 中用普通矩阵乘法实现，需要按照公式 1 的行向量约定转置矩阵。使用 einsum 并正确标记维度时，一般无需担心这个问题。

Matlab、Julia、Fortran 等语言或线性代数库通常采用列优先布局，批次维常放在最后；Python 及相关库则沿用 C 的行优先约定。
