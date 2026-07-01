# Ecommerce Image Workbench

Phase 1 MVP for running one ecommerce image project from product link to Hermes collection, white-background material, and main image review.

## What Phase 1 Includes

- Create a project from a product link.
- Create the required project folder structure under `data/projects`.
- Generate a Hermes collection prompt as a real Markdown file.
- Upload and parse a Hermes zip package.
- Read `product_intro.md`, `sku_info.md`, `sku_info.json`, and `hermes_result_summary.md`.
- Rename the project from `Suggested Project Name` when possible.
- Generate editable Markdown prompts for white-background material and main image stages.
- Upload generated images, preview them, and select final files.
- Track project, stage, file, SKU, and prompt-version indexes in SQLite.

## What Phase 1 Does Not Include

- No ChatGPT API or OpenAI API integration.
- No automatic Hermes calls.
- No full 9-image workflow.
- No batch SKU image generation.
- No user permission system or multi-user collaboration.
- No online image editor or AI image review.
- No Shopee or TikTok Shop publishing automation.

## Start Locally

```bash
npm install
npm --prefix client install
npm run build
npm start
```

Open:

```text
http://localhost:3088
```

For development:

```bash
npm install
npm --prefix client install
npm run dev
```

The Vite dev server runs on `5173`, and API calls proxy through the built server only in production. For normal local acceptance, use `npm run build && npm start`.

## Docker Compose

Copy `.env.example` to `.env` if you need to change the port or data paths.

```bash
docker compose up -d --build
```

Default port:

```text
http://localhost:3088
```

NAS data should be mounted to `/app/data`. The compose file mounts local `./data`:

```yaml
volumes:
  - ./data:/app/data
```

## First Project Flow

1. Open the project list page.
2. Click `新建项目`.
3. Paste the 1688 product link.
4. Keep defaults or set brand, category, target platform.
5. Create the project.
6. Open the generated Hermes prompt and copy it into Hermes.
7. Upload the Hermes zip package on the project detail page.
8. Open `白底素材`, copy or edit the prompt, upload generated images, and select the final white-background image.
9. Open `主图生成`, copy or edit the prompt, upload generated main images, and select the final main image.

## Hermes Zip Requirements

The zip should include:

- `product_intro.md`
- `sku_info.md`
- `sku_info.json`
- `hermes_result_summary.md`
- `raw_material_package/`

If the zip has one extra nested folder, the parser will still try to find the required files. Missing `product_intro.md` or `sku_info.json` will not crash the workflow; the stage is marked `needs_fix`.

## Data Layout

Each project is stored under:

```text
data/projects/YYYYMMDD-001-pending-product-name/
```

After Hermes parsing, the folder is renamed when `Suggested Project Name` is available.

Important folders:

- `00_project_meta/`
- `01_hermes_collection/`
- `02_product_cutout_material/`
- `03_main_image/`
- `06_brand_assets_used/`
- `99_archive/`

SQLite is stored at:

```text
data/database/workbench.sqlite
```

The database is an index. Project files are the durable source of truth.

## Common Issues

- If the page opens but uploads fail, check the Docker volume permissions for `./data`.
- If Hermes parsing says `缺少 product_intro.md`, inspect whether the file name is different from the required exact name.
- If project renaming fails, the app keeps the flow running and shows a warning so you can rename the folder manually.
- If port `3088` is occupied, set `APP_PORT` in `.env`.

## Test

```bash
npm test
```

