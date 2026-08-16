#!/usr/bin/env python3
"""
tripo-pose-blend.py — combine a Tripo walk-cycle animation with a fixed,
directly-authored "gun forward" arm pose, per robot.

Legs/spine/head keep playing the walk cycle; the arm chain (Upperarm +
Forearm, both sides) is rotated to a fixed forward-held stance and locked
there for the whole walk cycle. The pose is built with to_track_quat aim
rotations (not lifted from any preset animation) — verified by render
against tools/tripo-out/pose_aim_v1*.png during development.

Run inside Blender:
    blender --background --python tools/tripo-pose-blend.py -- <robot>

Reads/writes under tools/tripo-out/<robot>/:
    walk/<hash>_model.glb   (input, leg motion source)
    combined/<robot>_combat.glb  (output)
"""
import sys
import glob
import json
import os
import math
import struct
import bpy
import mathutils as mu

ARM_BONE_PREFIXES = (
    "L_Clavicle", "L_Upperarm", "L_UpperarmTwist01", "L_UpperarmTwist02",
    "L_Forearm", "L_ForearmTwist01", "L_ForearmTwist02", "L_Hand",
    "R_Clavicle", "R_Upperarm", "R_UpperarmTwist01", "R_UpperarmTwist02",
    "R_Forearm", "R_ForearmTwist01", "R_ForearmTwist02", "R_Hand",
)

# Upperarm points down-and-slightly-forward from the shoulder, forearm points
# straight forward from the elbow — both arms symmetric, converging in front
# of the chest as if gripping a two-handed weapon. World-space directions,
# local +Y = bone's own long axis.
UPPERARM_DIR = mu.Vector((0, -0.85, -0.3)).normalized()
FOREARM_DIR = mu.Vector((0, -1, 0))


def find_glb(root, subdir):
    matches = glob.glob(os.path.join(root, subdir, "*_model.glb"))
    if not matches:
        # transplant-walk.py writes "<robot>_walk.glb", not "*_model.glb".
        matches = glob.glob(os.path.join(root, subdir, "*.glb"))
    if not matches:
        raise FileNotFoundError(f"No .glb under {root}/{subdir}")
    return matches[0]


def glb_animation_names(path):
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


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    bpy.ops.import_scene.gltf(filepath=path)
    arm = next(o for o in bpy.context.selected_objects if o.type == "ARMATURE")
    # The glTF importer both assigns the action AND stashes a copy in an NLA
    # track, so importing a 1-clip GLB leaves 2 action data-blocks. The
    # exporter writes NLA-stashed actions too, which is how heavy.glb ended up
    # shipping "preset:walk" plus a "preset:walk.001" duplicate driving the
    # same arm bones to a conflicting pose. Keep only the assigned action.
    ad = arm.animation_data
    if ad is not None:
        for track in list(ad.nla_tracks):
            ad.nla_tracks.remove(track)
    return arm


def purge_orphan_actions(keep):
    """Drop every action but `keep`, so the exporter cannot emit a duplicate."""
    for action in list(bpy.data.actions):
        if action is not keep:
            action.use_fake_user = False
            if action.users == 0:
                bpy.data.actions.remove(action)


def get_action(arm):
    return arm.animation_data.action


def get_channelbag(arm):
    action = arm.animation_data.action
    layer = action.layers[0]
    strip = layer.strips[0]
    return strip.channelbag(arm.animation_data.action_slot)


def set_bone_world_direction(arm, pbone_name, target_world_dir):
    """Rotate a pose bone so its local +Y axis points along target_world_dir
    (world space), via to_track_quat aim rotation. Must be called in POSE mode
    with the armature's pose otherwise at rest for the bones above pbone_name
    in the chain (i.e. call in parent-to-child order)."""
    pbone = arm.pose.bones[pbone_name]
    parent_world_quat = (
        (arm.matrix_world @ pbone.parent.matrix).to_quaternion()
        if pbone.parent else arm.matrix_world.to_quaternion()
    )
    bone_rest_local_quat = pbone.bone.matrix_local.to_quaternion()
    if pbone.bone.parent:
        parent_rest_local_quat = pbone.bone.parent.matrix_local.to_quaternion()
        bone_rest_relative_quat = parent_rest_local_quat.inverted() @ bone_rest_local_quat
    else:
        bone_rest_relative_quat = bone_rest_local_quat

    desired_world_quat = target_world_dir.to_track_quat('Y', 'Z')
    pbone.rotation_mode = 'QUATERNION'
    pose_quat = bone_rest_relative_quat.inverted() @ parent_world_quat.inverted() @ desired_world_quat
    pbone.rotation_quaternion = pose_quat


def apply_gun_forward_pose(arm):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    for side in ("L", "R"):
        set_bone_world_direction(arm, f"{side}_Upperarm", UPPERARM_DIR)
        bpy.context.view_layer.update()
        set_bone_world_direction(arm, f"{side}_Forearm", FOREARM_DIR)
        bpy.context.view_layer.update()
    return {
        pbone.name: (pbone.location.copy(), pbone.rotation_quaternion.copy(), pbone.scale.copy())
        for pbone in arm.pose.bones
        if pbone.name in (f"L_Upperarm", "L_Forearm", "R_Upperarm", "R_Forearm")
    }


def main():
    argv = sys.argv
    args = argv[argv.index("--") + 1:] if "--" in argv else []
    if not args:
        print("Usage: blender --background --python tripo-pose-blend.py -- <robot> [walk_subdir]")
        sys.exit(1)
    robot = args[0]
    walk_subdir = args[1] if len(args) > 1 else "walk"

    root = os.path.join(os.path.dirname(__file__), "tripo-out", robot)
    walk_path = find_glb(root, walk_subdir)
    out_dir = os.path.join(root, "combined")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{robot}_combat.glb")

    # Import walk clip; pose the arm chain to the authored gun-forward stance,
    # then lock that pose across the whole walk cycle so legs keep animating
    # but arms stay static and forward.
    reset_scene()
    walk_arm = import_glb(walk_path)
    walk_action = get_action(walk_arm)
    w_start, w_end = walk_action.frame_range

    posed = apply_gun_forward_pose(walk_arm)

    for name, (loc, rot, scale) in posed.items():
        pbone = walk_arm.pose.bones.get(name)
        if pbone is None:
            continue
        pbone.rotation_mode = "QUATERNION"
        # Single held pose: keyframe identical values at start and end, then
        # strip any interior keys below so nothing interpolates away from it.
        for frame in (int(w_start), int(w_end)):
            bpy.context.scene.frame_set(frame)
            pbone.location = loc
            pbone.rotation_quaternion = rot
            pbone.scale = scale
            pbone.keyframe_insert(data_path="location", frame=frame)
            pbone.keyframe_insert(data_path="rotation_quaternion", frame=frame)
            pbone.keyframe_insert(data_path="scale", frame=frame)

    # Remove any interior keyframes on the arm bones' fcurves so the held pose
    # doesn't get overridden by the original walk-cycle arm swing.
    channelbag = get_channelbag(walk_arm)
    for fcurve in list(channelbag.fcurves):
        dp = fcurve.data_path
        if not dp.startswith('pose.bones["'):
            continue
        bone_name = dp.split('"')[1]
        if bone_name not in ARM_BONE_PREFIXES:
            continue
        keyframe_points = fcurve.keyframe_points
        to_remove = [i for i, kp in enumerate(keyframe_points) if kp.co.x not in (w_start, w_end)]
        for i in reversed(to_remove):
            keyframe_points.remove(keyframe_points[i], fast=True)
        fcurve.update()

    bpy.ops.object.mode_set(mode="OBJECT")

    purge_orphan_actions(walk_action)

    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        export_animations=True,
        export_frame_range=True,
        export_force_sampling=True,
    )

    # The gun-forward pose is only meaningful if exactly one clip drives the
    # arms; a second clip would fight it frame-to-frame. Fail rather than ship.
    names = glb_animation_names(out_path)
    if len(names) != 1:
        raise RuntimeError(f"{out_path}: expected exactly 1 animation, found {len(names)}: {names!r}")
    print(f"[{robot}] wrote {out_path} (1 animation: {names[0]})")


if __name__ == "__main__":
    main()
