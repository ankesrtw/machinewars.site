#!/usr/bin/env python3
"""Dump GLB structure (nodes, skins/bones, meshes, animation targets) by
parsing the glTF JSON chunk directly. No Blender, no deps."""
import json
import struct
import sys
from collections import defaultdict


def load_gltf_json(path):
    with open(path, 'rb') as f:
        data = f.read()
    magic, version, length = struct.unpack_from('<III', data, 0)
    assert magic == 0x46546C67, f'not a GLB: {path}'
    off = 12
    while off < length:
        clen, ctype = struct.unpack_from('<II', data, off)
        off += 8
        if ctype == 0x4E4F534A:  # JSON
            return json.loads(data[off:off + clen].decode('utf-8'))
        off += clen
    raise ValueError('no JSON chunk')


def summarize(path):
    g = load_gltf_json(path)
    nodes = g.get('nodes', [])
    meshes = g.get('meshes', [])
    skins = g.get('skins', [])
    anims = g.get('animations', [])

    # node -> parent, to reconstruct hierarchy
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            parent[c] = i

    def path_of(i):
        chain, seen = [], set()
        while i is not None and i not in seen:
            seen.add(i)
            chain.append(nodes[i].get('name', f'<{i}>'))
            i = parent.get(i)
        return '/'.join(reversed(chain))

    info = {
        'file': path,
        'counts': {
            'nodes': len(nodes), 'meshes': len(meshes),
            'skins': len(skins), 'animations': len(anims),
            'materials': len(g.get('materials', [])),
        },
        'mesh_nodes': [],
        'skins': [],
        'animations': [],
        'all_nodes': [],
    }

    for i, n in enumerate(nodes):
        info['all_nodes'].append({
            'idx': i, 'name': n.get('name', f'<{i}>'),
            'mesh': n.get('mesh'), 'skin': n.get('skin'),
            'children': n.get('children', []),
            'path': path_of(i),
        })
        if 'mesh' in n:
            m = meshes[n['mesh']]
            prims = m.get('primitives', [])
            info['mesh_nodes'].append({
                'node_idx': i, 'node_name': n.get('name', f'<{i}>'),
                'mesh_idx': n['mesh'], 'mesh_name': m.get('name', ''),
                'skin': n.get('skin'), 'primitives': len(prims),
                'has_joints': any('JOINTS_0' in p.get('attributes', {}) for p in prims),
                'materials': [p.get('material') for p in prims],
                'path': path_of(i),
            })

    for si, s in enumerate(skins):
        joints = s.get('joints', [])
        info['skins'].append({
            'idx': si, 'name': s.get('name', ''),
            'joint_count': len(joints),
            'joints': [{'idx': j, 'name': nodes[j].get('name', f'<{j}>')} for j in joints],
            'skeleton_root': s.get('skeleton'),
        })

    for ai, a in enumerate(anims):
        targets = defaultdict(set)
        for ch in a.get('channels', []):
            t = ch.get('target', {})
            ni = t.get('node')
            if ni is None:
                continue
            targets[nodes[ni].get('name', f'<{ni}>')].add(t.get('path'))
        info['animations'].append({
            'idx': ai, 'name': a.get('name', ''),
            'channels': len(a.get('channels', [])),
            'targeted_nodes': {k: sorted(v) for k, v in sorted(targets.items())},
        })

    return info


if __name__ == '__main__':
    out = [summarize(p) for p in sys.argv[1:]]
    print(json.dumps(out, indent=2))
