# Prompt 目录规范

## Purpose

`prompts/` 按电商 9 图的营销职责管理 Prompt 资产。每个一级目录对应一张固定顺序的图片，目录名称与 [`../docs/ecommerce_image_system_v2.md`](../docs/ecommerce_image_system_v2.md) 保持一致。

当前阶段只建立目录规则，不提供可直接运行的 Prompt，不绑定任何图像模型，也不包含生成代码。

## 目录映射

| 顺序 | 目录 | 职责 |
| --- | --- | --- |
| 01 | `stop_scroll/` | 主图，吸引停留与点击 |
| 02 | `explain/` | 卖点图，解释购买理由 |
| 03 | `choose/` | SKU 图，帮助选择 |
| 04 | `desire/` | 效果图，激发购买欲 |
| 05 | `quality/` | 细节图，证明品质 |
| 06 | `use/` | 使用图，证明易用性 |
| 07 | `aspire/` | 向往图，建立身份认同 |
| 08 | `premium/` | 价值图，提升感知价值 |
| 09 | `trust/` | 信任图，消除购买顾虑 |

九个目录的顺序和职责不得互换。若一条 Prompt 同时承担多个任务，应拆分或明确唯一的主任务。

## 计划中的文件类型

每个阶段目录未来只使用以下文件类型：

| 文件 | 用途 | 是否在本阶段创建 |
| --- | --- | --- |
| `README.md` | 阶段目标、输入、画面规则和验收标准 | 是 |
| `base.md` | 经审核的通用 Prompt 模板 | 否 |
| `<category>.md` | 特定品类的增量规则，如 `nail_gel.md` | 否 |
| `examples.md` | 经人工验收的输入与输出示例 | 否 |

不得把临时测试、模型输出、产品图片或密钥放入 `prompts/`。产品素材进入 `assets/`，生成结果进入 `outputs/`。

## Prompt 文档标准

未来新增的 `base.md` 或品类文件必须包含：

1. **Metadata**：阶段、版本、状态、适用品类、适用品牌、目标语言和模型备注。
2. **Objective**：当前图片唯一的营销目标。
3. **Required Inputs**：生成前必须提供的产品事实与素材。
4. **Prompt Structure**：固定视觉模块、阶段模块、产品事实和 SKU 数据的组合顺序。
5. **Protected Facts**：不得改变的瓶型、Logo、标签、包装、颜色、数量和结构。
6. **Negative Constraints**：通用负面约束及当前阶段特有禁用项。
7. **Validation Checklist**：人工审核条件。
8. **Change Log**：版本、日期、变更内容和审核人。

建议使用以下元数据格式：

```yaml
stage: 01_stop_scroll
version: 1.0.0
status: draft
categories: []
brands: []
language: en
model_notes: model-agnostic
```

`status` 只允许：

- `draft`：草稿，不进入生产。
- `review`：等待内容或品牌审核。
- `approved`：已批准，可进入生产流程。
- `deprecated`：停止使用，仅保留追溯。

## 命名规范

- 目录使用小写 `snake_case`，不加顺序数字；顺序由阶段元数据和本文映射表定义。
- 品类文件使用稳定英文名称，如 `nail_gel.md`、`nail_tool.md`、`pet_product.md`。
- 不使用 `final.md`、`new.md`、`copy.md` 等无法追溯的名称。
- 版本号写入文件元数据，不写进文件名。
- 一个文件只描述一个阶段和一个规则层级。

## 规则继承顺序

Prompt 规则按以下顺序组合，后者只能补充细节，不能违反前者：

```text
产品事实与合规要求
→ 品牌视觉规范
→ 九图系统阶段职责
→ 阶段 base 规则
→ 品类增量规则
→ 单次任务输入
```

发生冲突时，以产品真实性、平台政策和已批准的品牌资产为最高优先级。

## 内容与合规边界

- 只使用已提供或已核验的产品卖点、SKU、认证、检测和服务承诺。
- 禁止编造功效、认证、专业背书、包装、赠品或使用结果。
- 禁止改变产品形状、Logo、标签、SKU 颜色、数量和配件。
- 禁止复制其他品牌的商标、包装或可识别视觉资产。
- 默认按移动端可读性设计，文字应简短并保留安全区。

## 审核要求

Prompt 从 `draft` 升级为 `approved` 前，应至少完成：

- 阶段目标检查
- 产品事实检查
- 品牌一致性检查
- SKU 与文案准确性检查
- 移动端可读性检查
- 平台与合规检查

具体阶段检查项见各目录的 `README.md`。
