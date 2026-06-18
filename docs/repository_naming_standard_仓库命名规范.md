# Repository Naming Standard｜仓库命名规范

## Purpose

统一仓库文件命名，使文档对人类清晰、对 AI 可定位、对长期维护和 Prompt 迭代稳定。

## Naming Principle

除 `README.md` 外，所有 Markdown 文件使用：

```text
english_slug_中文说明.md
```

规则：

- 英文 slug 放在前面，中文用途说明放在后面。
- 英文单词使用下划线连接，不使用空格或连字符。
- 中文说明应直接表达文件用途，避免“其他”“新版”等模糊词。
- 文件名不携带版本号；版本保留在文档标题、元数据或 Git 历史中。
- `README.md` 作为目录入口保持固定名称。

## Examples

```text
ecommerce_image_system_电商9图系统.md
brand_style_guide_品牌视觉规范.md
aspire_向往场景策略.md
identity_身份认同.md
quality_品质证明Prompt.md
repository_naming_standard_仓库命名规范.md
```

## Prohibited Names

禁止使用：

```text
07_aspire.md
v3_final_new.md
identity.md
desire.md
final.md
copy.md
```

这些名称依赖顺序、临时状态或单一语言，无法稳定表达用途，也容易导致 Agent 误引用。

## Layer Rules

### Docs and Human Knowledge

- 所有非 README Markdown 使用双语命名。
- 图片类型文件使用 `<stage>_<中文策略>.md`。
- 营销心理文件使用 `<concept>_<中文概念>.md`。
- 品牌规则文件使用 `<system>_<中文系统>.md`。

### Prompt Layer

- 标准 Prompt 使用 `<stage>_<中文用途>Prompt.md`。
- 品类扩展使用 `<category>_<中文品类>.md`。
- Prompt 文件名不包含模型名；模型差异记录在文档元数据和演进记录中。

### AI Specification Layer

`specs/` 保持纯英文 `snake_case`，因为文件会被 Agent、Python、Node 和 YAML 引用：

```text
image_types.yaml
brand_rules.yaml
prompt_variables.yaml
quality_check_rules.yaml
```

### Scripts, Assets and Outputs

- `scripts/`、`assets/`、`outputs/` 和工作流目录保持纯英文 `snake_case`。
- 机器调用路径不添加中文、空格或版本后缀。

## Extension Rules

- 新增 Markdown 前，先确认是否已有同用途文档。
- 新名称必须同时具备稳定英文概念和明确中文用途。
- 重命名必须在同一提交中更新所有 Markdown 链接、导航、Prompt 引用和工作流引用。
- 删除或替换文档时，不保留 `final`、`old`、`new`、`copy` 等副本；历史由 Git 保存。
- YAML 和未来代码中的路径引用必须使用仓库相对路径。

## AI Collaboration Rules

- Agent 创建 Markdown 时必须先验证文件名是否符合本规范。
- Agent 引用文档时必须使用准确的仓库相对路径，不根据旧名称猜测。
- Agent 完成重命名后必须扫描失效链接和旧名称残留。
- Agent 不得因命名调整修改业务内容、规则语义或目录层级。
- 无法确定中文用途时，停止创建文件并请求人工确认。

## Validation

命名变更完成后至少检查：

- 除 `README.md` 外，所有 Markdown 文件均符合双语命名。
- `specs/`、脚本、素材和输出目录仍保持纯英文。
- 仓库中不存在旧文件名引用。
- 所有相对 Markdown 链接均指向现有文件。
