## 3.4.3 相对位置嵌入

为了向模型注入位置信息，本作业使用旋转位置嵌入 **RoPE（Rotary Position Embeddings）** [21]。

设位置 $i$ 的查询向量为 $q^{(i)}=W_qx^{(i)}\in\mathbb{R}^d$。对其施加成对旋转矩阵 $R^i$，得到：

$$
q'^{(i)}=R^i q^{(i)}=R^iW_qx^{(i)}
$$

给定常数 $\Theta$，将第 $k$ 对相邻元素 $q_{2k-1:2k}^{(i)}$ 视为二维向量，旋转角度为：

$$
\theta_{i,k}=\frac{i}{\Theta^{(2k-2)/d}},
\qquad k\in\{1,\ldots,d/2\}
$$

因此，$R^i$ 是一个 $d\times d$ 的分块对角矩阵，每个二维块为：

$$
R^i_k=
\begin{pmatrix}
\cos(\theta_{i,k}) & -\sin(\theta_{i,k})\\
\sin(\theta_{i,k}) & \cos(\theta_{i,k})
\end{pmatrix} \tag{8}
$$

完整矩阵为：

$$
R^i=
\begin{pmatrix}
R^i_1 & 0 & 0 & \cdots & 0\\
0 & R^i_2 & 0 & \cdots & 0\\
0 & 0 & R^i_3 & \cdots & 0\\
\vdots & \vdots & \vdots & \ddots & \vdots\\
0 & 0 & 0 & \cdots & R^i_{d/2}
\end{pmatrix} \tag{9}
$$

其中 0 表示 $2\times2$ 零矩阵。虽然可以构造完整矩阵，但好的实现应利用其结构更高效地进行变换。

我们只关心给定序列内 token 的相对旋转，因此计算出的正弦、余弦值可以跨层、跨批次复用。若要优化，可以让全部层引用同一个 RoPE 模块，在初始化时预计算二维正弦、余弦缓冲区，并通过 <code>register_buffer(persistent=False)</code> 注册。它们应是缓冲区，而不是 <code>nn.Parameter</code>，因为不需要学习固定三角函数值。

对位置 $j$ 的键向量 $k^{(j)}$，同样使用对应的 $R^j$ 旋转。**该层没有可学习参数。**

::: problem rope | 实现 RoPE | 2

**交付物：** 实现 <code>RotaryPositionalEmbedding</code> 类，将 RoPE 应用于输入张量。

建议构造方法接收：

| 参数 | 类型 | 含义 |
| --- | --- | --- |
| <code>theta</code> | <code>float</code> | RoPE 常数 $\Theta$。 |
| <code>d_k</code> | <code>int</code> | 查询与键向量维数。 |
| <code>max_seq_len</code> | <code>int</code> | 最大输入序列长度。 |
| <code>device</code> | <code>torch.device \| None = None</code> | 缓冲区所在设备。 |

前向方法接收 <code>x</code> 与 <code>token_positions</code>：前者形状为 <code>(..., seq_len, d_k)</code>，应容许任意数量的批次维，返回形状相同；后者形状为 <code>(..., seq_len)</code>，指定各 token 沿序列维的位置。

应利用这些位置，沿序列维索引可能预计算好的正弦、余弦张量。

完成 <code>adapters.run_rope</code>，通过 <code>uv run pytest -k test_rope</code>。

:::
