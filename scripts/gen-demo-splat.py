#!/usr/bin/env python3
"""Generate a procedural 3DGS .ply splat — the Cortex "core orb".

Two interleaved fibonacci-sphere shells (cyan-mage outer haze + hot inner
core) written as a binary_little_endian INRIA 3DGS PLY. Drop the output at
public/splats/<name>.ply and it renders through @sparkjsdev/spark with zero
training. Swap in real captures later (Postshot/nerfstudio/gsplat output).

Usage: python3 scripts/gen-demo-splat.py [out.ply] [count]
"""
import math
import random
import struct
import sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "public/splats/cortex-core.ply"
COUNT = int(sys.argv[2]) if len(sys.argv) > 2 else 60000
random.seed(7)


def fib_sphere(n, radius, squash=1.0):
    """Even-ish point distribution on a sphere via golden-angle spiral."""
    ga = math.pi * (3.0 - math.sqrt(5.0))
    pts = []
    for i in range(n):
        y = 1.0 - (i / max(1, n - 1)) * 2.0
        r = math.sqrt(max(0.0, 1.0 - y * y))
        th = ga * i
        x, z = math.cos(th) * r, math.sin(th) * r
        # radius noise breaks the perfect shell — reads as volumetric haze
        rr = radius * (0.94 + random.random() * 0.12)
        pts.append((x * rr, y * rr * squash, z * rr))
    return pts


def shade(t):
    """Vertical gradient: ice-cyan top -> violet mid -> magenta base."""
    t = max(0.0, min(1.0, t))
    if t < 0.5:
        k = t * 2
        return (0.25 + 0.55 * k, 0.75 - 0.05 * k, 1.0 - 0.25 * k)  # cyan->blue
    k = (t - 0.5) * 2
    return (0.8 - 0.45 * k, 0.7 - 0.55 * k, 1.0 - 0.6 * k)      # blue->magenta


def emit(f, x, y, z, rgb, scale, opacity):
    # INRIA 3DGS PLY property order: pos, normal, f_dc SH-DC, opacity, scale, rot
    nx, ny, nz = 0.0, 0.0, 0.0
    # f_dc: SH coeffs — color = 0.5 + 0.28209479 * f_dc
    fdc = [(c - 0.5) / 0.28209479 for c in rgb]
    # opacity stored as logit
    o = min(0.999, max(0.001, opacity))
    logit = math.log(o / (1.0 - o))
    # isotropic gaussian -> log scale; rotation irrelevant, identity quat (w,x,y,z)
    s = math.log(scale)
    f.write(struct.pack("<17f", x, y, z, nx, ny, nz,
                        fdc[0], fdc[1], fdc[2], logit, s, s, s, 1.0, 0.0, 0.0, 0.0))


def main():
    outer_n = int(COUNT * 0.72)
    inner_n = COUNT - outer_n
    pts = []
    for x, y, z in fib_sphere(outer_n, 1.0):
        pts.append((x, y, z, 0.006 + random.random() * 0.005, 0.13 + random.random() * 0.11))
    for x, y, z in fib_sphere(inner_n, 0.52, squash=1.15):
        pts.append((x, y, z, 0.004 + random.random() * 0.0035, 0.20 + random.random() * 0.16))

    header = (
        "ply\nformat binary_little_endian 1.0\n"
        f"element vertex {len(pts)}\n"
        "property float x\nproperty float y\nproperty float z\n"
        "property float nx\nproperty float ny\nproperty float nz\n"
        "property float f_dc_0\nproperty float f_dc_1\nproperty float f_dc_2\n"
        "property float opacity\n"
        "property float scale_0\nproperty float scale_1\nproperty float scale_2\n"
        "property float rot_0\nproperty float rot_1\nproperty float rot_2\nproperty float rot_3\n"
        "end_header\n"
    ).encode()

    import os
    os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
    with open(OUT, "wb") as f:
        f.write(header)
        for x, y, z, scale, op in pts:
            t = (y / 1.0 + 1.0) / 2.0  # -1..1 -> 0..1
            # push saturation away from mid-grey so the grade survives
            # alpha compositing instead of washing to pastel
            rgb = tuple(max(0.0, min(1.0, 0.5 + (c - 0.5) * 1.7)) for c in shade(t))
            # per-splat brightness jitter keeps it from banding
            j = 0.85 + random.random() * 0.3
            emit(f, x, y, z, tuple(min(1.0, c * j) for c in rgb), scale, op)
    print(f"wrote {OUT}: {len(pts)} gaussians, {os.path.getsize(OUT)/1e6:.1f} MB")


if __name__ == "__main__":
    main()
