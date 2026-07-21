# Image Production System

## Core production method

Separate the image into two layers whenever accuracy matters:

1. Generate or edit the photographic product scene.
2. Apply the exact logo, headings, selling-point copy, and SKU labels deterministically when possible.

This prevents misspelled branding and inconsistent typography. Do not use generative reconstruction for an exact logo when the original asset is available.

## Main image

The main image must earn the click at mobile thumbnail size.

- Make the product the hero with believable studio light, material response, contact shadows, and lens perspective.
- Use a premium but inviting color temperature; avoid muddy, gloomy, over-brown, or synthetic-looking backgrounds.
- Keep the composition poster-like but restrained.
- Show the brand logo at the approved top position and size, without a cheap-looking frame.
- Give the series name clear hierarchy. Use smaller supporting copy.
- Use a small number of high-value facts such as shade count, capacity, product technology, or required system.
- If a result/sample display could reveal inaccuracies, keep it secondary or softly out of focus.
- Never alter visible text printed on the physical product.

Generate one candidate first when the visual rules are mature. Generate two candidates when the product has no approved style or identity reference.

## Nine-image narrative

Adapt the following roles to the actual category; do not copy nail-specific claims to unrelated products.

| Number | Role | Purpose |
| --- | --- | --- |
| 1 | Main image | Click attraction, product identity, series, concise differentiators |
| 2 | Selling points | Explain the strongest benefits with clear callouts or diagrams |
| 3 | Selection | Show shade, size, model, or variant breadth and how to choose |
| 4 | Result/effect | Demonstrate the most desirable real-world outcome |
| 5 | Quality/detail | Show texture, materials, finish, construction, or formulation evidence |
| 6 | How to use | Explain the essential steps and required accessories |
| 7 | Lifestyle/aspiration | Connect the product to the target buyer and use occasion |
| 8 | Premium/value | Reinforce perceived quality, completeness, or professional suitability |
| 9 | Trust/reminders | Package contents, shipping facts, limitations, and purchase reassurance |

Images 2–9 are not eight alternate main images. They may use smaller products, diagrams, close-ups, comparisons, numbered steps, and annotated callouts. Text must remain readable on a phone.

## Typography and copy hierarchy

- Use one display family and one supporting family at most.
- Make the series/product idea the strongest text element.
- Use concise descriptors at a smaller size.
- Use sentence case or controlled uppercase consistently.
- Keep essential claims large enough for mobile thumbnails.
- Avoid excessive tiny text, decorative badges, dense icon rows, and repeated brand names.
- Balance whitespace with useful information; “minimal” must not mean empty.

## SKU image system

- Use the exact matching SKU source image for every generation/edit.
- Preserve the real shade, pattern, reflectivity, and effect. Do not beautify into a different variant.
- Use the approved SKU layout and the best approved SKU image as the visual anchor.
- Keep background hue and lighting consistent across the set.
- Include the exact supplied logo and a believable product bottle or pack.
- Use English-only visible text unless explicitly approved otherwise.
- Make the variant identifier unambiguous.
- Prefer a regenerated coherent composition over visibly patched rectangles or poorly cut source backgrounds.
- When product reconstruction changes real geometry, reuse the approved product cutout or source product instead.

## Review artifacts

- Save every output as a versioned file.
- Create one contact sheet for images 1–9.
- Create source/result contact sheets for SKU batches.
- Do not downsample the approved individual deliverables when making contact sheets.
- Record selected and rejected versions in review metadata.

## Prompt construction

Each prompt must include:

1. task role and target buyer
2. exact dimensions
3. source/reference roles
4. immutable product facts
5. composition and hierarchy
6. lighting, palette, and photographic realism
7. exact visible text or instruction to leave text space for deterministic compositing
8. negative constraints
9. output acceptance criteria

Avoid vague instructions such as “make it premium” without describing light, material, hierarchy, spacing, and what must remain unchanged.
