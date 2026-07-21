---
name: 1688-to-bigseller-listing
description: Convert a user-provided 1688 product URL into a reviewed, image-complete BigSeller ERP import workbook for Shopee Philippines. Use when Codex should collect and translate 1688 product data, prepare listing copy and variants, generate a nine-image ecommerce set and SKU images, pause only at defined approval gates, upload approved assets to Cloudflare R2, replace workbook image URLs, validate delivery, and resume an interrupted project from saved state.
---

# 1688 to BigSeller Listing

Run the complete listing workflow from one 1688 URL. Automate routine work, preserve product truth, save state after every stage, and stop only for defined reviews or unavoidable external blockers.

## Load only the references needed

- Read [workflow-contract.md](references/workflow-contract.md) before starting or resuming every project.
- Read [product-truth.md](references/product-truth.md) before extracting facts, writing copy, or generating images.
- Read [image-production.md](references/image-production.md) before any image task.
- Read [listing-and-export.md](references/listing-and-export.md) before listing generation, R2 publication, or workbook authoring.
- Read [review-checklists.md](references/review-checklists.md) immediately before each approval gate and final delivery.

## Discover the working environment

1. Locate `ecommerce-image-workbench` and its `projects/` directory. Prefer the repository containing this skill.
2. Locate the existing `bigseller-1688-ph-listing` skill or repository for category data, field standards, collection helpers, and the official BigSeller template.
3. Locate the configured brand assets and generation references. Never assume a logo or bottle reference belongs to the current product.
4. Locate the Cloudflare R2 `.env` only when publication begins. Never print, copy, or persist secret values.
5. Use `scripts/workflow_state.py` to initialize or resume `05_workflow/automation_state.json`.

Resolve the directory containing this `SKILL.md` before running bundled scripts. Treat every `scripts/...` command below as relative to that skill directory and expand it to an absolute path when the current working directory differs.

If a matching project already exists, resume it. Do not create a second project or repeat approved stages unless the user explicitly requests a restart.

## Required tool routing

- Use an existing signed-in Chrome/1688 session for collection when available. Pause for login, captcha, or risk-control verification; never collect credentials.
- Use the existing `bigseller-1688-ph-listing` workflow for Shopee PH category mapping, English listing copy, variants, pricing, and the initial BigSeller workbook.
- Use `$gpt-image` for image generation or editing and `$gpt-image-2-style-library` for prompt/style selection when those skills are available. Use the platform image-generation tool directly when they are not.
- Use the spreadsheet skill and `@oai/artifact-tool` for final workbook authoring and verification.
- Use the bundled R2 uploader for deterministic publication after all image approvals.

## Non-negotiable rules

- Never invent product facts, specifications, certifications, effects, compatibility, or package contents.
- Never change visible product geometry, label text, printed branding, cap shape, bottle proportions, or variant appearance after the product truth is approved.
- Use the supplied logo asset exactly. Do not redraw it. Prefer deterministic logo/text compositing when generation may corrupt typography.
- Keep buyer-facing listing and image text in English. Do not allow Chinese in final ecommerce or SKU images unless the user explicitly approves an exception.
- Do not generate downstream batches from an unapproved upstream image.
- Never overwrite an approved image. Create a new version and keep the approved selection explicit.
- Never publish rejected or merely generated images.
- Never put temporary, signed, local, or authenticated S3 API URLs into BigSeller. Every exported image URL must pass unauthenticated HTTP verification.
- Do not claim completion until the final workbook has been reopened and validated.

## Workflow

### 1. Initialize or resume

Validate that the input is a `detail.1688.com/offer/...` URL and derive the offer ID. Create or locate one product project, then run:

```bash
python3 scripts/workflow_state.py init --project <project-path> --source-url <1688-url>
python3 scripts/workflow_state.py show --project <project-path>
```

On resume, inspect the saved state and approved artifact selections. Continue from the first incomplete stage without redoing approved work.

### 2. Collect source material and prepare the listing

Collect product facts, variants, original images, package data, and supplier URL. Apply the existing Shopee PH listing standards to produce:

- `00_source/product_info.json`
- `00_source/product_truth.json`
- `00_source/sku_map.csv`
- downloaded main, detail, and SKU source images
- English title and description
- category decision and confidence
- pricing inputs and calculation
- initial BigSeller workbook
- validation warnings

Use the actual 1688 page price only as a reference. If real purchase cost is missing, include it in the first review instead of interrupting earlier extraction.

### 3. Approval gate: listing blueprint

Present one compact review containing:

- immutable product facts and uncertain facts
- title and full description
- category and confidence
- Parent SKU, variants, and per-variant SKUs
- price calculation and any required user input
- planned nine-image story

Ask the user to approve or provide corrections. Do not start image generation before approval. Record the response with:

```bash
python3 scripts/workflow_state.py approve --project <project-path> --gate listing --note <review-note>
```

### 4. Build the product identity pack and generate the main image

Create a small identity pack from the clearest source images:

- exact product front/side references
- exact logo file
- locked label text and geometry notes
- approved target-market copy
- approved visual direction

Generate one strong main-image direction first. Generate a second option only when visual uncertainty is high or the user asked for options. Use 1200×1200 unless the marketplace/template requires another size.

### 5. Approval gate: main image

Show the candidate at useful viewing size and summarize the intended hierarchy. Ask only for approval or concrete corrections. On approval, save the selected file as an immutable version and record:

```bash
python3 scripts/workflow_state.py approve --project <project-path> --gate main_image --note <review-note>
```

### 6. Generate the remaining ecommerce set

Use the approved main image, product identity pack, and prior approved outputs as references. Generate images 2–9 according to [image-production.md](references/image-production.md). Keep the set coherent without making every image look like another main poster.

Create a numbered contact sheet and preserve individual full-resolution files.

### 7. Approval gate: complete nine-image set

Show the contact sheet plus direct access to individual images. Let the user approve the set or identify image numbers to revise. Regenerate only rejected images. On approval, record:

```bash
python3 scripts/workflow_state.py approve --project <project-path> --gate ecommerce_set --note <review-note>
```

### 8. Generate SKU images

For every SKU, use its matching source variation image. Keep the approved layout system, background family, product identity, logo size, and naming hierarchy. Preserve actual shade/effect as closely as the source allows. Generate in manageable batches, then create a numbered contact sheet.

### 9. Approval gate: SKU set

Show the source/result comparison contact sheet. Check count, identity, shade matching, English-only text, and correct SKU labels. Regenerate only rejected SKUs. On approval, record:

```bash
python3 scripts/workflow_state.py approve --project <project-path> --gate sku_set --note <review-note>
```

### 10. Publish and export automatically

After all four gates are approved:

1. Build an upload manifest containing exactly one selected main image, eight selected supporting images, and one selected image for every SKU.
2. Upload to R2 with `scripts/upload_r2_images.mjs`.
3. Verify every public URL without authentication.
4. Save the uploaded URL manifest inside `05_export/`.
5. Copy the initial BigSeller workbook to a new final output file.
6. Replace `变种图`, `产品主图*`, and `产品附属图1-8` using the verified URLs.
7. Reopen the exported workbook and run the final checklist.

Do not pause between publication and export unless credentials/configuration fail or validation finds a real error.

### 11. Deliver

Return the final `.xlsx` link first. State the image counts and that public URL/workbook validation passed. Mention warnings only when they affect import or listing accuracy.

## Handling corrections

- Treat user feedback as a scoped revision, not permission to redesign unrelated approved assets.
- Save every attempt with a monotonically increasing version.
- Record rejection reasons in the task metadata or review notes.
- If an upstream approved fact changes, mark dependent images and exports stale, explain the impact, and resume from the earliest affected gate.
- If the user says “通过”, approve only the currently presented gate.

## External blockers

Pause outside the planned gates only for:

- 1688 login/captcha/risk-control requiring the user
- missing or ambiguous source facts that would make the listing deceptive
- missing real cost when price fields cannot be finalized
- missing brand/product reference required for faithful image generation
- unavailable image generation capability
- invalid R2 credentials or non-public base URL
- an export validation error that cannot be repaired safely

Explain the exact blocker and the smallest action needed. Preserve state before stopping.
