# Docker Visual Management System Design｜Docker 可视化管理系统设计

## 1. Purpose

本设计定义 `260630_docker_version_1` 分支的第一版可视化管理系统。系统用于管理电商图片生产过程中的素材、Prompt、人工 GPT 生图步骤、成品图与图床链接。

第一版采用本地 Docker 单机部署，服务目标是“把人工 GPT 生图流程管清楚”，而不是直接替代 GPT、自动生图或自动发布电商平台。

## 2. Product Positioning

系统是一个电商图片生产项目管理台，负责把以下内容组织成可重复流程：

- 固定版品牌资料、品牌视觉资料、Prompt 和规则。
- 当前产品版产品介绍、SKU 介绍、产品素材和项目级 Prompt 微调。
- 九张电商图与 SKU 图的逐步生成任务。
- 手动 GPT 生图所需素材包、Prompt 文案和回传结果。
- 最终图床链接导出，供后续电商自动化上架系统使用。

## 3. First-Version Scope

### Included

- 本地 Docker Compose 部署。
- 单用户本地 Web 管理界面。
- SQLite 数据库存储结构化记录。
- Docker volume 保存上传文件、素材包、成品图和导出文件。
- 项目创建、物料上传和补充说明录入。
- 固定 Prompt 与固定资料管理。
- 当前项目 Prompt 微调与保存。
- 素材提取包下载。
- 每张图的 Prompt 复制、素材包下载、成品回传和状态跟踪。
- SKU 图批次生成流程。
- 图床链接录入、整理和导出。
- CSV、Excel 兼容表格和 JSON 三类导出格式。

### Excluded

- 不自动调用 GPT 或其他生图模型。
- 不自动解析产品链接内容。
- 不自动上传图床。
- 不接 Shopee、TikTok Shop、Lazada 或独立站 API。
- 不做多用户、权限、计费或远程团队协作。
- 不引入 Postgres、Redis、队列或对象存储。

## 4. System Architecture

第一版使用一个轻量 Docker Compose 应用：

```text
Browser
  ↓
Local Web App Container
  ↓
SQLite database + local file volume
```

### Runtime Components

- Web App：提供页面、流程状态、Prompt 管理、文件上传下载和导出。
- SQLite：保存项目、阶段、Prompt 版本、资产记录、SKU 记录和链接记录。
- File Volume：保存所有真实文件，包括原图、AI 整理后的素材、生成图、素材包和导出结果。

### Persistence Boundary

数据库只保存索引、状态和元数据；图片、压缩包和导出文件以文件形式保存在 Docker volume 中。这样可以保持文件可见、可备份，也便于后续迁移。

## 5. Core Domain Model

### Fixed Library

固定资料库保存长期稳定内容：

- 品牌介绍。
- 品牌视觉规范。
- 品牌视觉素材。
- 产品素材提取 Prompt。
- 九图固定 Prompt。
- SKU 图 Prompt。
- 固定负面约束。
- 固定导出模板。

固定资料默认来自仓库现有 `docs/`、`prompts/` 和 `specs/`，导入系统后可以微调，但每次修改必须形成版本记录。

### Product Project

每个产品项目保存当前产品版信息：

- 产品名称。
- 产品链接，可为空。
- 补充说明，可为空。
- 原始图片素材。
- GPT 提取后的产品介绍。
- GPT 提取后的 SKU 介绍。
- 当前产品生图素材。
- 项目级 Prompt 微调。
- 九图任务状态。
- SKU 图任务状态。
- 最终图床链接。

### Asset

资产包括：

- 原始产品图片。
- 品牌视觉素材。
- AI 提取后的产品生图素材。
- 手动 GPT 生成后的电商成品图。
- SKU 原图与 SKU 成品图。
- 素材包压缩文件。
- 导出文件。

资产必须记录所属范围：`fixed_library` 或 `product_project`。

### Prompt

Prompt 分为两层：

- Fixed Prompt：体系级默认 Prompt。
- Project Prompt Override：当前项目微调 Prompt。

项目执行时优先使用 Project Prompt Override；如果不存在，则继承 Fixed Prompt。项目级修改不得反向覆盖固定 Prompt，除非用户明确进入固定资料库修改。

## 6. Workflow Design

### 6.1 Create Project and Provide Materials

用户创建电商生图项目，上传原始图片素材，并可填写产品链接和补充说明。

系统保存：

- 项目基础信息。
- 原始素材文件。
- 链接和补充说明。
- 初始状态：`material_provided`。

### 6.2 Extract and Organize Product Materials

系统将以下内容打包给用户：

- 原始图片素材。
- 产品链接和补充说明。
- 产品生图素材提取 Prompt。
- 固定品牌约束。

用户下载素材包后，手动丢入 GPT，生成：

- 产品生图素材。
- 产品介绍。
- SKU 介绍。

用户将 GPT 输出回传系统，系统进入：`product_material_extracted`。

### 6.3 Generate Nine Ecommerce Images

九图阶段沿用当前仓库的九阶段体系：

1. `stop_scroll`：主图。
2. `explain`：卖点图。
3. `choose`：SKU 选择图。
4. `desire`：购买欲图。
5. `quality`：品质证明图。
6. `use`：使用场景图。
7. `aspire`：向往场景图。
8. `premium`：高端体验图。
9. `trust`：信任成交图。

每个阶段页面提供：

- 阶段目标说明。
- 当前使用的 Prompt。
- 当前项目可编辑 Prompt 微调。
- 需要下载的素材包。
- 一键复制 Prompt。
- 成品图上传区。
- 检查清单。
- 状态按钮：通过、重做、跳过。

每个阶段的输入组合为：

```text
产品生图素材
+ 当前阶段 Prompt
+ 产品介绍
+ 品牌介绍
+ 品牌视觉素材
+ 当前项目 Prompt 微调
→ 当前阶段成品图
```

### 6.4 Generate SKU Images

SKU 图使用独立批次任务，不硬塞进九图主流程。

流程为：

1. 用户选择 SKU 图片数量。
2. 用户上传或粘贴 SKU 介绍。
3. 系统创建 SKU 子任务。
4. 每个 SKU 子任务匹配 SKU 图、产品生图素材、SKU Prompt、产品介绍、品牌介绍和品牌视觉素材。
5. 用户下载素材包并复制 Prompt。
6. 用户手动 GPT 生图。
7. 用户上传 SKU 成品图。
8. 系统记录 SKU 图床链接。

### 6.5 Finish, Link, and Export

完成九图与 SKU 图后，用户进入最终整理页。

系统支持：

- 为每张图录入图床链接。
- 批量粘贴图床链接。
- 检查缺失链接。
- 标记最终版。
- 导出 CSV。
- 导出 Excel 兼容表格。
- 导出 JSON。

导出结果供电商自动化上架系统进行图片上传或商品资料组装。

## 7. State Model

### Project Status

- `draft`：项目已创建但物料不完整。
- `material_provided`：原始物料已上传。
- `product_material_extracted`：产品介绍、SKU 信息和产品生图素材已回传。
- `nine_images_in_progress`：九图生成中。
- `sku_images_in_progress`：SKU 图生成中。
- `linking_in_progress`：图床链接整理中。
- `completed`：全部链接导出完成。
- `archived`：项目归档。

### Stage Status

- `not_started`
- `package_ready`
- `waiting_for_manual_gpt`
- `uploaded`
- `approved`
- `needs_redo`
- `skipped`

跳过阶段必须填写原因，避免后续导出误以为缺失是系统错误。

## 8. File Organization

第一版建议 Docker volume 内部使用以下结构：

```text
data/
  database.sqlite
  fixed_library/
    brand/
    prompts/
    visual_assets/
  projects/
    project_<id>/
      raw_assets/
      extracted_assets/
      generated_images/
        stop_scroll/
        explain/
        choose/
        desire/
        quality/
        use/
        aspire/
        premium/
        trust/
      sku_images/
      packages/
      exports/
```

数据库记录每个文件的相对路径，不记录不可迁移的绝对路径。

## 9. Prompt Management

### Fixed Prompt Rules

固定 Prompt 属于系统级资料。修改时必须记录：

- Prompt 名称。
- 所属阶段。
- 版本号。
- 修改说明。
- 修改时间。
- 当前是否为默认版本。

### Project Prompt Override Rules

项目 Prompt 微调只影响当前产品项目。保存时必须记录：

- 继承自哪个固定 Prompt 版本。
- 修改了哪些内容。
- 当前项目是否启用该覆盖版本。
- 修改时间。

项目完成后，项目级 Prompt 可被人工提升为固定 Prompt 新版本，但第一版只设计入口，不自动执行提升。

## 10. Manual GPT Bridge

系统面向手动 GPT 生图，因此每个步骤都要提供一个稳定桥接动作：

- 下载素材包。
- 复制 Prompt。
- 上传 GPT 返回图。
- 粘贴 GPT 返回文字。
- 标记结果状态。

素材包中应包含一个说明文件，告诉用户当前步骤应该把哪些文件和 Prompt 丢进 GPT，以及期望 GPT 返回什么。

## 11. Checklist Design

每张图通过前需要检查：

- 是否使用了正确产品素材。
- 是否引用了当前产品介绍。
- 是否符合品牌视觉规范。
- 是否没有虚构功效、认证、包装、赠品或售后承诺。
- 是否生成了当前阶段要求的视觉目的。
- 是否上传了最终图。
- 是否填写或预留了图床链接。

检查清单用于减少人工流程遗漏，不替代未来的自动质量审核。

## 12. Export Contract

### CSV and Excel Columns

- `project_id`
- `project_name`
- `product_name`
- `image_type`
- `image_order`
- `image_name`
- `local_file_path`
- `image_url`
- `sku_id`
- `sku_name`
- `sku_image_url`
- `status`
- `notes`

### JSON Shape

```json
{
  "project_id": "project_001",
  "product_name": "Example Product",
  "main_images": [
    {
      "image_type": "stop_scroll",
      "order": 1,
      "url": "https://example.com/image-1.jpg",
      "status": "approved"
    }
  ],
  "sku_images": [
    {
      "sku_id": "sku_001",
      "sku_name": "Example SKU",
      "url": "https://example.com/sku-1.jpg",
      "status": "approved"
    }
  ]
}
```

第一版导出文件必须允许存在空链接，但需要在导出报告中标记缺失项。

## 13. Error Handling

- 文件上传失败：保留项目状态，不创建不完整资产记录。
- 素材包生成失败：阶段状态保持不变，并显示失败原因。
- 成品图缺失：不允许阶段标记为 `approved`。
- 图床链接缺失：允许导出，但导出报告必须列出缺失项。
- Prompt 覆盖为空：自动回退固定 Prompt。
- 固定 Prompt 缺失：阻止进入对应阶段，并提示补齐固定资料。

## 14. Data Safety

- 所有用户数据保存在 Docker volume 中。
- 删除项目第一版只做软删除或归档，不物理删除文件。
- 导出文件写入项目 `exports/` 目录。
- 数据库只保存相对路径，保证整个 `data/` 目录可整体备份迁移。
- 第一版不保存第三方 API Key。

## 15. Implementation Phasing

### Phase 4.1｜Local Shell

建立 Docker 单机应用外壳、数据库、文件目录、项目列表和项目创建。

### Phase 4.2｜Fixed Library and Prompt Management

实现固定资料库、Prompt 版本、品牌资料和视觉素材管理。

### Phase 4.3｜Project Workflow

实现项目物料上传、素材提取包、九图阶段状态、Prompt 复制和成品回传。

### Phase 4.4｜SKU Workflow

实现 SKU 批次、SKU 子任务、SKU 素材包和 SKU 成品回传。

### Phase 4.5｜Export and Handoff

实现图床链接整理、缺失项检查、CSV、Excel 兼容表格和 JSON 导出。

## 16. Acceptance Criteria

第一版完成后，用户应能在本地 Docker 环境中完成一次完整生产：

1. 新建一个产品项目。
2. 上传原始素材，填写产品链接和补充说明。
3. 下载素材提取包。
4. 手动使用 GPT 生成产品素材、产品介绍和 SKU 介绍。
5. 回传产品素材与介绍。
6. 依次完成九张电商图。
7. 创建并完成若干 SKU 图。
8. 为所有最终图录入图床链接。
9. 导出 CSV、Excel 兼容表格和 JSON。
10. 导出结果能被后续电商自动化上架系统读取。

## 17. Open Decisions for Later Phases

以下事项不进入第一版实现，但为后续预留：

- 自动调用 GPT 或图像模型。
- 自动解析产品链接。
- 自动上传图床。
- 多用户和权限。
- 远程部署。
- 对接电商平台 API。
- 将项目级 Prompt 一键提升为固定 Prompt 新版本。
