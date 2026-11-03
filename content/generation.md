## 6 生成文本

具备训练能力后，最后一块是让模型生成文本。语言模型接收长度为 <code>sequence_length</code> 的整数序列，可带批次维，并产生 <code>(sequence_length, vocab_size)</code> 的输出；每个位置描述其后下一 token 的预测。

现在要把这些输出变成新序列的采样过程。

### Softmax

按惯例，模型输出是最后一个线性层的 **logits**，因此需要用公式 10 的 softmax 把它转成归一化概率。

### 解码

向模型提供一个 token 前缀，即 **prompt**，让模型预测下一 token 的词表分布，然后从中采样。一步解码接收 $x_{1\ldots t}$，返回 $x_{t+1}$：

$$
P(x_{t+1}=i\mid x_{1\ldots t})=
\frac{\exp(v_i)}{\sum_j\exp(v_j)} \tag{21}
$$

$$
v=\operatorname{TransformerLM}(x_{1\ldots t})_t
\in\mathbb{R}^{\mathrm{vocab\_size}} \tag{22}
$$

取模型输出矩阵最后一个位置，因为要预测的是第 $t$ 个位置之后的 token。

反复从单步条件分布采样，并把已生成 token 接到下一步输入后，就得到基本解码器；直到生成 <code>&lt;|endoftext|&gt;</code>，或达到用户指定的最大生成数量。

### 解码技巧：温度缩放

小模型有时会生成质量很差的文本。两个简单技巧可以改善。首先是给 softmax 引入温度 $\tau$：

$$
\operatorname{softmax}(v,\tau)_i=
\frac{\exp(v_i/\tau)}
{\sum_{j=1}^{\mathrm{vocab\_size}}\exp(v_j/\tau)} \tag{23}
$$

当 $\tau\to0$，最大分数项逐渐主导，分布趋向集中在该项上的独热向量。

### 解码技巧：核采样（top-p）

第二个技巧是 nucleus sampling，也称 top-p 采样，通过截去低概率 token 调整采样分布。

令 $q$ 为温度缩放后、大小为词表长度的概率分布。给定阈值 $p$：

$$
P(x_{t+1}=i\mid q)=
\begin{cases}
\dfrac{q_i}{\sum_{j\in V(p)}q_j}, & i\in V(p)\\
0, & \text{其他情况}
\end{cases} \tag{24}
$$

$V(p)$ 为概率总和至少达到 $p$ 的最小索引集合。可先按概率从大到小排序，再依次选取最大的词表项，直到达到阈值。

::: problem decoding | 解码 | 3

**交付物：** 实现从语言模型解码的函数，建议支持：

- 接收用户 prompt，采样补全，直到遇到 <code>&lt;|endoftext|&gt;</code>。
- 允许用户控制最大生成 token 数。
- 采样之前按用户给定温度缩放下一 token 分布。
- 按用户给定阈值进行 top-p／核采样 [27]。

:::
