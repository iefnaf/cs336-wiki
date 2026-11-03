## 3.4 预归一化 Transformer 块

每个 Transformer 块有两个子层：多头自注意力与逐位置前馈网络，见 Vaswani 等人 [8] 第 3.1 节。

原始 Transformer 在每个子层外添加残差连接，之后执行层归一化，通常称为 **post-norm（后归一化）**。后续研究 [9, 10] 发现，把归一化移到每个子层的输入端，并在最终块后额外归一化，能提高训练稳定性，这就是图 2 的 pre-norm 结构。

每个子层的输出仍通过残差连接与其输入相加。对 pre-norm 的一种直觉解释是：从输入嵌入到最终输出，有一条未经归一化打断的“残差流”，可能改善梯度传播。这已成为 GPT-3、LLaMA、PaLM 等模型采用的标准结构。本作业将依次实现其中各组件。

## 3.4.1 均方根层归一化

原始 Transformer [8] 使用 LayerNorm [11]。本作业跟随 LLaMA [12]，采用均方根层归一化 **RMSNorm** [13]。给定激活向量 $a\in\mathbb{R}^{d_{\mathrm{model}}}$，各分量变换为：

$$
\operatorname{RMSNorm}(a_i)=\frac{a_i}{\operatorname{RMS}(a)}g_i \tag{4}
$$

其中：

$$
\operatorname{RMS}(a)=\sqrt{\frac{1}{d_{\mathrm{model}}}\sum_{i=1}^{d_{\mathrm{model}}}a_i^2+\varepsilon}
$$

$g_i$ 是可学习的增益参数，共 $d_{\mathrm{model}}$ 个；$\varepsilon$ 通常设为 $10^{-5}$。

计算前应把输入提升为 <code>torch.float32</code>，避免平方时溢出；计算后将结果转回原始数据类型。原文给出的前向框架保留如下：

<div data-excerpt="rmsnorm-dtype"></div>

::: problem rmsnorm | 均方根层归一化 | 1

**交付物：** 将 RMSNorm 实现为 <code>torch.nn.Module</code>。

构造方法接收 <code>d_model: int</code>、<code>eps: float = 1e-5</code>，以及可选 <code>device</code>、<code>dtype</code>。<code>d_model</code> 为模型隐藏维度，<code>eps</code> 用于数值稳定。

前向方法接收 <code>(batch_size, sequence_length, d_model)</code> 张量，返回同形状张量。务必在归一化前提升到 float32，之后恢复原类型。

实现 <code>adapters.run_rmsnorm</code>，运行 <code>uv run pytest -k test_rmsnorm</code>。

:::

## 3.4.2 逐位置前馈网络

原始 Transformer [8] 第 3.3 节采用两次线性变换，中间使用 $\operatorname{ReLU}(x)=\max(0,x)$；内部维度通常为输入维度的 4 倍。

现代语言模型主要有两个改动：使用其他激活函数，并引入门控。本作业采用 Llama 3 [14]、Qwen 2.5 [15] 等模型使用的 **SwiGLU**，将 SiLU／Swish 与门控线性单元 GLU 结合。同时沿用 PaLM [16]、LLaMA [12] 以来多数现代模型的做法，省略偏置项。

SiLU，又称 Swish [17, 18]，定义为：

$$
\operatorname{SiLU}(x)=x\sigma(x)=\frac{x}{1+e^{-x}} \tag{5}
$$

![指导书图 3：SiLU、恒等函数与 ReLU 的比较](/assets/silu-figure.png)

*图 3：SiLU 与 ReLU 类似，但在零点处平滑；Identity 表示恒等函数。*

GLU 最初由 Dauphin 等人 [19] 定义为：一次线性变换经过 sigmoid 后，与另一次线性变换逐元素相乘：

$$
\operatorname{GLU}(x,W_1,W_2)=\sigma(W_1x)\odot W_2x \tag{6}
$$

$\odot$ 表示逐元素乘法。原文引用的直觉是：在保留非线性能力的同时，为梯度提供一条线性路径，以减轻深层网络中的梯度消失。

结合 SiLU 与 GLU，得到本作业使用的前馈网络：

$$
\operatorname{FFN}(x)=\operatorname{SwiGLU}(x,W_1,W_2,W_3)
=W_2\big(\operatorname{SiLU}(W_1x)\odot W_3x\big) \tag{7}
$$

其中 $x\in\mathbb{R}^{d_{\mathrm{model}}}$，$W_1,W_3\in\mathbb{R}^{d_{\mathrm{ff}}\times d_{\mathrm{model}}}$，$W_2\in\mathbb{R}^{d_{\mathrm{model}}\times d_{\mathrm{ff}}}$。通常取 $d_{\mathrm{ff}}=\frac{8}{3}d_{\mathrm{model}}$，实现中可舍入到附近的 64 的倍数，以提高硬件效率。

Shazeer [20] 首先提出结合 SiLU 与 GLU，并通过实验发现 SwiGLU 在语言建模上优于 ReLU、无门控 SiLU 等基线。后续作业会比较 SwiGLU 与 SiLU。虽然有上述启发式解释和论文证据，仍应保持实证视角。原文引用 Shazeer 的玩笑：“我们无法解释这些结构为何奏效；与其他一切一样，我们将它们的成功归功于上天的仁慈。”

::: problem positionwise_feedforward | 实现逐位置前馈网络 | 2

**交付物：** 实现由 SiLU 和 GLU 组成的 SwiGLU 前馈网络。

为保证数值稳定，此处允许直接使用 <code>torch.sigmoid</code>。

将 $d_{\mathrm{ff}}$ 设置为约 $\frac{8}{3}d_{\mathrm{model}}$，同时保证内部维度是 64 的倍数，以充分利用硬件。

实现 <code>adapters.run_swiglu</code>，运行 <code>uv run pytest -k test_swiglu</code>。

:::
