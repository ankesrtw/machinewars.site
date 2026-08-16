#!/usr/bin/env python3
"""
transplant-walk.py — copy a working walk-cycle action from a donor robot
(grunt, whose Tripo walk retarget came out clean) onto a recipient robot
whose own walk retarget was broken (heavy: legs collapsed), since both
share the identical 41-bone Tripo biped rig (verified: same names, same
order). This is a local fix — no Tripo API calls, no credits spent.

Usage:
    blender --background --python tools/transplant-walk.py -- <recipient_robot>

Reads:
    tools/tripo-out/grunt/walk/*_model.glb          (donor animation)
    tools/tripo-out/<recipient>/rigged/*_model.glb  (recipient mesh+rig)
Writes:
    tools/tripo-out/<recipient>/walk_transplanted/<recipient>_walk.glb
"""
import sys
import glob
import json
import os
import struct
import bpy

DONOR_WALK_GLOB = "tools/tripo-out/grunt/walk/*_model.glb"

# The loader picks the walk clip by this exact name (src/enemies.js), so the
# export must carry it verbatim — no Blender ".001" uniquifying suffix.
WALK_ACTION = "preset:walk"


def find_one(pattern):
    matches = glob.glob(pattern)
    if not matches:
        raise FileNotFoundError(f"No match for {pattern}")
    return matches[0]


def _glb_animation_names(path):
    """Animation names in an exported GLB, read straight from its JSON chunk."""
    with open(path, "rb") as f:
        data = f.read()
    magic, _version, length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67:
        raise ValueError(f"{path}: not a GLB")
    off = 12
    while off < length:
        clen, ctype = struct.unpack_from("<II", data, off)
        if ctype == 0x4E4F534A:  # JSON
            gltf = json.loads(data[off + 8: off + 8 + clen].decode("utf-8"))
            return [a.get("name") for a in gltf.get("animations", [])]
        off += 8 + clen + (-clen % 4)
    raise ValueError(f"{path}: no JSON chunk")


def main():
    argv = sys.argv
    args = argv[argv.index("--") + 1:] if "--" in argv else []
    if not args:
        print("Usage: blender --background --python transplant-walk.py -- <recipient>")
        sys.exit(1)
    recipient = args[0]

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    donor_path = find_one(os.path.join(root, DONOR_WALK_GLOB))
    recipient_path = find_one(os.path.join(root, "tools", "tripo-out", recipient, "rigged", "*_model.glb"))
    out_dir = os.path.join(root, "tools", "tripo-out", recipient, "walk_transplanted")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{recipient}_walk.glb")

    # Import both into the same scene so the donor action data-block survives.
    bpy.ops.wm.read_factory_settings(use_empty=True)

    bpy.ops.import_scene.gltf(filepath=donor_path)
    donor_objs = set(bpy.context.selected_objects)
    donor_arm = next(o for o in donor_objs if o.type == "ARMATURE")
    donor_action = donor_arm.animation_data.action
    donor_layer = donor_action.layers[0]
    donor_strip = donor_layer.strips[0]
    donor_channelbag = donor_strip.channelbag(donor_arm.animation_data.action_slot)
    frame_start, frame_end = donor_action.frame_range

    bpy.ops.import_scene.gltf(filepath=recipient_path)
    recipient_objs = set(bpy.context.selected_objects)
    recipient_arm = next(o for o in recipient_objs if o.type == "ARMATURE")
    ico = bpy.data.objects.get("Icosphere")
    if ico and ico not in donor_objs:
        bpy.data.objects.remove(ico, do_unlink=True)

    # Idempotency: strip any walk action the *recipient* already carries before
    # authoring a new one, so re-running on an already-transplanted recipient
    # replaces its clip instead of adding a second one. Scoped to recipient-
    # owned actions on purpose — the donor's action is also called
    # "preset:walk", and deleting it here would leave nothing to copy from.
    for obj in recipient_objs:
        ad = getattr(obj, "animation_data", None)
        if ad is None or ad.action is None:
            continue
        name = ad.action.name
        if name == WALK_ACTION or name.startswith(WALK_ACTION + "."):
            stale = ad.action
            ad.action = None
            bpy.data.actions.remove(stale)

    # Build a brand-new action native to the recipient armature and copy each
    # donor fcurve's keyframes into it bone-by-bone. This avoids the layered
    # Action/ActionSlot system's export quirks around cross-object reuse.
    if recipient_arm.animation_data is None:
        recipient_arm.animation_data_create()
    new_action = bpy.data.actions.new(name=WALK_ACTION)
    recipient_arm.animation_data.action = new_action
    if recipient_arm.animation_data.action_slot is None:
        recipient_arm.animation_data.action_slot = new_action.slots.new(id_type='OBJECT', name=recipient_arm.name)
    new_layer = new_action.layers.new(name="layer0")
    new_strip = new_layer.strips.new(type='KEYFRAME')
    new_channelbag = new_strip.channelbag(recipient_arm.animation_data.action_slot, ensure=True)

    for fcurve in donor_channelbag.fcurves:
        new_fc = new_channelbag.fcurves.new(fcurve.data_path, index=fcurve.array_index)
        new_fc.keyframe_points.add(len(fcurve.keyframe_points))
        for i, kp in enumerate(fcurve.keyframe_points):
            new_fc.keyframe_points[i].co = kp.co
            new_fc.keyframe_points[i].interpolation = kp.interpolation
        new_fc.update()

    if not new_channelbag.fcurves:
        raise RuntimeError("transplant produced zero fcurves — donor action was lost before the copy")

    # Remove donor objects entirely; the recipient now owns an independent action.
    for obj in donor_objs:
        bpy.data.objects.remove(obj, do_unlink=True)

    # ...but removing the donor OBJECTS does not remove the donor ACTION: it
    # survives as a zero-user orphan data-block, and the glTF exporter still
    # writes out unassigned actions. That is what actually shipped the second
    # clip in heavy.glb — Blender uniquified it to "preset:walk.001" because
    # the recipient's new action already claimed the base name. A single run
    # was always enough to cause it; it never needed running twice.
    keep = {new_action}
    for action in list(bpy.data.actions):
        if action not in keep and action.users == 0:
            bpy.data.actions.remove(action)

    # The donor's action still held the base name when new_action was created,
    # so Blender uniquified ours to "preset:walk.001". Now that the orphan is
    # gone the name is free — claim it, because the loader selects the clip by
    # exact name (src/enemies.js) and a ".001" would not match.
    new_action.name = WALK_ACTION
    if new_action.name != WALK_ACTION:
        raise RuntimeError(f"could not claim action name {WALK_ACTION!r}, got {new_action.name!r}")

    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        export_animations=True,
        export_frame_range=True,
        export_force_sampling=True,
    )

    # Fail loudly rather than shipping a broken rig: the whole point of the
    # idempotency work above is that the recipient carries exactly one clip.
    names = _glb_animation_names(out_path)
    if names != [WALK_ACTION]:
        raise RuntimeError(f"{out_path}: expected exactly [{WALK_ACTION!r}], found {names!r}")
    print(f"[{recipient}] wrote {out_path} (1 animation: {WALK_ACTION})")


if __name__ == "__main__":
    main()
