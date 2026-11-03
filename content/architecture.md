## 3 Transformer 语言模型架构

语言模型接收一批整数 token ID 序列，输入张量形状为 <code>(batch_size, sequence_length)</code>，并返回各位置上覆盖整个词表的归一化概率分布，形状为 <code>(batch_size, sequence_length, vocab_size)</code>。每个位置预测的是该 token 之后的下一个 token。

训练时，利用这些预测计算真实下一 token 与预测分布之间的交叉熵。推理生成时，取最后一个时间步的预测分布，选出下一个 token，例如取最大概率项或从分布采样，再把生成的 token 接到输入序列后面，重复此过程。

这一部分将从零构建 Transformer 语言模型。先介绍整体结构，再逐步说明各组件。

## 3.1 Transformer 语言模型

给定 token ID 序列，先通过输入嵌入把 ID 变成稠密向量，经过 <code>num_layers</code> 个 Transformer 块，再用一个可学习线性投影，即“输出嵌入”或“LM head”，得到下一 token 的预测 logits。

![指导书图 1 与图 2：完整 Transformer 语言模型，以及预归一化 Transformer 块](/assets/transformer-figures.png)

*图 1、图 2：保留原指导书的模型结构图。左图从下向上依次为输入、token 嵌入、多个 Transformer 块、归一化、输出线性层与 softmax；右图展示预归一化块的两个子层及残差连接。*

### Token 嵌入

第一步把一批 token ID 转换成包含 token 身份信息的向量序列，对应图 1 的红色模块。嵌入层将 <code>(batch_size, sequence_length)</code> 的整数张量，变为 <code>(batch_size, sequence_length, d_model)</code> 的向量张量。

### 预归一化 Transformer 块

嵌入之后，激活值依次经过多个结构相同的神经网络层。标准的仅解码器 Transformer 包含 <code>num_layers</code> 个这样的层，通常称为 Transformer “块”。

每个块的输入和输出都是 <code>(batch_size, sequence_length, d_model)</code>。它通过自注意力聚合序列信息，再通过前馈层进行非线性变换。

经过全部块后，把最终激活转成词表上的分布。本作业采用第 3.4 节详述的 **pre-norm（预归一化）** 结构；最后一个 Transformer 块之后还需要额外的层归一化，保证输出具有适当尺度。随后用标准的可学习线性变换得到下一 token 的预测 logits，参见 Radford 等人 [7] 的公式 2。
