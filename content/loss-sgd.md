## 4 训练 Transformer 语言模型

现在已经有数据预处理所需的分词器，以及 Transformer 模型。还需要构建训练支持：

- **损失：** 交叉熵。
- **优化器：** 用 AdamW 最小化损失。
- **训练循环：** 数据加载、检查点保存与训练管理。

## 4.1 交叉熵损失

对长度为 $m+1$ 的序列，模型为各位置 $i=1,\ldots,m$ 定义分布 $p_\theta(x_{i+1}\mid x_{1:i})$。训练集 $D$ 由这类序列组成，标准交叉熵，也就是负对数似然损失，为：

$$
\ell(\theta;D)=\frac{1}{|D|m}
\sum_{x\in D}\sum_{i=1}^{m}-\log p_\theta(x_{i+1}\mid x_{1:i}) \tag{16}
$$

一次 Transformer 前向传播可以同时计算所有位置的预测。对每个位置，模型产生 $o_i\in\mathbb{R}^{\mathrm{vocab\_size}}$ 的 logits：

$$
p(x_{i+1}\mid x_{1:i})=
\operatorname{softmax}(o_i)[x_{i+1}]
=\frac{\exp(o_i[x_{i+1}])}
{\sum_{a=1}^{\mathrm{vocab\_size}}\exp(o_i[a])} \tag{17}
$$

这里 $o_i[k]$ 表示向量的第 $k$ 项。交叉熵通常直接以 logits 向量与目标 token 定义；这对应真实 token 上的 Dirac delta 分布与预测 softmax 分布之间的交叉熵。

和 softmax 一样，实现交叉熵时需要谨慎处理数值问题。

::: problem cross_entropy | 实现交叉熵 | 1

**交付物：** 编写函数，接收预测 logits $o_i$ 与目标 $x_{i+1}$，计算：

$$
\ell_i=-\log\operatorname{softmax}(o_i)[x_{i+1}]
$$

要求：

- 减去最大元素，确保数值稳定。
- 尽可能消去 log 与 exp。
- 支持额外的批次维，返回批次平均损失。和第 3.2 节一样，批次维始终位于词表维之前。

实现 <code>adapters.run_cross_entropy</code>，运行 <code>uv run pytest -k test_cross_entropy</code>。

:::

### 困惑度

交叉熵足以训练模型，评估时还要报告困惑度。对于长度为 $m$、各位置交叉熵为 $\ell_1,\ldots,\ell_m$ 的序列：

$$
\operatorname{perplexity}=
\exp\left(\frac{1}{m}\sum_{i=1}^{m}\ell_i\right) \tag{18}
$$

## 4.2 SGD 优化器

最简单的基于梯度的优化器是随机梯度下降（SGD）。从随机初始化的参数 $\theta_0$ 出发，在每一步 $t=0,\ldots,T-1$：

$$
\theta_{t+1}\leftarrow\theta_t-\alpha_t\nabla L(\theta_t;B_t) \tag{19}
$$

$B_t$ 是从数据集 $D$ 随机抽取的批次，学习率 $\alpha_t$ 和批次大小 $|B_t|$ 都是超参数。

### 4.2.1 在 PyTorch 中实现 SGD

优化器通过继承 <code>torch.optim.Optimizer</code> 实现，需要两个方法：

| 方法 | 职责 |
| --- | --- |
| <code>__init__</code> | 接收要优化的参数或参数组，以及学习率等超参数；把参数和以字典表示的默认超参数传给父类构造函数，供后续更新使用。参数组可用于让模型不同部分采用不同超参数。 |
| <code>step</code> | 在反向传播后执行一次参数更新。遍历各参数张量，利用存在的 <code>p.grad</code> 原地修改参数对应的 <code>p.data</code>。 |

原文通过带学习率衰减的 SGD 演示 API 的细节：

$$
\theta_{t+1}=\theta_t-\frac{\alpha}{\sqrt{t+1}}\nabla L(\theta_t;B_t) \tag{20}
$$

<details><summary>查看指导书提供的 SGD 示例代码</summary>

<div data-excerpt="sgd-example"></div>

</details>

在示例中，父类根据传入参数及默认超参数组织参数组；如果只有一个 <code>nn.Parameter</code> 集合，就创建一个使用默认值的组。<code>step</code> 逐组、逐参数执行公式 20。

每个参数关联的状态保存迭代次数：读取次数、完成更新、再递增。API 还允许传入可调用的 <code>closure</code>，在更新前重新计算损失。这里并不需要该功能，但示例保留它以符合接口。

原文还给出一个最小训练循环：创建参数与优化器，反复清空梯度、计算标量损失、执行反向传播，再调用优化器。这是典型训练结构；语言模型训练时，参数来自 <code>model.parameters()</code>，损失则在抽样数据批次上计算，基本流程相同。

<details><summary>查看指导书提供的最小训练循环</summary>

<div data-excerpt="sgd-loop"></div>

</details>

::: problem learning_rate_tuning | 调整学习率 | 1

学习率是最影响训练的超参数之一。把上述 SGD 示例的学习率分别改为 **1e1、1e2、1e3**，每次只运行 **10 次迭代**。各学习率下损失如何变化？下降更快、更慢，还是发散，即训练中不断增加？

**交付物：** 用一至两句话描述观察到的现象。

:::
