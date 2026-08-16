#!/usr/bin/env python3
"""
tripo-rig.py — auto-rig + animate the robot GLBs via the Tripo3D API.

Pipeline per robot: import_model (free) -> rig_model (~25 credits) ->
retarget_animation per clip (~10 credits/clip) -> download.

Reads TRIPO3D_API_TOKEN from .env (same style as tools/gen-art.mjs).

Usage:
    python tools/tripo-rig.py --list                       # show plan, no API calls
    python tools/tripo-rig.py --only=grunt                 # single robot
    python tools/tripo-rig.py                               # all robots, all clips
    python tools/tripo-rig.py --clips=walk,shoot,idle       # override clip set
"""
import argparse
import asyncio
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env"
MODELS_DIR = ROOT / "assets" / "models"
OUT_DIR = ROOT / "tools" / "tripo-out"

ROBOTS = ["scout", "grunt", "heavy"]
DEFAULT_CLIPS = ["idle", "walk", "shoot"]


def load_env():
    if not ENV_FILE.exists():
        return {}
    out = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        out[k.strip()] = v.strip().strip("'\"")
    return out


async def process_robot(client, name, clips, out_dir, resume_rig_task_id=None):
    from tripo3d.models import Animation, RigType, RigSpec

    src = MODELS_DIR / f"{name}.glb"
    if not src.exists():
        print(f"[{name}] SKIP — {src} not found")
        return

    if resume_rig_task_id:
        rig_task_id = resume_rig_task_id
        rig_task = await client.wait_for_task(rig_task_id, verbose=False)
        print(f"[{name}] resuming from rig task {rig_task_id}: {rig_task.status}")
    else:
        print(f"[{name}] importing {src.name} ...")
        import_task_id = await client.import_model(str(src))
        import_task = await client.wait_for_task(import_task_id, verbose=False)
        print(f"[{name}] import done: {import_task.status}")

        print(f"[{name}] rigging (biped) ...")
        rig_task_id = await client.rig_model(
            original_model_task_id=import_task_id,
            rig_type=RigType.BIPED,
            spec=RigSpec.TRIPO,
            out_format="glb",
        )
        rig_task = await client.wait_for_task(rig_task_id, verbose=False)
        print(f"[{name}] rig done: {rig_task.status} (rig_task_id={rig_task_id})")
    if str(rig_task.status).lower() not in ("success", "taskstatus.success"):
        print(f"[{name}] rig FAILED, skipping animation/download: {rig_task}")
        return

    robot_out = out_dir / name
    rigged_dir = robot_out / "rigged"
    rigged_dir.mkdir(parents=True, exist_ok=True)
    rigged_files = await client.download_task_models(rig_task, str(rigged_dir))
    print(f"[{name}] rigged model saved: {rigged_files}")

    for clip in clips:
        anim_enum = getattr(Animation, clip.upper(), None)
        if anim_enum is None:
            print(f"[{name}] unknown animation '{clip}', skipping")
            continue
        print(f"[{name}] retargeting '{clip}' ...")
        anim_task_id = await client.retarget_animation(
            original_model_task_id=rig_task_id,
            animation=anim_enum,
            out_format="glb",
            bake_animation=True,
        )
        anim_task = await client.wait_for_task(anim_task_id, verbose=False)
        print(f"[{name}] '{clip}' done: {anim_task.status}")
        if str(anim_task.status).lower() not in ("success", "taskstatus.success"):
            print(f"[{name}] '{clip}' FAILED: {anim_task}")
            continue
        clip_dir = robot_out / clip
        clip_dir.mkdir(parents=True, exist_ok=True)
        files = await client.download_task_models(anim_task, str(clip_dir))
        print(f"[{name}] '{clip}' saved: {files}")


async def main_async(args):
    from tripo3d import TripoClient

    env = load_env()
    api_key = env.get("TRIPO3D_API_TOKEN") or os.environ.get("TRIPO3D_API_TOKEN")
    if not api_key:
        print("ERROR: TRIPO3D_API_TOKEN not found in .env or environment", file=sys.stderr)
        sys.exit(1)

    robots = [args.only] if args.only else ROBOTS
    clips = [c.strip() for c in args.clips.split(",")] if args.clips else DEFAULT_CLIPS

    if args.list:
        print("Plan:")
        for r in robots:
            print(f"  {r}.glb -> import -> rig(biped) -> clips: {clips}")
        print(f"Output dir: {OUT_DIR}")
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    async with TripoClient(api_key=api_key) as client:
        balance = await client.get_balance()
        print(f"Tripo balance: {balance}")
        for r in robots:
            await process_robot(client, r, clips, OUT_DIR, resume_rig_task_id=args.resume_rig_task)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--only", help="single robot name (scout|grunt|heavy)")
    p.add_argument("--clips", help="comma-separated animation clips (default: idle,walk,shoot)")
    p.add_argument("--list", action="store_true", help="print plan only, no API calls")
    p.add_argument("--resume-rig-task", help="skip import+rig, reuse an existing rig task_id (requires --only)")
    args = p.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
