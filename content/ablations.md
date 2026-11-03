## 7.3 消融与架构修改

理解 Transformer 的最好方式，是修改它并观察行为。本节进行几项简单消融。

### 消融 1：层归一化

人们常说层归一化对 Transformer 训练稳定性很重要。先尝试移除 RMSNorm，看看会发生什么。

::: problem layer_norm_ablation | 移除 RMSNorm 后训练 | 1 | 0.5 B200 小时

移除 Transformer 中全部 RMSNorm 后训练。在原先最佳学习率下会发生什么？降低学习率能否恢复稳定？

**交付物：** 移除 RMSNorm 后的学习曲线，以及最佳学习率对应的曲线。

**交付物：** 几句话评论 RMSNorm 的影响。

:::

再研究归一化位置这个看似任意的选择。预归一化块定义为：

$$
z=x+\operatorname{MultiHeadSelfAttention}(\operatorname{RMSNorm}(x)) \tag{25}
$$

$$
y=z+\operatorname{FFN}(\operatorname{RMSNorm}(z)) \tag{26}
$$

它是对原始 Transformer 较有共识的修改之一。原始架构使用后归一化：

$$
z=\operatorname{RMSNorm}(x+\operatorname{MultiHeadSelfAttention}(x)) \tag{27}
$$

$$
y=\operatorname{RMSNorm}(z+\operatorname{FFN}(z)) \tag{28}
$$

现在退回后归一化并比较。

::: problem pre_norm_ablation | 实现后归一化并训练 | 1 | 0.5 B200 小时

将预归一化 Transformer 改为后归一化，训练并观察。

**交付物：** 后归一化模型与预归一化模型的学习曲线比较。

:::

层归一化显著影响模型行为，连其位置也很重要。

### 消融 2：位置嵌入

将使用 RoPE 的基础模型与完全不加入位置嵌入的 **NoPE** 比较。研究 [28, 29] 表明，仅解码器、使用因果掩码的 Transformer，理论上即使没有显式位置嵌入，也能推断相对或绝对位置信息。接下来进行实证检验。

::: problem no_pos_emb | 实现 NoPE | 1 | 0.5 B200 小时

从使用 RoPE 的 Transformer 中彻底移除位置嵌入信息，观察结果。

**交付物：** 比较 RoPE 与 NoPE 表现的学习曲线。

:::

### 消融 3：SwiGLU 与 SiLU

跟随 Shazeer [20]，比较 SwiGLU 与使用 SiLU、但没有 GLU 门控的前馈网络：

$$
\operatorname{FFN}_{\mathrm{SiLU}}(x)=W_2\operatorname{SiLU}(W_1x) \tag{29}
$$

SwiGLU 使用约 $\frac83d_{\mathrm{model}}$ 的内部维度，并保证是 64 的倍数。本消融中的 SiLU 网络应改为 $d_{\mathrm{ff}}=4d_{\mathrm{model}}$，使参数量与具有三个权重矩阵的 SwiGLU 大致一致；SiLU 网络只有两个权重矩阵。

::: problem swiglu_ablation | SwiGLU 与 SiLU | 1 | 0.5 B200 小时

**交付物：** 在参数量大致匹配的条件下，比较 SwiGLU 与 SiLU 前馈网络的学习曲线。

**交付物：** 几句话讨论发现。

:::

::: tip 低资源提示：GPU 资源有限的自学者可继续用 TinyStories

后续会转向更大、更嘈杂的 OpenWebText，试验架构修改，并可选择参加排行榜。OpenWebText 上训练到较流畅需要很久；GPU 有限的线上自学者，可以继续在 TinyStories 上测试修改，用验证损失评价效果。

:::
