# Project Folder Standard

Each import creates a project folder:

```text
projects/{date}_{ParentSKU}_{clean_product_name}/
```

Example:

```text
projects/2026-07-04_JB0213_一指星河猫眼甲油胶/
```

Folder layout:

```text
00_source/
  original_bigseller_import.xlsx
  product_info.json
  sku_map.csv
  image_urls.json
  import_report.json
01_downloaded_images/
  main/
  detail/
  sku/
02_prompts/
  image_01_main_prompt.md
  image_02_selling_points_prompt.md
  image_03_color_chart_prompt.md
  image_04_texture_prompt.md
  sku_image_prompt_template.md
  project_prompt_brief.md
03_generated/
  main_images/
  detail_images/
  sku_images/
04_review/
  selected/
  rejected/
  review_notes.md
project_status.json
```

Generated project folders are ignored by Git. Commit only the `projects/.gitkeep` placeholder.
