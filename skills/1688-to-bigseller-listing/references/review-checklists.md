# Review Checklists

## Listing gate

- Source URL and offer ID are correct.
- Brand, series, product type, capacity/size, package quantity, and included items are grounded.
- Uncertain facts and estimates are visible.
- Title and description are English, readable, and appropriate for Philippine buyers.
- Core selling points are meaningful rather than generic.
- Category selection and confidence are shown.
- Parent SKU, variants, and per-variant SKUs are coherent.
- Real cost and pricing math are confirmed.
- The nine-image plan tells a complete purchase story.

## Main-image gate

- Product silhouette and proportions match the source.
- Printed product text and supplied logo are unchanged and correctly spelled.
- Product looks like believable studio photography, not plastic CGI.
- Background temperature and palette support premium positioning.
- Series name has clear hierarchy; descriptors are subordinate.
- Claims are factual and readable at mobile thumbnail size.
- Decorative content does not crowd the product.
- Any result/sample imagery is accurate or sufficiently secondary to avoid misrepresentation.

## Nine-image gate

- Exactly nine numbered images exist.
- Image 1 is the approved main image.
- Images 2–9 each have a distinct informative role.
- Important claims are legible and not repeated excessively.
- Product identity, logo placement, palette, and lighting feel coherent.
- Usage steps, required accessories, and package limitations are accurate.
- No unexpected Chinese text or corrupted typography appears.
- Individual full-resolution files match the contact sheet.

## SKU gate

- Output count equals source SKU count.
- Every SKU identifier appears exactly once.
- Each result is paired with the correct source variation.
- Shade, effect, texture, or pattern is faithful to the source.
- Product geometry and logo match the approved identity.
- Layout and background are consistent across the set.
- No Chinese text, supplier contact information, or unapproved claims appear.
- No obvious masking rectangles, dirty cutout edges, malformed hands, or implausible product forms appear.

## Final delivery

- Only approved images are in the upload manifest.
- R2 upload count equals `9 + SKU count`.
- Every public URL passes unauthenticated verification.
- Workbook SKU count matches the approved SKU set.
- Every row contains the correct variation URL and the shared 1+8 product-image URLs.
- Required BigSeller fields remain populated.
- Original workbook sheets, headers, styles, and non-image data are preserved.
- Exported workbook reopens without errors.
- Final `.xlsx`, uploaded URL manifest, and validation report exist in `05_export/`.
