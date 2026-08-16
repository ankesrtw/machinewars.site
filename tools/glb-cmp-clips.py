#!/usr/bin/env python3
"""Compare heavy.glb's two animation clips channel-by-channel, and clip 0
against grunt's clip, by decoding the sampler accessor data. Stdlib only."""
import json
import struct
import sys
from array import array

COMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
TC = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}


def load(path):
    with open(path, 'rb') as f:
        data = f.read()
    _, _, length = struct.unpack_from('<III', data, 0)
    off, js, bins = 12, None, None
    while off < length:
        clen, ctype = struct.unpack_from('<II', data, off)
        off += 8
        if ctype == 0x4E4F534A:
            js = json.loads(data[off:off + clen].decode('utf-8'))
        elif ctype == 0x004E4942:
            bins = data[off:off + clen]
        off += clen
    return js, bins


def accessor(g, b, i):
    a = g['accessors'][i]
    bv = g['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    ncomp = COMP[a['type']]
    n = a['count'] * ncomp
    tc = TC[a['componentType']]
    arr = array(tc)
    arr.frombytes(b[off:off + n * arr.itemsize])
    if sys.byteorder == 'big':
        arr.byteswap()
    return [tuple(arr[i * ncomp:(i + 1) * ncomp]) for i in range(a['count'])]


def chans(g, b, ai):
    out = {}
    for ch in g['animations'][ai]['channels']:
        s = g['animations'][ai]['samplers'][ch['sampler']]
        t = ch['target']
        name = g['nodes'][t['node']].get('name', str(t['node']))
        out[(name, t['path'])] = (accessor(g, b, s['input']),
                                  accessor(g, b, s['output']))
    return out


def maxdiff(v0, v1):
    m = 0.0
    for r0, r1 in zip(v0, v1):
        for x, y in zip(r0, r1):
            d = abs(x - y)
            if d > m:
                m = d
    return m


hg, hb = load(sys.argv[1])
gg, gb = load(sys.argv[2])
h0, h1 = chans(hg, hb, 0), chans(hg, hb, 1)
g0 = chans(gg, gb, 0)

print('heavy clip0 channels:', len(h0), ' clip1 channels:', len(h1))
print('identical channel key sets:', set(h0) == set(h1))

diffs = []
for k in sorted(set(h0) & set(h1)):
    (_, v0), (_, v1) = h0[k], h1[k]
    if len(v0) != len(v1):
        diffs.append((k, f'len {len(v0)} vs {len(v1)}'))
    else:
        d = maxdiff(v0, v1)
        if d > 1e-6:
            diffs.append((k, f'maxdelta {d:.6f}'))
print('\n[A] heavy clip0 vs heavy clip1 -> differing channels:', len(diffs))
for k, d in diffs[:25]:
    print('    ', k, d)

print('\n[B] heavy clip0 vs grunt clip0')
same = set(h0) & set(g0)
dd = []
for k in sorted(same):
    (_, v0), (_, v1) = h0[k], g0[k]
    if len(v0) != len(v1):
        dd.append((k, f'len {len(v0)} vs {len(v1)}'))
    else:
        d = maxdiff(v0, v1)
        if d > 1e-6:
            dd.append((k, f'maxdelta {d:.6f}'))
print('    shared channels:', len(same), ' differing:', len(dd))
for k, d in dd[:25]:
    print('    ', k, d)

for label, c in (('heavy clip0', h0), ('heavy clip1', h1), ('grunt clip0', g0)):
    lo = min(t[0][0] for (t, _) in c.values())
    hi = max(t[-1][0] for (t, _) in c.values())
    nk = max(len(t) for (t, _) in c.values())
    print(f'{label}: t {lo:.4f}..{hi:.4f}  maxkeys={nk}')
