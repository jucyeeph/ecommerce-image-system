# Ecommerce Image Workbench

## 项目目标

把 BigSeller 商品导入表转换为电商套图 AI 生成所需的标准素材包。

## Phase 1 功能

- 上传 BigSeller Excel
- 解析产品信息
- 解析 SKU 信息
- 提取图片 URL
- 下载图片到本地
- 生成项目文件夹
- 生成提示词草稿
- 在 SQLite 中记录项目索引

## Phase 2 功能

Phase 2 不调用 AI API。它是图片项目管理器，用来把素材、产品介绍、提示词和 ChatGPT 生成结果串成稳定工作流。

- 设置默认提示词：产品角度参考图、9 张电商图、SKU 图
- 上传默认生图素材：logo、品牌参考、背景参考、风格参考
- 初始化项目工作流：角度参考图、9 张电商图、全部 SKU 图
- 每个任务可单独编辑提示词
- 每个任务可下载 ChatGPT 素材压缩包
- 用户在 ChatGPT 生成后，可把结果图上传回当前任务
- 9 张电商图会把前面已上传的电商图放入后续素材包，作为风格参考

## 本地启动

```bash
npm install
npm run dev
```

## Docker 启动

```bash
docker compose up -d --build
```

## 访问地址

http://localhost:3000

## 工作流数据位置

项目运行后会在每个项目下创建：

```text
05_workflow/
  01_angle_reference/
  02_ecommerce_images/image_01 ... image_09/
  03_sku_images/
```

全局设置保存在：

```text
data/settings/
```

这些都是运行时数据，不提交到 Git。

## ChatGPT 素材包内容

每个工作流任务下载的 `input_package.zip` 只包含给 ChatGPT 实际使用的资料：

```text
prompt.md
product_brief.md
source_images/
generated_materials/
style_reference/
brand_assets/
```

`image_urls.json`、`product_info.json` 等系统追溯文件会继续保留在 `00_source/`，但不会默认放进 ChatGPT 素材包。

## 测试

```bash
npm test
```

## 测试 NAS 一键部署

脚本读取 `~/Desktop/pass/.env` 中的 `NAS_TEST_HOST`、`NAS_TEST_PORT`、`NAS_TEST_USER`、`NAS_TEST_PASSWORD`，不会把密钥写入仓库。

```bash
./scripts/deploy-nas-test.sh
```
