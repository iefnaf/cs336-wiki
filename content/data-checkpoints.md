## 5 训练循环

接下来把已完成的分词数据、模型与优化器组合起来。

## 5.1 数据加载器

经过分词的数据是一条 token 序列 $x=(x_1,\ldots,x_n)$。尽管源数据由不同文档、网页或代码文件组成，常见做法是将其拼成单个序列，并在文档间加入 <code>&lt;|endoftext|&gt;</code> 一类分隔符。

数据加载器把它转换为批次流：每个批次有 $B$ 条长度为 $m$ 的输入序列，配上同样长度的下一 token 目标。例如 $B=1,m=3$ 时，一个可能的批次是：

$$
([x_2,x_3,x_4],[x_3,x_4,x_5])
$$

这种加载方式简化了训练：

- 任意 $1\le i\le n-m$ 都给出有效训练片段，易于采样。
- 序列等长，无需填充，可提高硬件利用率，也有助于增大批次。
- 抽样不必把整个数据集装入内存，容易处理大型语料。

::: problem data_loading | 实现数据加载 | 2

**交付物：** 编写函数，接收整数 token ID 的 NumPy 数组、<code>batch_size</code>、<code>context_length</code> 和 PyTorch 设备字符串，例如 <code>cpu</code> 或 <code>cuda:0</code>。

返回输入序列与下一 token 目标两个张量。二者形状都是 <code>(batch_size, context_length)</code>，包含 token ID，并放在指定设备上。

实现 <code>adapters.run_get_batch</code>，运行 <code>uv run pytest -k test_get_batch</code>。

:::

::: tip 低资源提示：CPU 或 Apple Silicon 上的数据加载

数据和模型必须放在正确且相同的设备上：CPU 使用 <code>cpu</code>；Apple Silicon 的 M 系列芯片使用 <code>mps</code>。

可参阅 [PyTorch MPS 文档](https://docs.pytorch.org/docs/stable/mps.html)、[MPS 说明](https://docs.pytorch.org/docs/stable/notes/mps.html)、[Apple Metal Performance Shaders](https://developer.apple.com/documentation/metalperformanceshaders)。

:::

### 数据集无法装入内存时

Unix 的 <code>mmap</code> 把磁盘文件映射到虚拟内存，仅在访问相应地址时惰性加载内容，让程序可以“假装”整个数据集都在内存中。

NumPy 对应的接口是 <code>np.memmap</code>；如果文件原先通过 <code>np.save</code> 保存，也可以给 <code>np.load</code> 设置 <code>mmap_mode='r'</code>。返回的数组式对象会在访问元素时按需加载。

训练采样时务必采用内存映射模式，并指定与保存文件一致的 <code>dtype</code>。建议明确检查映射结果是否正确，例如是否存在超出词表大小的值。

## 5.2 检查点

除加载数据，还需要保存训练中的模型。作业超时、机器故障等可能导致中断，需要恢复；即使一切正常，也可能希望分析训练动态，或比较不同训练阶段的生成结果。

检查点应包含恢复训练所需的全部状态：

1. 模型权重。
2. AdamW 等有状态优化器的状态，例如矩估计。
3. 中断时的迭代次数，用于恢复学习率调度。

每个 <code>nn.Module</code> 和 <code>torch.optim.Optimizer</code> 都提供 <code>state_dict()</code>，以及对应的 <code>load_state_dict()</code>。<code>torch.save</code> 可以把含有张量与整数等对象的字典保存到路径或类文件对象；<code>torch.load</code> 可以再读回来。

::: problem checkpointing | 实现模型检查点 | 1

实现保存与加载检查点的两个函数。

| 接口 | 参数 | 行为 |
| --- | --- | --- |
| <code>save_checkpoint</code> | <code>model</code>、<code>optimizer</code>、<code>iteration</code>、<code>out</code> | 保存模型、优化器、迭代次数的状态。可用各自的 state_dict 与 torch.save。格式可以自由选择，只要之后能恢复。 |
| <code>load_checkpoint</code> | <code>src</code>、<code>model</code>、<code>optimizer</code> | 从路径或类文件对象读取，恢复模型与优化器，并返回保存的迭代次数。可用 torch.load 和 load_state_dict。 |

其中模型类型为 <code>torch.nn.Module</code>，优化器为 <code>torch.optim.Optimizer</code>，迭代次数为 <code>int</code>。<code>out</code> 与 <code>src</code> 支持 <code>str</code>、<code>os.PathLike</code>、<code>typing.BinaryIO</code> 或 <code>typing.IO[bytes]</code>。

实现 <code>adapters.run_save_checkpoint</code> 与 <code>adapters.run_load_checkpoint</code>，通过 <code>uv run pytest -k test_checkpointing</code>。

:::
