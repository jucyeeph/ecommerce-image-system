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

## 测试

```bash
npm test
```

## 测试 NAS 一键部署

脚本读取 `~/Desktop/pass/.env` 中的 `NAS_TEST_HOST`、`NAS_TEST_PORT`、`NAS_TEST_USER`、`NAS_TEST_PASSWORD`，不会把密钥写入仓库。

```bash
./scripts/deploy-nas-test.sh
```
