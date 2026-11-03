## 3.3 基础组件：Linear 与 Embedding

### 3.3.1 参数初始化

有效训练神经网络往往需要仔细初始化参数。较差的初始化可能导致梯度消失或爆炸。预归一化 Transformer 对初始化较鲁棒，但初始化仍会显著影响训练速度与收敛。

本作业已经较长，具体原理留待作业 3；目前使用以下通常有效的近似配置：

| 参数 | 初始化 |
| --- | --- |
| 线性层权重 | 均值为 0、方差为 $2/(d_{\mathrm{in}}+d_{\mathrm{out}})$ 的正态分布，在 $[-3\sigma,3\sigma]$ 截断。 |
| 嵌入矩阵 | 均值为 0、方差为 1 的正态分布，在 $[-3,3]$ 截断。 |
| RMSNorm | 全 1。 |

使用 <code>torch.nn.init.trunc_normal_</code> 初始化截断正态权重。这是本节原文明确指定的初始化 API。

### 3.3.2 Linear 模块

线性层是 Transformer 和一般神经网络的基本组件。首先实现继承 <code>torch.nn.Module</code> 的 <code>Linear</code> 类，执行：

$$
y=Wx \tag{3}
$$

遵循多数现代大语言模型，本作业**不使用偏置项**。

::: problem linear | 实现线性模块 | 1

**交付物：** 实现继承 <code>torch.nn.Module</code> 的 <code>Linear</code> 类。接口应与 PyTorch 的 <code>nn.Linear</code> 类似，但不包含偏置参数或对应构造参数。

构造方法接收：

| 参数 | 类型 | 含义 |
| --- | --- | --- |
| <code>in_features</code> | <code>int</code> | 输入的最后一维大小。 |
| <code>out_features</code> | <code>int</code> | 输出的最后一维大小。 |
| <code>device</code> | <code>torch.device \| None = None</code> | 参数所在设备。 |
| <code>dtype</code> | <code>torch.dtype \| None = None</code> | 参数数据类型。 |

<code>forward</code> 接收输入张量，返回执行线性变换后的张量。

要求：继承 <code>nn.Module</code>；调用父类构造函数；以 $W$ 而不是 $W^\top$ 的布局存储参数，并包装为 <code>nn.Parameter</code>；不得使用 <code>nn.Linear</code> 或 <code>nn.functional.linear</code>。按前述配置，用 <code>torch.nn.init.trunc_normal_</code> 初始化权重。

实现适配器 <code>adapters.run_linear</code>。适配器应将给定权重加载到你的模块，可使用 <code>Module.load_state_dict</code>。运行 <code>uv run pytest -k test_linear</code>。

:::

### 3.3.3 Embedding 模块

Transformer 的第一层将整数 token ID 映射到 $d_{\mathrm{model}}$ 维向量空间。需要实现自定义的 <code>Embedding</code>，继承 <code>torch.nn.Module</code>，不能使用 <code>nn.Embedding</code>。

前向方法根据形状为 <code>(batch_size, sequence_length)</code> 的 <code>torch.LongTensor</code>，从形状为 <code>(vocab_size, d_model)</code> 的嵌入矩阵中索引出各 token 的向量。

::: problem embedding | 实现嵌入模块 | 1

**交付物：** 实现进行嵌入查找的 <code>Embedding</code> 类，接口遵循 PyTorch 内置嵌入模块。

构造方法接收：

| 参数 | 类型 | 含义 |
| --- | --- | --- |
| <code>num_embeddings</code> | <code>int</code> | 词表大小。 |
| <code>embedding_dim</code> | <code>int</code> | 嵌入维数，即 $d_{\mathrm{model}}$。 |
| <code>device</code> | <code>torch.device \| None = None</code> | 参数设备。 |
| <code>dtype</code> | <code>torch.dtype \| None = None</code> | 参数类型。 |

<code>forward</code> 接收 token ID 张量，返回对应嵌入向量。

要求：继承 <code>nn.Module</code> 并调用父类构造函数；将嵌入矩阵初始化为 <code>nn.Parameter</code>；存储布局的最后一维是 <code>d_model</code>；不得使用 <code>nn.Embedding</code> 或 <code>nn.functional.embedding</code>。按前述配置初始化。

实现 <code>adapters.run_embedding</code>，运行 <code>uv run pytest -k test_embedding</code>。

:::
