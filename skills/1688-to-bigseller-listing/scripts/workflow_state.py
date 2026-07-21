#!/usr/bin/env python3
"""Create and update resumable state for the 1688-to-BigSeller workflow."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


STAGES = [
    "collect_source",
    "prepare_listing",
    "review_listing",
    "prepare_identity_pack",
    "generate_main_image",
    "review_main_image",
    "generate_ecommerce_set",
    "review_ecommerce_set",
    "generate_sku_set",
    "review_sku_set",
    "publish_r2",
    "build_bigseller_workbook",
    "final_qa",
    "complete",
]
STATUSES = {"pending", "in_progress", "waiting_for_review", "blocked", "failed", "complete"}
GATES = {"listing", "main_image", "ecommerce_set", "sku_set"}
GATE_STAGE = {
    "listing": "review_listing",
    "main_image": "review_main_image",
    "ecommerce_set": "review_ecommerce_set",
    "sku_set": "review_sku_set",
}
STAGE_REQUIREMENTS = {
    "prepare_identity_pack": "listing",
    "generate_main_image": "listing",
    "generate_ecommerce_set": "main_image",
    "generate_sku_set": "ecommerce_set",
    "publish_r2": "sku_set",
    "build_bigseller_workbook": "sku_set",
    "final_qa": "sku_set",
    "complete": "sku_set",
}
PRIOR_STAGE_REQUIREMENTS = {
    "build_bigseller_workbook": "publish_r2",
    "final_qa": "build_bigseller_workbook",
    "complete": "final_qa",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def state_path(project: str) -> Path:
    return Path(project).expanduser().resolve() / "05_workflow" / "automation_state.json"


def offer_id(source_url: str) -> str:
    match = re.search(r"/offer/(\d+)\.html", source_url)
    if not match:
        raise ValueError("Source URL must contain detail.1688.com/offer/<offer-id>.html")
    if "detail.1688.com" not in source_url:
        raise ValueError("Source URL must use detail.1688.com")
    return match.group(1)


def read_state(project: str) -> tuple[Path, dict]:
    target = state_path(project)
    if not target.exists():
        raise FileNotFoundError(f"State not initialized: {target}")
    return target, json.loads(target.read_text(encoding="utf-8"))


def atomic_write(target: Path, state: dict) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    state["updated_at"] = now_iso()
    temp = target.with_suffix(".json.tmp")
    temp.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp, target)


def add_event(state: dict, event: str, **details: object) -> None:
    state.setdefault("events", []).append({"at": now_iso(), "event": event, **details})


def command_init(args: argparse.Namespace) -> None:
    target = state_path(args.project)
    source_offer_id = offer_id(args.source_url)
    if target.exists():
        current = json.loads(target.read_text(encoding="utf-8"))
        if current.get("source_url") != args.source_url:
            raise ValueError(f"Existing state belongs to a different URL: {target}")
        print(json.dumps(current, ensure_ascii=False, indent=2))
        return

    created = now_iso()
    state = {
        "schema_version": 1,
        "project_path": str(Path(args.project).expanduser().resolve()),
        "source_url": args.source_url,
        "offer_id": source_offer_id,
        "current_stage": "collect_source",
        "stages": {name: {"status": "pending", "note": "", "updated_at": created} for name in STAGES},
        "gates": {
            name: {"status": "pending", "note": "", "requested_at": None, "approved_at": None}
            for name in sorted(GATES)
        },
        "artifacts": {},
        "events": [{"at": created, "event": "initialized", "stage": "collect_source"}],
        "created_at": created,
        "updated_at": created,
    }
    atomic_write(target, state)
    print(json.dumps(state, ensure_ascii=False, indent=2))


def command_show(args: argparse.Namespace) -> None:
    _, state = read_state(args.project)
    print(json.dumps(state, ensure_ascii=False, indent=2))


def ensure_gate_requirement(state: dict, stage: str) -> None:
    required = STAGE_REQUIREMENTS.get(stage)
    if required and state["gates"][required]["status"] != "approved":
        raise ValueError(f"Stage {stage} requires approved gate: {required}")
    prior_stage = PRIOR_STAGE_REQUIREMENTS.get(stage)
    if prior_stage and state["stages"][prior_stage]["status"] != "complete":
        raise ValueError(f"Stage {stage} requires completed stage: {prior_stage}")


def command_stage(args: argparse.Namespace) -> None:
    if args.stage not in STAGES:
        raise ValueError(f"Unknown stage: {args.stage}")
    if args.status not in STATUSES:
        raise ValueError(f"Unknown status: {args.status}")
    target, state = read_state(args.project)
    if args.status in {"in_progress", "complete"}:
        ensure_gate_requirement(state, args.stage)
    stamp = now_iso()
    state["current_stage"] = args.stage
    state["stages"][args.stage] = {"status": args.status, "note": args.note or "", "updated_at": stamp}
    add_event(state, "stage_updated", stage=args.stage, status=args.status, note=args.note or "")
    atomic_write(target, state)
    print(f"UPDATED stage={args.stage} status={args.status}")


def command_review(args: argparse.Namespace) -> None:
    if args.gate not in GATES:
        raise ValueError(f"Unknown gate: {args.gate}")
    target, state = read_state(args.project)
    stamp = now_iso()
    stage = GATE_STAGE[args.gate]
    state["current_stage"] = stage
    state["stages"][stage] = {"status": "waiting_for_review", "note": args.note or "", "updated_at": stamp}
    state["gates"][args.gate].update({"status": "waiting_for_review", "note": args.note or "", "requested_at": stamp})
    add_event(state, "review_requested", gate=args.gate, note=args.note or "")
    atomic_write(target, state)
    print(f"WAITING gate={args.gate}")


def command_approve(args: argparse.Namespace) -> None:
    if args.gate not in GATES:
        raise ValueError(f"Unknown gate: {args.gate}")
    target, state = read_state(args.project)
    current_status = state["gates"][args.gate]["status"]
    if current_status == "approved":
        print(f"ALREADY_APPROVED gate={args.gate}")
        return
    if current_status != "waiting_for_review":
        raise ValueError(f"Gate {args.gate} must be waiting_for_review before approval")
    stamp = now_iso()
    stage = GATE_STAGE[args.gate]
    state["gates"][args.gate].update({"status": "approved", "note": args.note or "", "approved_at": stamp})
    state["stages"][stage] = {"status": "complete", "note": args.note or "", "updated_at": stamp}
    state["current_stage"] = stage
    add_event(state, "gate_approved", gate=args.gate, note=args.note or "")
    atomic_write(target, state)
    print(f"APPROVED gate={args.gate}")


def command_artifact(args: argparse.Namespace) -> None:
    target, state = read_state(args.project)
    artifact_path = str(Path(args.path).expanduser().resolve())
    state.setdefault("artifacts", {})[args.name] = {
        "path": artifact_path,
        "kind": args.kind,
        "selected": bool(args.selected),
        "updated_at": now_iso(),
    }
    add_event(state, "artifact_recorded", name=args.name, path=artifact_path, selected=bool(args.selected))
    atomic_write(target, state)
    print(f"RECORDED artifact={args.name}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    init = subparsers.add_parser("init", help="Initialize state, or show existing matching state")
    init.add_argument("--project", required=True)
    init.add_argument("--source-url", required=True)
    init.set_defaults(func=command_init)

    show = subparsers.add_parser("show", help="Print current state")
    show.add_argument("--project", required=True)
    show.set_defaults(func=command_show)

    stage = subparsers.add_parser("stage", help="Update a stage")
    stage.add_argument("--project", required=True)
    stage.add_argument("--stage", required=True)
    stage.add_argument("--status", required=True)
    stage.add_argument("--note", default="")
    stage.set_defaults(func=command_stage)

    review = subparsers.add_parser("review", help="Mark a gate waiting for review")
    review.add_argument("--project", required=True)
    review.add_argument("--gate", required=True)
    review.add_argument("--note", default="")
    review.set_defaults(func=command_review)

    approve = subparsers.add_parser("approve", help="Approve one explicit gate")
    approve.add_argument("--project", required=True)
    approve.add_argument("--gate", required=True)
    approve.add_argument("--note", default="")
    approve.set_defaults(func=command_approve)

    artifact = subparsers.add_parser("artifact", help="Record a generated or selected artifact")
    artifact.add_argument("--project", required=True)
    artifact.add_argument("--name", required=True)
    artifact.add_argument("--path", required=True)
    artifact.add_argument("--kind", default="file")
    artifact.add_argument("--selected", action="store_true")
    artifact.set_defaults(func=command_artifact)

    return parser


def main() -> int:
    try:
        args = build_parser().parse_args()
        args.func(args)
        return 0
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
