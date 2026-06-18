# Workflow Specification V3

## Purpose

定义产品素材进入系统后，各知识层和执行层的读取顺序、输入输出与失败处理。本文只描述流程合同，不实现工作流。

## Canonical Flow

```text
读取产品素材
↓
验证产品事实与必要输入
↓
读取品牌规范
↓
读取图片类型规范
↓
读取结构化 AI 规格
↓
读取对应 Prompt 模板
↓
生成候选图片
↓
执行质量审核
↓
人工确认关键事实
↓
输出结果
```

## Stages

| 阶段 | 读取 | 产出 | 失败处理 |
| --- | --- | --- | --- |
| 1. Product Intake | 产品图、Logo、产品信息、SKU、市场 | 标准化任务输入 | 缺少必要输入时停止 |
| 2. Fact Validation | 产品资料与证据 | 已验证事实集合 | 未验证声明移除或退回补充 |
| 3. Brand Context | 品牌文档与 `specs/brand_rules.yaml` | 品牌执行约束 | 品牌资产未批准时停止 |
| 4. Image Type Context | `docs/image_types/` 与 `specs/image_types.yaml` | 九张图任务清单 | 阶段缺失或顺序错误时停止 |
| 5. Prompt Assembly | 根级 Prompt 与 `specs/prompt_variables.yaml` | 九份完整生成请求 | 必填变量为空时停止 |
| 6. Candidate Generation | 完整生成请求 | 候选图片 | 生成失败时记录原因并重试，不修改事实 |
| 7. Quality Review | 质量规则、原始输入、候选图片 | 评分与问题列表 | 关键项失败直接拒绝 |
| 8. Human Approval | 候选图片、证据和审核结果 | 批准或返工决定 | 未批准不得进入输出 |
| 9. Output | 已批准图片与元数据 | 固定顺序的 9 图结果 | 输出不完整时不得发布 |

## Layer Responsibilities

### Human Knowledge Layer

解释为什么这样设计、什么是好坏示例，以及未来如何优化。该层允许持续讨论和迭代。

### AI Specification Layer

保存稳定、结构化、机器可读的规则。只有在人类知识层变化经过审核后才同步更新。

### Prompt Layer

把 AI 规格、产品事实和单图目标组合为生成请求。Prompt 变更必须记录原因和效果。

## Failure Principles

- 缺失数据不得用推测补全。
- 规则冲突按“产品事实与合规 → 品牌规范 → 图片类型 → Prompt → 单次偏好”解决。
- 质量审核发现真实性、Logo、SKU、认证或声明错误时直接拒绝。
- 重试不得放宽事实保护和合规要求。

## Output Handoff

后续上传或发布系统只能接收已通过人工确认的完整 9 图集合。自动上传、发布和平台 API 不属于 Phase 3。
