# Phase 1 Requirements

Phase 1 builds a local ecommerce image workbench that converts a BigSeller `.xlsx` import file into a reusable AI image-generation material package.

## In Scope

- Upload a BigSeller `.xlsx` file.
- Parse product fields, SKU fields, main image URLs, detail image URLs, and variant image URLs.
- Create a product project folder under `projects/`.
- Copy the original Excel file to `00_source/original_bigseller_import.xlsx`.
- Download images into `01_downloaded_images/main`, `detail`, and `sku`.
- Generate `product_info.json`, `sku_map.csv`, `image_urls.json`, `import_report.json`, and `project_status.json`.
- Generate prompt drafts in `02_prompts/`.
- Show import results, SKU rows, image status, prompt files, and project path in the web UI.
- Record project metadata in SQLite.

## Out of Scope

- Calling GPT Image or other image-generation APIs.
- Shopee upload automation.
- BigSeller login automation.
- 1688 crawling.
- Multi-user permission management.
- Complex prompt versioning or image editor workflows.
