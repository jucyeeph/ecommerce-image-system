# Prompt 目录规范

## Purpose

`prompts/` 按电商 9 图的营销职责管理 Prompt 资产。根级双语文件保存模型无关的标准 Prompt 模板；同名分类目录保存人类可读的阶段规则和未来品类变体。两者均与 [`../docs/ecommerce_image_system_电商9图系统.md`](../docs/ecommerce_image_system_电商9图系统.md) 保持一致。

本层只定义 Prompt 内容，不绑定图像模型，也不包含调用或生成代码。

## 目录映射

| 顺序 | Prompt 文件 | 规则目录 | 职责 |
| --- | --- | --- |
| 01 | `stop_scroll_主图Prompt.md` | `stop_scroll/` | 主图，吸引停留与点击 |
| 02 | `explain_卖点Prompt.md` | `explain/` | 卖点图，解释购买理由 |
| 03 | `choose_SKU选择Prompt.md` | `choose/` | SKU 图，帮助选择 |
| 04 | `desire_购买欲Prompt.md` | `desire/` | 效果图，激发购买欲 |
| 05 | `quality_品质证明Prompt.md` | `quality/` | 细节图，证明品质 |
| 06 | `use_使用场景Prompt.md` | `use/` | 使用图，证明易用性 |
| 07 | `aspire_向往场景Prompt.md` | `aspire/` | 向往图，建立身份认同 |
| 08 | `premium_高端体验Prompt.md` | `premium/` | 价值图，提升感知价值 |
| 09 | `trust_信任成交Prompt.md` | `trust/` | 信任图，消除购买顾虑 |

九个文件及目录的顺序和职责不得互换。若一条 Prompt 同时承担多个任务，应拆分或明确唯一的主任务。

## 计划中的文件类型

每个阶段目录未来只使用以下文件类型：

| 文件 | 用途 | 状态 |
| --- | --- | --- |
| `prompts/<english_slug>_<中文说明>Prompt.md` | 标准 System Prompt、用户模板、变量、输出与负面约束 | 已建立 |
| `<stage>/README.md` | 阶段目标、输入、画面规则和验收标准 | 已建立 |
| `<stage>/<category>.md` | 特定品类的增量规则，如 `nail_gel.md` | 后续按需建立 |
| `<stage>/examples.md` | 经人工验收的输入与输出示例 | 后续按需建立 |

不得把临时测试、模型输出、产品图片或密钥放入 `prompts/`。产品素材进入 `assets/`，生成结果进入 `outputs/`。

## Prompt 文档标准

根级标准 Prompt 和未来新增的品类文件必须包含：

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

- 规则目录使用小写 `snake_case`，不加顺序数字；根级 Prompt 使用英文 slug 加中文说明。
- 品类文件使用双语名称，如 `nail_gel_甲油胶.md`、`nail_tool_美甲工具.md`、`pet_product_宠物用品.md`。
- 不使用 `final.md`、`new.md`、`copy.md` 等无法追溯的名称。
- 版本号写入文件元数据，不写进文件名。
- 一个文件只描述一个阶段和一个规则层级。

## 规则继承顺序

Prompt 规则按以下顺序组合，后者只能补充细节，不能违反前者：

```text
产品事实与合规要求
→ 品牌视觉规范
→ 九图系统阶段职责
→ 根级阶段 Prompt
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
