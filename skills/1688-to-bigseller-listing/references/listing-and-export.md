# Listing, R2, and BigSeller Export

## Reuse the established listing workflow

Use the installed/local `bigseller-1688-ph-listing` skill and its supporting data when available. Preserve these core rules:

- Shopee Philippines category ID comes from the official/local category dataset and includes confidence.
- Buyer-facing content is English and PH-localized.
- Parent SKU, variants, and per-variant SKU values are approved at the listing gate.
- Real purchase cost is provided or explicitly approved by the user.
- Inventory defaults to `0` unless the user changes it.
- Final template headers and workbook formatting are preserved.

Do not deliver the initial workbook containing supplier image URLs after generated images have been approved. It is an intermediate artifact only.

## Upload manifest

Create a JSON file with this structure:

```json
{
  "object_prefix": "products/<offer-id>/<product-slug>/<date>",
  "images": [
    {
      "role": "main|detail|sku",
      "position": 1,
      "sku": "",
      "file_path": "/absolute/path/to/approved.png",
      "file_name": "stable-public-name.png"
    }
  ]
}
```

Requirements:

- Exactly one `main` image.
- Exactly eight `detail` images with unique positions 1–8.
- Exactly one `sku` image for every workbook SKU.
- Use stable ASCII object names and an offer/product/date prefix.
- Use only approved files.

## R2 configuration

Read configuration from a user-authorized `.env` containing:

- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ACCOUNT_ID`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`

Never print secret values. `R2_PUBLIC_BASE_URL` must be an unauthenticated public `r2.dev` URL or custom domain. Reject `*.r2.cloudflarestorage.com` as a public base because it is the authenticated S3 API endpoint.

Run:

```bash
node scripts/upload_r2_images.mjs \
  --env <r2-env-path> \
  --manifest <approved-upload-manifest.json> \
  --output <uploaded-url-manifest.json>
```

Verify each URL with an unauthenticated request before workbook authoring.

## BigSeller image mapping

For every SKU row:

| Header | Value |
| --- | --- |
| `变种图` | Public URL for that exact SKU |
| `产品主图*` | Approved main-image public URL |
| `产品附属图1`–`产品附属图8` | Approved supporting-image URLs in narrative order |

Do not match rows by row number alone. Match with the exact SKU string and confirm that all expected workbook SKUs appear once.

## Final workbook validation

- Copy the original/intermediate workbook; never overwrite it.
- Preserve every sheet, header, style, non-image value, and row order.
- Reopen the exported workbook.
- Confirm the expected worksheet and required headers exist.
- Confirm every data row has one SKU URL, one main URL, and eight detail URLs.
- Confirm SKU keys are unique and map to the correct images.
- Confirm all image URLs use the configured public base and return success.
- Scan for spreadsheet errors.
- Render a preview of the first several rows when tooling permits.
- Save the final workbook and validation report under `05_export/`.
