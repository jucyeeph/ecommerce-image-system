# Phase 3.6 Contract Hardening｜合同硬化规范

## Purpose

关闭 Phase 3.5 架构审计发现的合同缺口，使 Human Knowledge、AI Specification、Prompt 和 Skill API 能使用同一套字段、阶段标识、版本与审核结果进入 Phase 4。

本阶段只修改 Markdown 与 YAML，不实现执行代码、模型调用、图片生成、上传或发布。

## Success Criteria

- Skill API 的所有请求字段都能在机器可读输入合同中找到定义。
- 九类图片的阶段输入都能映射到统一请求结构。
- 每个阶段都有唯一 ID、Human 文档、Prompt、规则目录与输出目录映射。
- 没有礼盒或认证的产品仍能生成合规的第 08、09 张图。
- 九份 Prompt 都具有版本、状态、适用范围、输入、保护事实和变更记录。
- 质量评分对不同 Agent 可重复计算，并产生统一审核结果。
- Human、Specs 与 Prompt 的权威边界明确，不再维护重复规则。

## 1. Source-of-Truth Model

### Human Knowledge Layer

`docs/image_types/` 解释营销原因、用户心理、好坏示例和优化方向，是人类知识的唯一权威来源。

### AI Specification Layer

`specs/` 保存机器执行规则，是字段、阶段、适用条件、输入要求和质量计算的唯一权威来源。

### Prompt Layer

根级 Prompt 只负责把已解析变量表达为生成指令，不重新定义图片类型业务规则。阶段子目录的 `README.md` 只说明品类增量文件的职责和继承关系，不复制 Human 或 Specs 内容。

### API Layer

Skill API 只引用机器合同，不另建字段定义。发现未知字段时返回验证问题，不进行推测或静默忽略。

## 2. Unified Input Contract

`specs/prompt_variables.yaml` 继续作为统一请求字段来源，结构分为：

- `request`：请求标识、品牌、产品、市场、素材和全局 SKU。
- `stage_inputs`：九个阶段各自需要的事实和证据。
- `validation`：未知字段、必填字段、证据和品牌资产规则。

### Global Request Fields

- `request_id`
- `brand_name`
- `product_name`
- `product_type`
- `product_features`
- `sku_data`
- `target_market`
- `style_reference`
- `product_assets`
- `logo_asset`

### Stage Input Namespaces

- `stop_scroll.primary_feature`
- `explain.feature_evidence`
- `choose.sku_product_images`、`choose.sku_order`
- `desire.verified_results`、`desire.usage_context`
- `quality.material_data`、`quality.key_detail_list`
- `use.usage_steps`、`use.product_dimensions`、`use.safety_constraints`
- `aspire.target_audience`、`aspire.relevant_aspirational_context`
- `premium.official_packaging_images`、`premium.bundle_contents`、`premium.accessory_counts`
- `trust.verified_certifications`、`trust.quality_evidence`、`trust.after_sales_policy`

`specs/image_types.yaml` 只引用以上规范路径，不再引入未定义字段。

## 3. Stage Registry

新增 `specs/stage_registry.yaml`，为每个阶段记录：

- `id`
- `order`
- `slug`
- `human_knowledge_path`
- `prompt_path`
- `category_rules_path`
- `output_path`
- `image_type_spec_ref`

该注册表是阶段与路径映射的唯一机器可读来源。所有路径使用仓库相对路径；Prompt 版本和状态以 Prompt front matter 为唯一来源。

## 4. Applicability and Fallback Rules

每个图片类型增加：

- `applicability`：`always` 或 `conditional`
- `required_inputs`：始终需要的输入
- `optional_inputs`：可缺少的增强信息
- `input_groups`：`all_of` 或 `any_of` 组合规则
- `fallback_strategy`：可选输入缺失时允许的合规替代方案

### Premium

第 08 张图保持固定，但不要求所有产品拥有礼盒。优先展示真实礼盒或套装；缺失时回退为官方包装、完整交付内容或有秩序的产品陈列。禁止虚构包装和赠品。

### Trust

第 09 张图保持固定，但不要求所有产品拥有认证。优先使用真实认证；缺失时可使用品质证据、品牌保障或售后政策。至少一类可核验信任证据存在时即可执行。

## 5. Prompt Lifecycle Contract

九份根级 Prompt 使用统一 YAML front matter：

```yaml
stage: 01_stop_scroll
version: 1.0.0
status: draft
categories:
  - general
brands:
  - BOMD
  - JUCYEE
instruction_language: zh-CN
output_text_language: en
model_notes: model-agnostic
```

每份 Prompt 必须包含：

- Objective
- Required Inputs
- System Prompt
- User Prompt Template
- Variables
- Protected Facts
- Output Requirements
- Negative Constraints
- Validation Checklist
- Change Log

当前 Prompt 未经真实 SKU 评测，状态统一为 `draft`。只有完成评测和人工审核后才能进入 `review` 或 `approved`。

## 6. Quality Result Contract

质量加权分统一计算为：

```text
weighted_average = sum(rule_score × rule_weight) / sum(rule_weight)
```

规则：

- 每项分数范围为 0–5。
- 计算结果保留两位小数，使用四舍五入。
- 任一关键规则低于 `pass_score`，结果为 `reject`。
- 无关键失败但普通规则低于 `pass_score`，结果为 `revise`。
- 全部规则达到 `pass_score` 且加权平均达标，结果为 `pass`。

机器审核结果必须包含：

- `request_id`
- `image_type_id`
- `rule_scores`
- `weighted_average`
- `critical_failures`
- `decision`
- `issues`
- `reviewer`
- `reviewed_at`
- `spec_versions`

## 7. Documentation Alignment

- 更新根 `README.md`，说明仓库已完成 Phase 3.6 合同硬化，并提供三层入口。
- 填充 `docs/prompt_library_Prompt库.md`，作为 Prompt 索引，不复制 Prompt 内容。
- 更新 `prompts/README.md`，使文件结构、生命周期和双语命名一致。
- 阶段目录的 `README.md` 改为增量规则说明和权威来源链接。
- 更新 Workflow 与 Skill API，使它们引用统一输入合同、阶段注册表和质量结果。

## 8. Validation Plan

完成后必须验证：

- 所有 YAML 可解析。
- Skill API 请求字段与统一输入合同完全一致。
- `image_types.yaml` 引用的每个输入路径都存在。
- 阶段注册表包含 9 个唯一阶段，所有文件和目录路径存在。
- 九份 Prompt 均包含合法 front matter 和全部必需章节。
- Prompt front matter 的阶段 ID 与阶段注册表一致。
- Premium 和 Trust 的回退输入组合可满足。
- 质量评分公式与结果字段完整。
- Markdown 命名和相对链接继续有效。

## 9. Scope Boundary

本阶段不创建脚本、测试框架、模型适配器、工作流实现、图片资产或平台 API。Phase 4 才使用真实 SKU 验证这些合同。
