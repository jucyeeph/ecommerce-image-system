# Ecommerce Image System

一个面向长期维护的 AI 电商视觉生产系统，服务于 Shopee、TikTok Shop、Lazada 和独立站等销售渠道。

当前 `260630_docker_version_1` 分支提供第一版 Docker 本地可视化管理台。它不自动调用 GPT 生图，而是帮助你管理人工 GPT 生图流程里的素材、Prompt、9 张电商图、SKU 图、图床链接和导出结果。

## 本地 Docker 部署

```bash
docker compose up --build
```

启动后打开：

```text
http://localhost:8080
```

数据保存在 Docker volume `ecommerce_image_system_data` 中。容器重启不会丢失项目、素材、Prompt 修改和导出记录。

## 第一版能做什么

- 创建电商生图项目。
- 上传电商原图素材包。
- 下载“素材提取包”，手动丢给 GPT 整理产品介绍、SKU 介绍和产品生图素材。
- 回传 GPT 整理后的产品素材。
- 管理固定版 Prompt。
- 在当前项目里微调每张图的 Prompt。
- 按 9 图流程生成主图、卖点图、SKU 选择图、购买欲图、品质图、使用图、向往图、高端体验图、信任图。
- 单独管理 SKU 图任务。
- 上传每一步手动 GPT 生成后的成品图。
- 填写图床链接。
- 导出 JSON 和 CSV，供后续电商自动化上架系统读取。

## 当前边界

- 不自动调用 GPT 或其他生图模型。
- 不自动解析产品链接。
- 不自动上传图床。
- 不接电商平台 API。
- 不做多用户权限。

## 项目目标

```text
上传产品素材
↓
整理产品生图素材、产品介绍和 SKU 信息
↓
按 9 图流程手动 GPT 生图并回传结果
↓
整理 SKU 图
↓
上传图床并记录链接
↓
导出给电商自动化上架系统
```
