# Phase 2 Workflow

Phase 2 is a no-API image project manager. The system prepares structured material packages for ChatGPT, records prompts, and stores generated images that users upload back into the project.

## Workflow

1. Angle reference task
   - Inputs: collected main images, detail images, product information, default generation assets, editable prompt.
   - Output: user downloads a zip, sends it to ChatGPT, then uploads generated angle/reference images.
   - Result folder: `05_workflow/01_angle_reference/uploaded_results/`.

2. Nine ecommerce image tasks
   - Inputs: collected original images, angle reference results, product information, default generation assets, editable prompt.
   - Each later ecommerce image package also includes earlier uploaded ecommerce images as style references.
   - Result folders: `05_workflow/02_ecommerce_images/image_01/` through `image_09/`.

3. SKU image tasks
   - Inputs: corresponding SKU image, angle reference results, product information, default generation assets, editable prompt.
   - Result folders: `05_workflow/03_sku_images/{safe-sku-id}/`.

## Settings

Global settings live under `data/settings/` and are runtime data:

```text
data/settings/default_prompts.json
data/settings/generation_assets/logo/
data/settings/generation_assets/brand_refs/
data/settings/generation_assets/background_refs/
data/settings/generation_assets/style_refs/
```

Settings are intentionally outside Git so the test NAS can keep its own prompt and brand asset library.

## Package Contents

Each `input_package.zip` contains:

- `README_FOR_CHATGPT.md`
- `prompt.md`
- `product_info.json`
- `image_urls.json`
- source main/detail images when available
- angle reference results when available
- prior ecommerce image results for style continuity when applicable
- global generation assets from settings
