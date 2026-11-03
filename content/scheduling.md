## 4.4 学习率调度

让损失最快下降的学习率往往随训练进度变化。训练 Transformer 时，通常采用学习率调度：开始使用较大学习率以更快更新，再逐渐衰减。有些调度还会重新升高学习率，即重启，以帮助越过局部极小值。

本作业实现训练 LLaMA [12] 所用的**余弦退火调度**。

调度器本质上是一个函数：接收当前步数 $t$ 和初始、最终学习率等参数，返回该步的学习率。最简单的调度是常数函数，任意步数都返回相同值。

带预热的余弦退火接收当前步数 $t$、最大学习率 $\alpha_{\max}$、最小最终学习率 $\alpha_{\min}$、预热步数 $T_w$、余弦退火结束步数 $T_c$：

$$
\alpha_t=
\begin{cases}
\frac{t}{T_w}\alpha_{\max}, & t<T_w\\
\alpha_{\min}+\frac12\left(1+\cos\left(\frac{t-T_w}{T_c-T_w}\pi\right)\right)
(\alpha_{\max}-\alpha_{\min}), & T_w\le t\le T_c\\
\alpha_{\min}, & t>T_c
\end{cases}
$$

第一阶段为预热，第二阶段为余弦退火，结束后保持最小学习率。

::: problem learning_rate_schedule | 实现带预热的余弦学习率调度 | 1

编写函数，接收 $t$、$\alpha_{\max}$、$\alpha_{\min}$、$T_w$、$T_c$，按上述定义返回 $\alpha_t$。

实现 <code>adapters.get_lr_cosine_schedule</code>，通过 <code>uv run pytest -k test_get_lr_cosine_schedule</code>。

:::

## 4.5 梯度裁剪

训练中某些样本会产生很大的梯度，导致不稳定。常用的缓解方法是**梯度裁剪**：每次反向传播后、优化器更新前，限制梯度范数。

将全部参数的梯度视为 $g$，计算其 $\ell_2$ 范数 $\|g\|_2$。若低于最大值 $M$，保持不变；否则乘以：

$$
\frac{M}{\|g\|_2+\varepsilon}
$$

其中 $\varepsilon$ 是如 $10^{-6}$ 的数值稳定项，裁剪后的范数略低于 $M$。

::: problem gradient_clipping | 实现梯度裁剪 | 1

编写函数，接收参数列表与最大 $\ell_2$ 范数，**原地修改**每个参数的梯度。采用 PyTorch 默认的 $\varepsilon=10^{-6}$。

实现 <code>adapters.run_gradient_clipping</code>，通过 <code>uv run pytest -k test_gradient_clipping</code>。

:::
