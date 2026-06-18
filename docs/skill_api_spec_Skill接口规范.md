# Skill API Specification V1

## Purpose

定义 Hermes、Codex 和 OpenClaw 未来调用电商视觉能力时共享的任务合同。本文只定义接口语义，不包含 API、代码、模型接入或工作流实现。

## Supported Agents

- Hermes
- Codex
- OpenClaw

## Operation

统一操作名称：`prepare_ecommerce_image_set`

该操作负责读取三层架构并准备九图任务，不直接承诺生成、上传或发布。

## Request Contract

| 字段 | 类型 | 必填 | 来源 |
| --- | --- | --- | --- |
| `request_id` | string | 是 | 调用方 |
| `brand_name` | string | 是 | 已批准品牌数据 |
| `product_name` | string | 是 | 产品数据 |
| `product_type` | string | 是 | 产品数据 |
| `product_features` | string list | 是 | 已验证产品数据 |
| `sku_data` | object list | 是 | SKU 数据 |
| `target_market` | string | 是 | 任务简报 |
| `style_reference` | asset reference list | 是 | 已批准参考素材 |
| `product_assets` | asset reference list | 是 | 产品素材 |
| `logo_asset` | asset reference | 是 | 官方 Logo |

变量定义以 [`../specs/prompt_variables.yaml`](../specs/prompt_variables.yaml) 为准。

## Response Contract

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `request_id` | string | 原请求标识 |
| `status` | enum | `ready`、`needs_input`、`rejected` |
| `image_tasks` | object list | 固定顺序的九个图片任务 |
| `validation_issues` | object list | 缺失、冲突或不合规信息 |
| `spec_versions` | object | 使用的文档、规格和 Prompt 版本 |

## Image Task Contract

每个 `image_task` 必须包含：

- `image_type_id`
- `order`
- `goal`
- `resolved_variables`
- `prompt_reference`
- `required_outputs`
- `protected_facts`
- `quality_rules`

## Status Rules

- `ready`：所有必填输入存在且验证通过。
- `needs_input`：存在可补充的缺失信息，不得推测填充。
- `rejected`：存在不合规声明、未知 SKU、未批准品牌资产或规则冲突。

## Error Categories

- `missing_required_input`
- `invalid_sku_data`
- `unverified_claim`
- `unapproved_brand_asset`
- `conflicting_rule`
- `unsupported_image_type`

## Versioning

- 接口使用语义化版本。
- 响应必须记录使用的规格和 Prompt 版本。
- 破坏性字段变更提升主版本号。
- 规则增强但不改变字段合同提升次版本号。
- 文案修正提升补丁版本号。

## Agent Requirements

- 三个 Agent 使用相同字段、状态和错误分类。
- Agent 不得静默忽略缺失输入或验证失败。
- Agent 不得修改产品事实、品牌资产或 SKU 数据。
- 所有执行结果必须可追溯到输入和规格版本。
