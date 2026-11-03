## 3.4.5 因果多头自注意力

本节实现 Vaswani 等人 [8] 第 3.2.2 节的多头自注意力。多头注意力定义为：

$$
\operatorname{MultiHead}(Q,K,V)=
\operatorname{Concat}(\mathrm{head}_1,\ldots,\mathrm{head}_h) \tag{12}
$$

$$
\mathrm{head}_i=\operatorname{Attention}(Q_i,K_i,V_i) \tag{13}
$$

$Q_i,K_i,V_i$ 分别是 Q、K、V 的嵌入维上，第 $i$ 个大小为 $d_k$ 或 $d_v$ 的切片，$i\in\{1,\ldots,h\}$。Attention 就是第 3.4.4 节的缩放点积注意力。

由此得到多头自注意力：

$$
\operatorname{MultiHeadSelfAttention}(x)=
W_O\operatorname{MultiHead}(W_Qx,W_Kx,W_Vx) \tag{14}
$$

可学习参数为：

| 参数 | 形状 |
| --- | --- |
| $W_Q$ | $\mathbb{R}^{hd_k\times d_{\mathrm{model}}}$ |
| $W_K$ | $\mathbb{R}^{hd_k\times d_{\mathrm{model}}}$ |
| $W_V$ | $\mathbb{R}^{hd_v\times d_{\mathrm{model}}}$ |
| $W_O$ | $\mathbb{R}^{d_{\mathrm{model}}\times hd_v}$ |

因为 Q、K、V 要按头切片，可以把这些权重理解为沿输出维分别属于各个头。实现完成后，键、值和查询投影应总共使用三次矩阵乘法。原文脚注提供的进阶目标是将三种投影合成一个权重矩阵，只用一次矩阵乘法。

### 因果掩码

模型不能看到序列中的未来 token。给定 $t_1,\ldots,t_n$，计算前缀 $t_1,\ldots,t_i$ 的下一 token 预测时，不能访问位置 $i+1$ 到 $n$：推理时这些 token 尚不存在；训练时访问它们则泄露答案，让语言模型预训练目标失去意义。

朴素方法是针对 $n$ 个不同前缀运行 $n$ 次多头注意力。更高效的方法是使用**因果注意力掩码**，让位置 $i$ 只能关注 $j\le i$ 的位置。

原文允许使用 <code>torch.triu</code> 或广播索引比较构造掩码，并利用上一节已支持掩码的注意力实现。

### 应用 RoPE

RoPE 应用于**查询和键，不应用于值**。多头注意力中，各个头独立计算，因此头维度应作为批次维处理。每个头的查询与键使用完全相同的 RoPE 旋转。

::: problem multihead_self_attention | 实现因果多头自注意力 | 5

**交付物：** 将因果多头自注意力实现为 <code>torch.nn.Module</code>，至少接收：

- <code>d_model: int</code>：Transformer 块的输入维数。
- <code>num_heads: int</code>：注意力头数。

遵循 [8]，取 $d_k=d_v=d_{\mathrm{model}}/h$。

实现 <code>adapters.run_multihead_self_attention</code>，运行 <code>uv run pytest -k test_multihead_self_attention</code>。

:::
