# Workflow Contract

## Purpose

Keep a product run resumable, prevent accidental downstream work, and ensure that “通过” applies only to the current review gate.

## Canonical stages

1. `collect_source`
2. `prepare_listing`
3. `review_listing`
4. `prepare_identity_pack`
5. `generate_main_image`
6. `review_main_image`
7. `generate_ecommerce_set`
8. `review_ecommerce_set`
9. `generate_sku_set`
10. `review_sku_set`
11. `publish_r2`
12. `build_bigseller_workbook`
13. `final_qa`
14. `complete`

Allowed stage status values are `pending`, `in_progress`, `waiting_for_review`, `blocked`, `failed`, and `complete`.

## Approval gates

| Gate | Required before |
| --- | --- |
| `listing` | Identity-pack and image work |
| `main_image` | Remaining ecommerce images |
| `ecommerce_set` | SKU image production |
| `sku_set` | R2 publication and workbook export |

Never infer an approval from praise, preferences, or a request for another variation. Accept explicit language such as “通过”, “确认”, “approve”, or an unambiguous instruction to continue to the next stage.

## State rules

- Store state at `05_workflow/automation_state.json`.
- Initialize once. Reuse the same file across Codex turns.
- Write a state event after every material action, output, failure, review request, approval, and correction.
- Store artifact paths, not image bytes or credentials.
- Store the full source URL and derived offer ID.
- Preserve earlier approved files even after newer candidates are generated.
- Mark downstream results stale when their upstream facts or selected references change.

## Resume algorithm

1. Read the state file.
2. Confirm that stored artifact paths still exist.
3. Identify the earliest stage that is not complete or is stale.
4. If its gate is `waiting_for_review`, show that review rather than generating more work.
5. Otherwise continue the stage and update state.
6. Never re-upload already verified objects unless the selected file changed or the user asks.

## Review presentation

At every gate:

1. Lead with what is ready for review.
2. Show the artifact directly or link the file.
3. State only the decisions the user needs to make.
4. Ask for approval or concrete edits.
5. Do not mix approval of multiple gates in one vague question.

## Failure behavior

- Retry transient downloads/uploads with bounded retries.
- Do not retry image generation automatically after a content-quality rejection.
- Record tool/API errors without secrets.
- When resuming, avoid repeating a completed paid image-generation call.
