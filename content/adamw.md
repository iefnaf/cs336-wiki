## 4.3 AdamW

现代语言模型通常使用比 SGD 更复杂的优化器，近期多数优化器源自 Adam [22]。本作业采用广泛使用的 **AdamW** [23]。

AdamW 通过增加与梯度更新解耦的权重衰减，改善正则化效果：每次迭代都让参数向零收缩。实现应遵循 Loshchilov 等人 [23] 的算法 2。

AdamW 是有状态的：每个参数都要维护一阶、二阶矩的运行估计。因此，它用额外内存换取更好的稳定性与收敛。

除学习率 $\alpha$，还有控制矩估计更新的 $(\beta_1,\beta_2)$，以及权重衰减系数 $\lambda$。常见取值是 $(0.9,0.999)$，但 LLaMA [12]、GPT-3 [24] 等大语言模型经常采用 $(0.9,0.95)$。$\varepsilon$ 是如 $10^{-8}$ 这样的小数，用于在二阶矩很小时改善数值稳定性。

### 指导书算法 1

下面原样保留指导书的 AdamW 算法图，避免重新排版改变更新顺序或偏置校正细节。

![指导书算法 1：AdamW 优化器](/assets/adamw-algorithm.png)

*图中 init 为初始化，first／second moment 为一阶／二阶矩，weight decay 为权重衰减。注意迭代计数 $t$ 从 1 开始。学习率校正、权重衰减和矩更新的顺序均按原图。*

::: problem adamw | 实现 AdamW | 2

**交付物：** 实现继承 <code>torch.optim.Optimizer</code> 的 AdamW 类。构造方法接收学习率 $\alpha$、一阶和二阶矩衰减系数 $(\beta_1,\beta_2)$、数值稳定项 $\varepsilon$、权重衰减系数 $\lambda$ 等超参数。

父类的 <code>self.state</code> 字典将 <code>nn.Parameter</code> 映射到各参数的状态字典，可保存 AdamW 所需的矩估计。

实现 <code>adapters.get_adamw_cls</code>，通过 <code>uv run pytest -k test_adamw</code>。

:::

::: problem adamw_accounting | AdamW 训练资源核算 | 2

假设全部张量均使用 **float32**，计算 AdamW 的内存与运算需求。

**(a)** 峰值内存是多少？分别计算参数、激活、梯度、优化器状态的占用，用 <code>batch_size</code> 与模型超参数 <code>vocab_size</code>、<code>context_length</code>、<code>num_layers</code>、<code>d_model</code>、<code>num_heads</code> 表示，假定 $d_{\mathrm{ff}}=\frac83d_{\mathrm{model}}$。

为简化计算，激活内存只考虑：

- Transformer 块中的 RMSNorm。
- 多头自注意力子层：QKV 投影、$QK^\top$ 矩阵乘法、softmax、值的加权和、输出投影。
- SwiGLU 前馈网络：$W_1$、$W_2$、门控分支的 SiLU、逐元素乘积、$W_3$。
- 最终 RMSNorm、输出嵌入、logits 上的交叉熵。

**交付物：** 参数、激活、梯度、优化器状态各自的代数式与总和。

**(b)** 对 GPT-2 XL 形状的模型代入数值，使表达式只依赖 <code>batch_size</code>。在 **80 GB** 内存内能容纳的最大批次是多少？

**交付物：** 形如 $a\cdot\mathrm{batch\_size}+b$ 的数值表达式，以及最大批次大小。

**(c)** AdamW 一次更新需要多少 FLOPs？

**交付物：** 代数表达式及简短说明。

**(d)** 模型 FLOPs 利用率 **MFU** [16] 通常定义为训练实际需要的模型 FLOPs 与硬件同时期理论可提供峰值 FLOPs 之比；实际测量时，常由 token 吞吐量和每个 token 的模型 FLOPs 推导。NVIDIA H100 的 **495 TFLOP/s** 指 TensorFloat-32（TF32）Tensor Core 峰值；原文中的 “bfloat19” 是笔误。

若达到 **50% MFU**，单张 H100 训练 GPT-2 XL **400K 步**、批次大小 **1024**，需要多久？沿用 Kaplan 等人 [25] 和 Hoffmann 等人 [26]，假定反向传播 FLOPs 是前向传播的两倍。

**交付物：** 所需小时数及简短说明。

:::
