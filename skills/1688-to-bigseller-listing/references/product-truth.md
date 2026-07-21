# Product Truth and Listing Grounding

## Product truth record

Create `00_source/product_truth.json` before image generation. Use this shape:

```json
{
  "source_url": "",
  "offer_id": "",
  "identity": {
    "brand": "",
    "series": "",
    "product_type": "",
    "capacity_or_size": "",
    "package_quantity": ""
  },
  "visual_invariants": {
    "shape": "",
    "proportions": "",
    "materials_and_finish": "",
    "cap_or_closure": "",
    "label_text_exact": [],
    "logo_asset": "",
    "must_not_change": []
  },
  "variants": [],
  "verified_claims": [],
  "uncertain_claims": [],
  "package_contents": [],
  "usage_requirements": [],
  "source_evidence": []
}
```

## Evidence hierarchy

Prefer facts in this order:

1. Clear product packaging or close-up source photography.
2. Structured 1688 SKU/specification data.
3. Repeated claims consistent across supplier images and description.
4. User-provided corrections.

Treat promotional banners, machine translations, and ambiguous icons as low-confidence evidence. Do not turn uncertainty into a claim.

## Visual invariants

Record exact geometry in plain language. For example, distinguish:

- an elliptical cylinder viewed from above
- a rectangular front silhouette with rounded edges
- a true circular cylinder

Image prompts must reference the invariant description and the clearest source images. If an AI result changes the silhouette, label, logo, cap, or proportions, reject it even if the overall design is attractive.

## Listing copy

- Write natural English for Philippine marketplace buyers.
- Lead with product type and useful differentiators, not decorative adjectives.
- Translate benefits from verified features: capacity, effect, shade range, application method, package content, compatibility, and audience.
- Include necessary tools or curing requirements when relevant.
- State exclusions such as magnet, lamp, base coat, or accessories when not included.
- Avoid medical, safety, durability, certification, or performance claims not supported by evidence.
- Keep title, description, variants, and image claims mutually consistent.

## First approval bundle

Show:

- confirmed facts
- uncertain or estimated facts
- exact brand and series spelling
- title and description
- variants/SKUs
- category choice
- pricing calculation
- planned image story

Fold requests for missing real cost, SKU naming, or low-confidence category confirmation into this gate whenever safe.
