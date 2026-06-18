# Prompt Evolution System

## Purpose

记录 Prompt 为什么修改、修改后产生什么效果、发现了什么问题，以及哪些做法可以复用。历史记录只追加，不覆盖。

## Change Principles

- 一次变更只解决一个明确问题。
- 变更前保存原版本和失败样例引用。
- 变更后使用相同输入进行对照评估。
- 产品真实性、品牌一致性和合规规则不得为提升视觉效果而降低。
- 只有通过审核的版本才能标记为 `approved`。

## Change Record Format

每次 Prompt 变更追加一条记录，包含：

| 字段 | 内容要求 |
| --- | --- |
| Date | 变更日期 |
| Prompt | Prompt 文件路径与阶段 |
| From / To | 旧版本与新版本 |
| Reason | 要解决的问题和观察证据 |
| Change | 修改的具体规则或表达 |
| Test Inputs | 用于对照的产品和 SKU |
| Result | 修改后的可见效果与评分变化 |
| Problems | 新问题、失败案例和适用边界 |
| Decision | 保留、回滚或继续实验 |
| Reviewer | 审核人 |

## Evaluation Dimensions

- 产品真实性
- 品牌一致性
- 当前图片营销目标
- 构图与灯光
- 文字和 SKU 准确性
- 移动端可读性
- 生成稳定性

## Best Practices

- 优先调整阶段目标和画面约束，再增加风格形容词。
- 负面约束用于阻止已知错误，不用于代替正向构图说明。
- 品类差异写入阶段目录的品类文件，不污染所有产品共用模板。
- 模型差异写入版本记录，不让标准 Prompt 依赖单一模型语法。

## History

首次变更记录从根级九类 Prompt 进入实际评测后开始追加。
