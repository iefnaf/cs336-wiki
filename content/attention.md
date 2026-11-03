## 3.4.4 缩放点积注意力

本节实现 Vaswani 等人 [8] 第 3.2.1 节的缩放点积注意力。先实现其所需的 softmax，将未归一化分数向量转换成概率分布：

$$
\operatorname{softmax}(v)_i=\frac{\exp(v_i)}{\sum_{j=1}^{n}\exp(v_j)} \tag{10}
$$

当 $v_i$ 很大时，指数运算可能变为无穷大，之后的“无穷大除以无穷大”会产生 NaN。softmax 对所有输入同时加上任意常数不变，因此可以先减去向量最大值，使新的最大值为 0，提高数值稳定性。

::: problem softmax | 实现 softmax | 1

**交付物：** 编写函数，接收一个张量和维度 $i$，沿第 $i$ 维应用 softmax。

返回张量形状不变，但该维上应形成归一化概率分布。使用减去该维最大值的技巧避免数值问题。

完成 <code>adapters.run_softmax</code>，通过 <code>uv run pytest -k test_softmax_matches_pytorch</code>。

:::

### 注意力的定义

$$
\operatorname{Attention}(Q,K,V)=
\operatorname{softmax}\left(\frac{QK^\top}{\sqrt{d_k}}\right)V \tag{11}
$$

其中 $Q\in\mathbb{R}^{n\times d_k}$、$K\in\mathbb{R}^{m\times d_k}$、$V\in\mathbb{R}^{m\times d_v}$。**Q、K、V 都是本运算的输入，不是可学习参数。**

### 掩码

有时需要屏蔽部分注意力。布尔掩码 $M\in\{\mathrm{True},\mathrm{False}\}^{n\times m}$ 的第 $i$ 行表示查询 $i$ 应关注哪些键。

本指导书采用的约定是：<code>True</code> 表示允许关注，<code>False</code> 表示不允许关注。也就是说，信息只在值为 True 的位置流动。

例如，掩码 [[True, True, False]] 表示唯一的查询只关注前两个键。相比对多个子序列分别计算，使用掩码更高效：在 softmax 之前，对 $QK^\top/\sqrt{d_k}$ 中对应 False 的位置加上 $-\infty$。

::: problem scaled_dot_product_attention | 实现缩放点积注意力 | 5

**交付物：** 实现缩放点积注意力函数。

键和查询的形状为 <code>(batch_size, ..., seq_len, d_k)</code>，值的形状为 <code>(batch_size, ..., seq_len, d_v)</code>。省略号表示任意数量的其他批次维。输出应为 <code>(batch_size, ..., seq_len, d_v)</code>。批次维约定见第 3.2 节。

支持用户可选提供的 <code>(seq_len, seq_len)</code> 布尔掩码。对于每个查询，True 位置的注意力概率总和为 1，False 位置的概率为 0。

实现 <code>adapters.run_scaled_dot_product_attention</code>：

- <code>uv run pytest -k test_scaled_dot_product_attention</code> 检查三阶输入。
- <code>uv run pytest -k test_4d_scaled_dot_product_attention</code> 检查四阶输入。

:::
