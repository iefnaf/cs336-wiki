## 7.4 在 OpenWebText 上运行

接下来使用来自网页抓取、更接近标准预训练场景的数据。课程提供了 OpenWebText [2] 的小型子集，也是一个单独文本文件，获取方式见第 1 节。

与 TinyStories 相比，它更真实、复杂、多样。建议浏览训练集，体会网页语料的特点。

::: example owt_example | OpenWebText 样例

Baseball Prospectus 的技术总监 Harry Pavlidis 雇用 Jonathan Judge 时冒了一个险。

Pavlidis 知道，正如 Alan Schwarz 在《The Numbers Game》中所写，美国文化中，没有哪个领域像棒球运动员的表现一样，被如此精确地计数、如此热情地量化。只需点击几下，就能查到 Noah Syndergaard 的快速球飞向本垒时每分钟旋转超过 2,100 次，Nelson Cruz 在 2016 年合格击球手中拥有最高的平均击球初速，以及无数像从电子游戏或科幻小说中摘出的细节。不断增长的数据海洋，使棒球文化中一个越来越重要的角色获得力量：业余分析爱好者。

这种力量也带来更多审视，不仅针对测量，也针对背后的人和出版机构。Pavlidis 很清楚量化不完美会给 Baseball Prospectus 带来怎样的批评。他也知道，网站的捕手指标需要重做，必须由能够解决复杂统计建模问题的人完成。

“他让我们感到震惊。”——Harry Pavlidis

根据 Judge 的文章，以及两人在网站主办的球场活动中的交流，Pavlidis 直觉认为 Judge “懂行”。……

*以上为原语料示例的译文，实际训练文本仍为英文。*

:::

本实验可能需要重新调节学习率、批次大小等超参数。

::: problem main_experiment | OpenWebText 实验 | 2 | 2 B200 小时

使用与 TinyStories 相同的模型架构和总训练迭代次数，在 OpenWebText 上训练，观察模型表现。

**交付物：** 模型在 OpenWebText 上的学习曲线。描述与 TinyStories 的损失差异，说明应该怎样理解这些损失。

**交付物：** 与 TinyStories 部分相同格式的生成文本。流畅度如何？为什么模型和计算预算相同，生成质量却更差？

:::
