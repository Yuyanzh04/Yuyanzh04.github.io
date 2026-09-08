"""Build the four original garden buildings for Yuyan Zhang's homepage.

This script is intentionally self contained: it uses Blender's mesh API only,
creates all geometry locally, and exports one compact GLB per building.  The
coordinate system is Blender's Z-up system; each asset is centered at the
origin and its front elevation faces -Y.  The web scene places the assets and
uses glTF's normal Y-up conversion at load time.

Run from the asset worktree with Blender 4.5 or newer::

    Blender --background --python tools/build_architecture.py

The script also saves a reproducible source scene to /tmp and writes the
measured asset report to ASSETS-models.md.
"""

from __future__ import annotations

import math
import os
from pathlib import Path
from typing import Iterable, Sequence

import bpy
from mathutils import Vector


WORKTREE = Path(__file__).resolve().parents[1]
MODEL_DIR = WORKTREE / "site" / "assets" / "models"
BLEND_OUTPUT = Path("/tmp/yuyan-garden-architecture.blend")


# A restrained palette keeps the individual structures visually related while
# retaining enough material separation for a seven-ish draw call GLB.
PALETTE = {
    "roof_slate": ((0.052, 0.061, 0.067, 1.0), 0.82),
    # A slightly lighter slate ridge is deliberate: it keeps the repeated
    # tile courses readable against the charcoal roof in a browser-sized view.
    "roof_rib": ((0.105, 0.115, 0.122, 1.0), 0.76),
    "wood_cinnabar": ((0.235, 0.043, 0.029, 1.0), 0.68),
    "wood_dark": ((0.095, 0.036, 0.021, 1.0), 0.78),
    "wall_cream": ((0.73, 0.69, 0.59, 1.0), 0.88),
    "stone": ((0.285, 0.292, 0.278, 1.0), 0.93),
    "stone_dark": ((0.17, 0.18, 0.17, 1.0), 0.95),
    "snow": ((0.84, 0.875, 0.88, 1.0), 0.76),
}


MATERIALS: dict[str, bpy.types.Material] = {}


def create_materials() -> dict[str, bpy.types.Material]:
    """Create glTF-friendly Principled materials once per Blender session."""

    result: dict[str, bpy.types.Material] = {}
    for name, (rgba, roughness) in PALETTE.items():
        material_name = f"YUYAN_{name}"
        material = bpy.data.materials.get(material_name) or bpy.data.materials.new(material_name)
        material.use_nodes = True
        material.diffuse_color = rgba
        material.roughness = roughness
        material.use_fake_user = True
        nodes = material.node_tree.nodes
        principled = nodes.get("Principled BSDF")
        if principled is not None:
            principled.inputs["Base Color"].default_value = rgba
            principled.inputs["Roughness"].default_value = roughness
            if "Specular IOR Level" in principled.inputs:
                principled.inputs["Specular IOR Level"].default_value = 0.25
        result[name] = material
    return result


def clear_scene() -> None:
    """Start from an empty scene while retaining reusable material datablocks."""

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)

    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.world.color = (0.035, 0.045, 0.055)


def _mesh_object(
    name: str,
    verts: Sequence[Sequence[float]],
    faces: Sequence[Sequence[int]],
    material: bpy.types.Material,
    smooth: bool = False,
) -> bpy.types.Object:
    """Create one small mesh component with a lightweight procedural UV map."""

    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(list(verts), [], [tuple(face) for face in faces])
    mesh.validate(verbose=False, clean_customdata=True)
    mesh.update(calc_edges=True)
    mesh.materials.append(material)
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        co = mesh.vertices[loop.vertex_index].co
        uv_layer.data[loop.index].uv = (co.x * 0.18 + co.y * 0.07, co.y * 0.18 + co.z * 0.045)
    for polygon in mesh.polygons:
        polygon.use_smooth = smooth
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def _box(
    name: str,
    center: Sequence[float],
    dimensions: Sequence[float],
    material: bpy.types.Material,
    parts: list[bpy.types.Object],
) -> bpy.types.Object:
    """Add an axis-aligned solid box with outward-facing faces."""

    cx, cy, cz = center
    dx, dy, dz = (float(value) * 0.5 for value in dimensions)
    verts = [
        (cx - dx, cy - dy, cz - dz),
        (cx + dx, cy - dy, cz - dz),
        (cx + dx, cy + dy, cz - dz),
        (cx - dx, cy + dy, cz - dz),
        (cx - dx, cy - dy, cz + dz),
        (cx + dx, cy - dy, cz + dz),
        (cx + dx, cy + dy, cz + dz),
        (cx - dx, cy + dy, cz + dz),
    ]
    faces = [
        (0, 3, 2, 1),
        (4, 5, 6, 7),
        (0, 1, 5, 4),
        (1, 2, 6, 5),
        (2, 3, 7, 6),
        (3, 0, 4, 7),
    ]
    obj = _mesh_object(name, verts, faces, material)
    parts.append(obj)
    return obj


def _cylinder_between(
    name: str,
    start: Sequence[float],
    end: Sequence[float],
    radius: float,
    material: bpy.types.Material,
    parts: list[bpy.types.Object],
    segments: int = 8,
    smooth: bool = True,
) -> bpy.types.Object:
    """Create a low-poly cylinder along an arbitrary vector."""

    p0 = Vector(start)
    p1 = Vector(end)
    axis = p1 - p0
    if axis.length < 1e-5:
        return _box(name, p0, (radius * 2, radius * 2, radius * 2), material, parts)
    axis.normalize()
    reference = Vector((0.0, 0.0, 1.0))
    if abs(axis.dot(reference)) > 0.88:
        reference = Vector((1.0, 0.0, 0.0))
    u = axis.cross(reference).normalized()
    v = axis.cross(u).normalized()
    verts: list[tuple[float, float, float]] = []
    for point in (p0, p1):
        for index in range(segments):
            angle = 2.0 * math.pi * index / segments
            offset = radius * (math.cos(angle) * u + math.sin(angle) * v)
            position = point + offset
            verts.append(tuple(position))
    faces: list[tuple[int, ...]] = []
    for index in range(segments):
        next_index = (index + 1) % segments
        faces.append((index, next_index, segments + next_index, segments + index))
    faces.append(tuple(reversed(tuple(range(segments)))))
    faces.append(tuple(segments + index for index in range(segments)))
    obj = _mesh_object(name, verts, faces, material, smooth=smooth)
    parts.append(obj)
    return obj


def _cone_between(
    name: str,
    start: Sequence[float],
    end: Sequence[float],
    start_radius: float,
    end_radius: float,
    material: bpy.types.Material,
    parts: list[bpy.types.Object],
    segments: int = 8,
) -> bpy.types.Object:
    """Create a tapered ornamental cone along an arbitrary vector."""

    p0 = Vector(start)
    p1 = Vector(end)
    axis = p1 - p0
    if axis.length < 1e-5:
        return _box(name, p0, (start_radius * 2, start_radius * 2, start_radius * 2), material, parts)
    axis.normalize()
    reference = Vector((0.0, 0.0, 1.0))
    if abs(axis.dot(reference)) > 0.88:
        reference = Vector((1.0, 0.0, 0.0))
    u = axis.cross(reference).normalized()
    v = axis.cross(u).normalized()
    verts: list[tuple[float, float, float]] = []
    for point, radius in ((p0, start_radius), (p1, end_radius)):
        for index in range(segments):
            angle = 2.0 * math.pi * index / segments
            position = point + radius * (math.cos(angle) * u + math.sin(angle) * v)
            verts.append(tuple(position))
    faces: list[tuple[int, ...]] = []
    for index in range(segments):
        next_index = (index + 1) % segments
        faces.append((index, next_index, segments + next_index, segments + index))
    faces.append(tuple(reversed(tuple(range(segments)))))
    faces.append(tuple(segments + index for index in range(segments)))
    obj = _mesh_object(name, verts, faces, material, smooth=True)
    parts.append(obj)
    return obj


def _tube_polyline(
    name: str,
    points: Sequence[Sequence[float]],
    radius: float,
    material: bpy.types.Material,
    parts: list[bpy.types.Object],
    sides: int = 8,
) -> bpy.types.Object:
    """Create a continuous low-poly tube along a gently curved path."""

    path = [Vector(point) for point in points]
    if len(path) < 2:
        return _box(name, path[0] if path else (0, 0, 0), (radius * 2,) * 3, material, parts)
    rings: list[list[Vector]] = []
    for index, point in enumerate(path):
        if index == 0:
            tangent = path[1] - point
        elif index == len(path) - 1:
            tangent = point - path[index - 1]
        else:
            tangent = path[index + 1] - path[index - 1]
        tangent.normalize()
        reference = Vector((0.0, 0.0, 1.0))
        if abs(tangent.dot(reference)) > 0.88:
            reference = Vector((1.0, 0.0, 0.0))
        u = tangent.cross(reference).normalized()
        v = tangent.cross(u).normalized()
        ring = [point + radius * (math.cos(2 * math.pi * j / sides) * u + math.sin(2 * math.pi * j / sides) * v) for j in range(sides)]
        rings.append(ring)
    verts = [tuple(vertex) for ring in rings for vertex in ring]
    faces: list[tuple[int, ...]] = []
    for ring_index in range(len(rings) - 1):
        a = ring_index * sides
        b = (ring_index + 1) * sides
        for side in range(sides):
            nxt = (side + 1) % sides
            faces.append((a + side, a + nxt, b + nxt, b + side))
    faces.append(tuple(reversed(tuple(range(sides)))))
    last = (len(rings) - 1) * sides
    faces.append(tuple(last + side for side in range(sides)))
    obj = _mesh_object(name, verts, faces, material, smooth=True)
    parts.append(obj)
    return obj


def _roof_z(x: float, y: float, width: float, depth: float, eave: float, ridge: float, axis: str) -> float:
    """Height field for a subtly curved hip roof with lifted corners."""

    if axis == "x":
        axis_coord, cross_coord = x, y
        axis_half, cross_half = width * 0.5, depth * 0.5
    else:
        axis_coord, cross_coord = y, x
        axis_half, cross_half = depth * 0.5, width * 0.5
    cross_t = min(1.0, abs(cross_coord) / max(cross_half, 1e-5))
    slope = ridge - eave
    height = ridge - slope * (cross_t**0.91)
    ridge_half = axis_half * 0.67
    axis_t = max(0.0, (abs(axis_coord) - ridge_half) / max(axis_half - ridge_half, 1e-5))
    # The hip transitions down toward the side ends, while the raised outer
    # edge restores the characteristic swallow-tail curvature at the corners.
    height -= slope * 0.24 * (axis_t**1.45) * (1.0 - cross_t * 0.35)
    # The outer eave rises visibly at each corner, with a restrained sweep
    # along the edge rather than a flat triangular cap.
    corner_lift = slope * 0.35 * (abs(axis_coord) / max(axis_half, 1e-5)) ** 4 * cross_t**5
    edge_sweep = slope * 0.10 * cross_t**7 * (abs(axis_coord) / max(axis_half, 1e-5)) ** 2
    return height + corner_lift + edge_sweep


def _roof_shell(
    name: str,
    width: float,
    depth: float,
    eave: float,
    ridge: float,
    axis: str,
    materials: dict[str, bpy.types.Material],
    parts: list[bpy.types.Object],
    nx: int = 18,
    ny: int = 12,
) -> None:
    """Add a thin curved roof shell with real upturned corner geometry."""

    verts: list[tuple[float, float, float]] = []
    top_index: list[list[int]] = []
    bottom_index: list[list[int]] = []
    for iy in range(ny + 1):
        y = -depth * 0.5 + depth * iy / ny
        top_row: list[int] = []
        bottom_row: list[int] = []
        for ix in range(nx + 1):
            x = -width * 0.5 + width * ix / nx
            top = _roof_z(x, y, width, depth, eave, ridge, axis)
            top_row.append(len(verts))
            verts.append((x, y, top))
            bottom_row.append(len(verts))
            verts.append((x, y, top - 0.14))
        top_index.append(top_row)
        bottom_index.append(bottom_row)
    faces: list[tuple[int, ...]] = []
    for iy in range(ny):
        for ix in range(nx):
            a, b = top_index[iy][ix], top_index[iy][ix + 1]
            c, d = top_index[iy + 1][ix + 1], top_index[iy + 1][ix]
            faces.append((a, b, c, d))
            a, b = bottom_index[iy][ix], bottom_index[iy + 1][ix]
            c, d = bottom_index[iy + 1][ix + 1], bottom_index[iy][ix + 1]
            faces.append((a, b, c, d))
    # Perimeter fascia edge faces close the roof and give a visible dark lip.
    perimeter: list[int] = []
    perimeter.extend(top_index[0])
    perimeter.extend(top_index[iy][-1] for iy in range(1, ny + 1))
    perimeter.extend(reversed(top_index[-1][:-1]))
    perimeter.extend(top_index[iy][0] for iy in reversed(range(ny)))
    bottom_perimeter: list[int] = []
    bottom_perimeter.extend(bottom_index[0])
    bottom_perimeter.extend(bottom_index[iy][-1] for iy in range(1, ny + 1))
    bottom_perimeter.extend(reversed(bottom_index[-1][:-1]))
    bottom_perimeter.extend(bottom_index[iy][0] for iy in reversed(range(ny)))
    for index in range(len(perimeter)):
        nxt = (index + 1) % len(perimeter)
        faces.append((perimeter[index], bottom_perimeter[index], bottom_perimeter[nxt], perimeter[nxt]))
    obj = _mesh_object(name, verts, faces, materials["roof_slate"], smooth=True)
    parts.append(obj)


def _roof_details(
    prefix: str,
    width: float,
    depth: float,
    eave: float,
    ridge: float,
    axis: str,
    materials: dict[str, bpy.types.Material],
    parts: list[bpy.types.Object],
    ornament_scale: float = 1.0,
) -> None:
    """Add tiled courses, ridge/eave tubes, and restrained ridge ornaments."""

    rib = materials["roof_rib"]
    wood = materials["wood_dark"]
    if axis == "x":
        half_axis, half_cross = width * 0.5, depth * 0.5
        # Horizontal tile courses on the front and back slopes.
        for side in (-1.0, 1.0):
            for index in range(1, 11):
                cross = side * half_cross * (1.0 - 0.09 * index)
                # Cover the complete ridge-to-ridge span.  The earlier first
                # pass used half_axis instead of 2*half_axis here, leaving a
                # conspicuous rectangular patch on one half of each roof.
                points = [(x, cross, _roof_z(x, cross, width, depth, eave, ridge, axis) + 0.035) for x in [(-half_axis + 2 * half_axis * i / 14) for i in range(15)]]
                _tube_polyline(f"{prefix}_tile_course_{side}_{index}", points, 0.034, rib, parts, sides=6)
            for index in range(-7, 8):
                x = index * half_axis * 0.13
                for roof_side in (-1.0, 1.0):
                    points = []
                    for step in range(7):
                        cross = roof_side * half_cross * 0.98 * (1.0 - step / 6)
                        points.append((x, cross, _roof_z(x, cross, width, depth, eave, ridge, axis) + 0.05))
                    _tube_polyline(f"{prefix}_roof_rib_{roof_side}_{index}", points, 0.025, rib, parts, sides=6)
        eave_points_front = [(x, -half_cross, _roof_z(x, -half_cross, width, depth, eave, ridge, axis) + 0.04) for x in [(-half_axis + 2 * half_axis * i / 14) for i in range(15)]]
        eave_points_back = [(x, half_cross, _roof_z(x, half_cross, width, depth, eave, ridge, axis) + 0.04) for x in [(-half_axis + 2 * half_axis * i / 14) for i in range(15)]]
        side_left = [(-half_axis, y, _roof_z(-half_axis, y, width, depth, eave, ridge, axis) + 0.04) for y in [(-half_cross + 2 * half_cross * i / 10) for i in range(11)]]
        side_right = [(half_axis, y, _roof_z(half_axis, y, width, depth, eave, ridge, axis) + 0.04) for y in [(-half_cross + 2 * half_cross * i / 10) for i in range(11)]]
        ridge_points = [(x, 0.0, ridge + 0.04) for x in [(-half_axis * 0.67 + 2 * half_axis * 0.67 * i / 10) for i in range(11)]]
        ornament_ends = [(-half_axis * 0.67, 0.0, ridge + 0.05), (half_axis * 0.67, 0.0, ridge + 0.05)]
    else:
        half_axis, half_cross = depth * 0.5, width * 0.5
        for side in (-1.0, 1.0):
            for index in range(1, 11):
                cross = side * half_cross * (1.0 - 0.09 * index)
                points = [(cross, y, _roof_z(cross, y, width, depth, eave, ridge, axis) + 0.035) for y in [(-half_axis + 2 * half_axis * i / 14) for i in range(15)]]
                _tube_polyline(f"{prefix}_tile_course_{side}_{index}", points, 0.034, rib, parts, sides=6)
            for index in range(-7, 8):
                y = index * half_axis * 0.13
                for roof_side in (-1.0, 1.0):
                    points = []
                    for step in range(7):
                        cross = roof_side * half_cross * 0.98 * (1.0 - step / 6)
                        points.append((cross, y, _roof_z(cross, y, width, depth, eave, ridge, axis) + 0.05))
                    _tube_polyline(f"{prefix}_roof_rib_{roof_side}_{index}", points, 0.025, rib, parts, sides=6)
        eave_points_front = [(-half_cross, y, _roof_z(-half_cross, y, width, depth, eave, ridge, axis) + 0.04) for y in [(-half_axis + 2 * half_axis * i / 14) for i in range(15)]]
        eave_points_back = [(half_cross, y, _roof_z(half_cross, y, width, depth, eave, ridge, axis) + 0.04) for y in [(-half_axis + 2 * half_axis * i / 14) for i in range(15)]]
        side_left = [(x, -half_axis, _roof_z(x, -half_axis, width, depth, eave, ridge, axis) + 0.04) for x in [(-half_cross + 2 * half_cross * i / 10) for i in range(11)]]
        side_right = [(x, half_axis, _roof_z(x, half_axis, width, depth, eave, ridge, axis) + 0.04) for x in [(-half_cross + 2 * half_cross * i / 10) for i in range(11)]]
        ridge_points = [(0.0, y, ridge + 0.04) for y in [(-half_axis * 0.67 + 2 * half_axis * 0.67 * i / 10) for i in range(11)]]
        ornament_ends = [(0.0, -half_axis * 0.67, ridge + 0.05), (0.0, half_axis * 0.67, ridge + 0.05)]
    for label, points in (("eave_front", eave_points_front), ("eave_back", eave_points_back), ("eave_left", side_left), ("eave_right", side_right)):
        _tube_polyline(f"{prefix}_{label}", points, 0.12 * ornament_scale, wood, parts, sides=7)
    _tube_polyline(f"{prefix}_ridge", ridge_points, 0.10 * ornament_scale, wood, parts, sides=7)
    # Each end receives a small upward-facing chiwen-like tapered ornament;
    # the pair is enough to read at normal distance without becoming gaudy.
    for index, end in enumerate(ornament_ends):
        p = Vector(end)
        direction = Vector((0.0, 0.0, 0.33 * ornament_scale))
        if axis == "x":
            direction.x = 0.25 * ornament_scale * (-1.0 if index == 0 else 1.0)
        else:
            direction.y = 0.25 * ornament_scale * (-1.0 if index == 0 else 1.0)
        _cone_between(f"{prefix}_ridge_ornament_{index}", p, p + direction, 0.16 * ornament_scale, 0.025 * ornament_scale, rib, parts, segments=7)
        _cylinder_between(f"{prefix}_ridge_cap_{index}", p - Vector((0, 0, 0.06)), p + Vector((0, 0, 0.05)), 0.13 * ornament_scale, wood, parts, segments=7)


def _add_roof(
    prefix: str,
    width: float,
    depth: float,
    eave: float,
    ridge: float,
    axis: str,
    materials: dict[str, bpy.types.Material],
    parts: list[bpy.types.Object],
    ornament_scale: float = 1.0,
) -> None:
    _roof_shell(prefix, width, depth, eave, ridge, axis, materials, parts)
    _roof_details(prefix, width, depth, eave, ridge, axis, materials, parts, ornament_scale=ornament_scale)


def _add_base(
    prefix: str,
    width: float,
    depth: float,
    materials: dict[str, bpy.types.Material],
    parts: list[bpy.types.Object],
    step_width: float | None = None,
) -> float:
    """Add a layered stone台基 and three front steps; return its top elevation."""

    stone = materials["stone"]
    dark = materials["stone_dark"]
    _box(f"{prefix}_base_lower", (0, 0, 0.16), (width + 0.72, depth + 0.72, 0.32), dark, parts)
    _box(f"{prefix}_base_upper", (0, 0, 0.43), (width + 0.48, depth + 0.48, 0.22), stone, parts)
    _box(f"{prefix}_floor_slab", (0, 0, 0.61), (width + 0.20, depth + 0.20, 0.16), dark, parts)
    stair_width = step_width or (width * 0.44)
    for index in range(3):
        rise = 0.17
        _box(
            f"{prefix}_front_step_{index}",
            (0, -depth * 0.5 - 0.22 - index * 0.32, 0.08 + index * rise),
            (stair_width + index * 0.10, 0.44, 0.16 + index * rise),
            stone,
            parts,
        )
    return 0.69


def _add_bracket_cluster(
    prefix: str,
    x: float,
    y: float,
    z: float,
    materials: dict[str, bpy.types.Material],
    parts: list[bpy.types.Object],
    scale: float = 1.0,
) -> None:
    """Layered斗拱 blocks under an eave beam."""

    wood = materials["wood_dark"]
    red = materials["wood_cinnabar"]
    _box(f"{prefix}_bracket_cross", (x, y, z), (0.58 * scale, 0.22 * scale, 0.12 * scale), red, parts)
    _box(f"{prefix}_bracket_depth", (x, y, z + 0.105 * scale), (0.23 * scale, 0.56 * scale, 0.10 * scale), wood, parts)
    _box(f"{prefix}_bracket_cap", (x, y, z + 0.20 * scale), (0.42 * scale, 0.18 * scale, 0.09 * scale), red, parts)


def _add_railing_line(
    prefix: str,
    start: Sequence[float],
    end: Sequence[float],
    height: float,
    materials: dict[str, bpy.types.Material],
    parts: list[bpy.types.Object],
    posts: int = 4,
    radius: float = 0.045,
) -> None:
    """Add a compact timber railing segment."""

    p0 = Vector(start)
    p1 = Vector(end)
    direction = p1 - p0
    for index in range(posts):
        t = index / max(posts - 1, 1)
        p = p0.lerp(p1, t)
        _cylinder_between(f"{prefix}_post_{index}", p, p + Vector((0, 0, height)), radius * 1.15, materials["wood_dark"], parts, segments=6)
    _tube_polyline(f"{prefix}_top", [p0 + Vector((0, 0, height)), p1 + Vector((0, 0, height))], radius * 1.7, materials["wood_cinnabar"], parts, sides=7)
    mid_offset = Vector((0, 0, height * 0.46))
    _tube_polyline(f"{prefix}_middle", [p0 + mid_offset, p1 + mid_offset], radius, materials["wood_dark"], parts, sides=6)


def _add_window_grid(
    prefix: str,
    center: Sequence[float],
    width: float,
    height: float,
    orientation: str,
    materials: dict[str, bpy.types.Material],
    parts: list[bpy.types.Object],
    bars: int = 3,
) -> None:
    """Overlay a traditional dark timber lattice on a cream wall panel."""

    x, y, z = center
    wood = materials["wood_dark"]
    red = materials["wood_cinnabar"]
    if orientation == "front":
        _box(f"{prefix}_frame_top", (x, y, z + height * 0.5), (width + 0.16, 0.10, 0.10), red, parts)
        _box(f"{prefix}_frame_bottom", (x, y, z - height * 0.5), (width + 0.16, 0.10, 0.10), red, parts)
        _box(f"{prefix}_frame_left", (x - width * 0.5, y, z), (0.10, 0.10, height), red, parts)
        _box(f"{prefix}_frame_right", (x + width * 0.5, y, z), (0.10, 0.10, height), red, parts)
        for index in range(1, bars + 1):
            bx = x - width * 0.5 + width * index / (bars + 1)
            _box(f"{prefix}_bar_v_{index}", (bx, y - 0.01, z), (0.045, 0.085, height - 0.08), wood, parts)
        for index in range(1, 3):
            bz = z - height * 0.5 + height * index / 3
            _box(f"{prefix}_bar_h_{index}", (x, y - 0.015, bz), (width - 0.08, 0.08, 0.045), wood, parts)
    else:
        _box(f"{prefix}_frame_top", (x, y, z + height * 0.5), (0.10, width + 0.16, 0.10), red, parts)
        _box(f"{prefix}_frame_bottom", (x, y, z - height * 0.5), (0.10, width + 0.16, 0.10), red, parts)
        _box(f"{prefix}_frame_left", (x, y - width * 0.5, z), (0.10, 0.10, height), red, parts)
        _box(f"{prefix}_frame_right", (x, y + width * 0.5, z), (0.10, 0.10, height), red, parts)
        for index in range(1, bars + 1):
            by = y - width * 0.5 + width * index / (bars + 1)
            _box(f"{prefix}_bar_v_{index}", (x - 0.01, by, z), (0.085, 0.045, height - 0.08), wood, parts)
        for index in range(1, 3):
            bz = z - height * 0.5 + height * index / 3
            _box(f"{prefix}_bar_h_{index}", (x - 0.015, y, bz), (0.08, width - 0.08, 0.045), wood, parts)


def _add_level(
    prefix: str,
    width: float,
    depth: float,
    z0: float,
    z1: float,
    materials: dict[str, bpy.types.Material],
    parts: list[bpy.types.Object],
    front_windows: int = 3,
    side_windows: int = 2,
    door: bool = True,
    balcony: bool = False,
    side_wall: bool = True,
    open_front: bool = False,
    timber_sides: bool = False,
) -> None:
    """Construct one enclosed timber-frame level."""

    red = materials["wood_cinnabar"]
    dark = materials["wood_dark"]
    cream = materials["wall_cream"]
    wall_bottom = z0 + 0.18
    wall_top = z1 - 0.24
    wall_height = wall_top - wall_bottom
    _box(f"{prefix}_floor", (0, 0, z0), (width + 0.12, depth + 0.12, 0.16), dark, parts)

    # A classical楼阁 front is a timber screen between columns.  Research and
    # Writing use a dark backing rather than a full cream wall, so the red
    # posts and dense lattice remain legible as the primary façade language.
    front_material = dark if open_front else cream
    _box(f"{prefix}_wall_front", (0, -depth * 0.5 + 0.055, (wall_bottom + wall_top) * 0.5), (width - 0.42, 0.13, wall_height), front_material, parts)
    _box(f"{prefix}_wall_back", (0, depth * 0.5 - 0.055, (wall_bottom + wall_top) * 0.5), (width - 0.42, 0.13, wall_height), cream, parts)
    if side_wall:
        side_material = dark if timber_sides else cream
        _box(f"{prefix}_wall_left", (-width * 0.5 + 0.055, 0, (wall_bottom + wall_top) * 0.5), (0.13, depth - 0.42, wall_height), side_material, parts)
        _box(f"{prefix}_wall_right", (width * 0.5 - 0.055, 0, (wall_bottom + wall_top) * 0.5), (0.13, depth - 0.42, wall_height), side_material, parts)

    # Deep cinnabar columns and the slightly darker beams read as timber frame.
    column_count = 5 if width >= 7.0 else 3
    x_positions = [
        -width * 0.5 + 0.30 + (width - 0.60) * index / max(column_count - 1, 1)
        for index in range(column_count)
    ]
    for index, x in enumerate(x_positions):
        for y in (-depth * 0.5 + 0.20, depth * 0.5 - 0.20):
            _cylinder_between(f"{prefix}_column_{index}_{y}", (x, y, z0), (x, y, z1 + 0.03), 0.145, red, parts, segments=10, smooth=True)
            _add_bracket_cluster(f"{prefix}_bracket_{index}_{y}", x, y, z1 - 0.17, materials, parts, scale=0.92)
    for y in (-depth * 0.5, depth * 0.5):
        _box(f"{prefix}_beam_x_{y}", (0, y, z1 - 0.10), (width + 0.42, 0.20, 0.22), dark, parts)
    for x in (-width * 0.5, width * 0.5):
        _box(f"{prefix}_beam_y_{x}", (x, 0, z1 - 0.10), (0.20, depth + 0.42, 0.22), dark, parts)

    window_height = min(1.72 if open_front else 1.34, wall_height * (0.80 if open_front else 0.60))
    window_z = wall_bottom + wall_height * (0.50 if open_front else 0.53)
    if door:
        door_width = min(1.08 if open_front else 1.02, width * 0.22)
        door_height = min(1.95 if open_front else 1.65, wall_height - 0.12)
        _box(f"{prefix}_front_door", (0, -depth * 0.5 - 0.025, wall_bottom + door_height * 0.5), (door_width, 0.11, door_height), dark, parts)
        _box(f"{prefix}_door_header", (0, -depth * 0.5 - 0.04, wall_bottom + door_height), (door_width + 0.22, 0.14, 0.12), red, parts)
    usable = width * 0.80
    for index in range(front_windows):
        x = -usable * 0.5 + usable * (index + 0.5) / front_windows
        if door and abs(x) < width * 0.18:
            continue
        _add_window_grid(f"{prefix}_front_window_{index}", (x, -depth * 0.5 - 0.085, window_z), min(1.30 if open_front else 1.45, usable / max(front_windows, 1) - 0.12), window_height, "front", materials, parts, bars=4 if open_front else 3)
    for index in range(side_windows):
        y = -depth * 0.34 + depth * 0.68 * (index + 0.5) / max(side_windows, 1)
        _add_window_grid(f"{prefix}_left_window_{index}", (-width * 0.5 - 0.085, y, window_z), min(1.10, depth / max(side_windows, 1) - 0.20), window_height, "side", materials, parts, bars=3)
        _add_window_grid(f"{prefix}_right_window_{index}", (width * 0.5 + 0.085, y, window_z), min(1.10, depth / max(side_windows, 1) - 0.20), window_height, "side", materials, parts, bars=3)
    if balcony:
        rail_z = z0 + 0.10
        _add_railing_line(f"{prefix}_rail_front", (-width * 0.5 + 0.18, -depth * 0.5 - 0.32, rail_z), (width * 0.5 - 0.18, -depth * 0.5 - 0.32, rail_z), 0.73, materials, parts, posts=5)
        _add_railing_line(f"{prefix}_rail_back", (-width * 0.5 + 0.18, depth * 0.5 + 0.32, rail_z), (width * 0.5 - 0.18, depth * 0.5 + 0.32, rail_z), 0.73, materials, parts, posts=5)


def _add_pavilion_frame(
    prefix: str,
    width: float,
    depth: float,
    z0: float,
    z1: float,
    materials: dict[str, bpy.types.Material],
    parts: list[bpy.types.Object],
) -> None:
    """Open pavilion frame with eight posts, railing and a back lattice screen."""

    red = materials["wood_cinnabar"]
    dark = materials["wood_dark"]
    inset_x = width * 0.5 - 0.28
    inset_y = depth * 0.5 - 0.28
    positions = [
        (-inset_x, -inset_y), (0.0, -inset_y), (inset_x, -inset_y),
        (-inset_x, inset_y), (0.0, inset_y), (inset_x, inset_y),
        (-inset_x, 0.0), (inset_x, 0.0),
    ]
    for index, (x, y) in enumerate(positions):
        _cylinder_between(f"{prefix}_post_{index}", (x, y, z0), (x, y, z1 + 0.04), 0.16, red, parts, segments=10, smooth=True)
        _add_bracket_cluster(f"{prefix}_bracket_{index}", x, y, z1 - 0.18, materials, parts, scale=0.92)
    for y in (-inset_y, inset_y):
        _box(f"{prefix}_beam_frontback_{y}", (0, y, z1 - 0.10), (width + 0.36, 0.22, 0.22), dark, parts)
    for x in (-inset_x, inset_x):
        _box(f"{prefix}_beam_sides_{x}", (x, 0, z1 - 0.10), (0.22, depth + 0.36, 0.22), dark, parts)
    rail_z = z0 + 0.10
    _add_railing_line(f"{prefix}_rail_front", (-inset_x, -inset_y, rail_z), (inset_x, -inset_y, rail_z), 0.74, materials, parts, posts=5)
    _add_railing_line(f"{prefix}_rail_back", (-inset_x, inset_y, rail_z), (inset_x, inset_y, rail_z), 0.74, materials, parts, posts=5)
    _add_railing_line(f"{prefix}_rail_left", (-inset_x, -inset_y, rail_z), (-inset_x, inset_y, rail_z), 0.74, materials, parts, posts=3)
    _add_railing_line(f"{prefix}_rail_right", (inset_x, -inset_y, rail_z), (inset_x, inset_y, rail_z), 0.74, materials, parts, posts=3)
    # Quiet back lattice screens enrich the pavilion without turning it into a box.
    _add_window_grid(f"{prefix}_back_lattice_left", (-width * 0.25, inset_y + 0.05, z0 + 1.08), width * 0.35, 1.52, "front", materials, parts, bars=3)
    _add_window_grid(f"{prefix}_back_lattice_right", (width * 0.25, inset_y + 0.05, z0 + 1.08), width * 0.35, 1.52, "front", materials, parts, bars=3)
    # A pair of low benches makes the space read as a water pavilion rather
    # than a four-column placeholder when viewed through the front opening.
    _box(f"{prefix}_bench_left", (-width * 0.27, 0.08, z0 + 0.74), (width * 0.33, depth * 0.62, 0.14), dark, parts)
    _box(f"{prefix}_bench_right", (width * 0.27, 0.08, z0 + 0.74), (width * 0.33, depth * 0.62, 0.14), dark, parts)
    _box(f"{prefix}_tea_table", (0, 0.10, z0 + 0.75), (0.72, 0.56, 0.12), red, parts)
    for x in (-0.27 * width, 0.27 * width):
        for y in (-0.17, 0.34):
            _cylinder_between(f"{prefix}_bench_leg_{x}_{y}", (x, y, z0 + 0.62), (x, y, z0 + 0.74), 0.045, dark, parts, segments=6)


def _add_eave_brackets(
    prefix: str,
    width: float,
    depth: float,
    eave: float,
    axis: str,
    materials: dict[str, bpy.types.Material],
    parts: list[bpy.types.Object],
    count: int = 5,
    scale: float = 0.80,
) -> None:
    """Place repeated斗拱 clusters under the exposed outer eave."""

    if axis == "x":
        for index in range(count):
            x = -width * 0.42 + width * 0.84 * index / max(count - 1, 1)
            for side, y in (("front", -depth * 0.5 + 0.09), ("back", depth * 0.5 - 0.09)):
                _add_bracket_cluster(f"{prefix}_{side}_{index}", x, y, eave - 0.20, materials, parts, scale=scale)
    else:
        for index in range(count):
            y = -depth * 0.42 + depth * 0.84 * index / max(count - 1, 1)
            for side, x in (("left", -width * 0.5 + 0.09), ("right", width * 0.5 - 0.09)):
                _add_bracket_cluster(f"{prefix}_{side}_{index}", x, y, eave - 0.20, materials, parts, scale=scale)


def _add_gable_panel(
    prefix: str,
    width: float,
    depth: float,
    eave: float,
    ridge: float,
    axis: str,
    materials: dict[str, bpy.types.Material],
    parts: list[bpy.types.Object],
) -> None:
    """Add small framed歇山 gable panels under a high roof's hip ends."""

    wall = materials["wall_cream"]
    wood = materials["wood_cinnabar"]
    if axis == "x":
        fixed_positions = (-width * 0.34, width * 0.34)
        for index, x in enumerate(fixed_positions):
            base_y = depth * 0.28
            base_z = eave + 0.10
            apex_z = ridge - 0.14
            verts = [(x, -base_y, base_z), (x, base_y, base_z), (x, 0.0, apex_z)]
            obj = _mesh_object(f"{prefix}_wall_{index}", verts, [(0, 1, 2)], wall)
            parts.append(obj)
            _tube_polyline(
                f"{prefix}_frame_{index}",
                [(x, -base_y, base_z), (x, 0.0, apex_z), (x, base_y, base_z), (x, -base_y, base_z)],
                0.045,
                wood,
                parts,
                sides=6,
            )
    else:
        fixed_positions = (-depth * 0.34, depth * 0.34)
        for index, y in enumerate(fixed_positions):
            base_x = width * 0.28
            base_z = eave + 0.10
            apex_z = ridge - 0.14
            verts = [(-base_x, y, base_z), (base_x, y, base_z), (0.0, y, apex_z)]
            obj = _mesh_object(f"{prefix}_wall_{index}", verts, [(0, 1, 2)], wall)
            parts.append(obj)
            _tube_polyline(
                f"{prefix}_frame_{index}",
                [(-base_x, y, base_z), (0.0, y, apex_z), (base_x, y, base_z), (-base_x, y, base_z)],
                0.045,
                wood,
                parts,
                sides=6,
            )


def _join_parts(
    parts: list[bpy.types.Object],
    name: str,
    building_id: str,
    description: str,
) -> bpy.types.Object:
    """Merge one building's components while preserving per-face materials.

    Blender's context ``object.join`` can leave every incoming mesh at local
    material index zero when the components were made independently.  That is
    visually disastrous for a procedural building: all walls and timber then
    inherit whichever material happened to be active.  We merge the small
    component meshes explicitly so each polygon keeps the material pointer it
    was authored with, while still producing one compact building mesh.
    """

    if not parts:
        raise RuntimeError(f"No geometry was generated for {name}")

    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    face_materials: list[bpy.types.Material] = []
    smooth_flags: list[bool] = []
    ordered_materials: list[bpy.types.Material] = []
    for part in parts:
        if part.type != "MESH":
            continue
        offset = len(vertices)
        vertices.extend(tuple(vertex.co) for vertex in part.data.vertices)
        for polygon in part.data.polygons:
            faces.append(tuple(offset + vertex_index for vertex_index in polygon.vertices))
            material = part.data.materials[polygon.material_index] if part.data.materials else None
            if material is None:
                material = MATERIALS["stone_dark"]
            face_materials.append(material)
            smooth_flags.append(bool(polygon.use_smooth))
            if material not in ordered_materials:
                ordered_materials.append(material)

    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=False, clean_customdata=True)
    mesh.update(calc_edges=True)
    for material in ordered_materials:
        mesh.materials.append(material)
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        co = mesh.vertices[loop.vertex_index].co
        uv_layer.data[loop.index].uv = (co.x * 0.18 + co.y * 0.07, co.y * 0.18 + co.z * 0.045)
    material_index = {material: index for index, material in enumerate(ordered_materials)}
    for index, polygon in enumerate(mesh.polygons):
        polygon.material_index = material_index[face_materials[index]]
        polygon.use_smooth = smooth_flags[index]
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for part in parts:
        data = part.data
        bpy.data.objects.remove(part, do_unlink=True)
        if data.users == 0:
            bpy.data.meshes.remove(data)
    obj.name = name
    obj.location = (0.0, 0.0, 0.0)
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.scale = (1.0, 1.0, 1.0)
    obj["building_id"] = building_id
    obj["description"] = description
    obj["coordinate_system"] = "Blender Z-up; front elevation faces -Y"
    obj["seasonal_snow_prefix"] = f"snow_{building_id}_"
    obj.data.calc_loop_triangles()
    return obj


def _deduplicate_materials(obj: bpy.types.Object) -> None:
    """Make material-slot count equal to actual draw-call groups."""

    materials: list[bpy.types.Material] = []
    remap: dict[int, int] = {}
    for old_index, slot in enumerate(obj.material_slots):
        material = slot.material
        if material is None:
            continue
        if material not in materials:
            materials.append(material)
        remap[old_index] = materials.index(material)
    for polygon in obj.data.polygons:
        polygon.material_index = remap.get(polygon.material_index, 0)
    obj.data.materials.clear()
    for material in materials:
        obj.data.materials.append(material)


def _snow_patch(
    name: str,
    width: float,
    depth: float,
    eave: float,
    ridge: float,
    axis: str,
    along_min: float,
    along_max: float,
    cross_start: float,
    cross_end: float,
    materials: dict[str, bpy.types.Material],
    parts: list[bpy.types.Object],
    seed: int,
) -> None:
    """Make an irregular, thin sheet that hugs one roof slope.

    ``along_*`` and ``cross_*`` use half-dimension units in [-1, 1].  A small
    deterministic wobble breaks the manufactured ribbon outline while keeping
    the snow fully on the roof surface.
    """

    along_half = (width if axis == "x" else depth) * 0.5
    cross_half = (depth if axis == "x" else width) * 0.5
    along_knots = (0.0, 0.16, 0.33, 0.51, 0.69, 0.84, 1.0)
    cross_knots = (0.0, 0.36, 0.70, 1.0)
    wobble = ((-0.018, 0.025, -0.012, 0.030, -0.022, 0.014, -0.010), (0.022, -0.018, 0.014, -0.026, 0.018, -0.012, 0.020))
    verts: list[tuple[float, float, float]] = []
    top_rows: list[list[int]] = []
    bottom_rows: list[list[int]] = []
    for row, row_t in enumerate(cross_knots):
        top_row: list[int] = []
        bottom_row: list[int] = []
        for index, along_t in enumerate(along_knots):
            along = along_min + (along_max - along_min) * along_t + wobble[seed % 2][index] * (0.70 if row in (0, len(cross_knots) - 1) else 0.25)
            cross = cross_start + (cross_end - cross_start) * row_t + wobble[(seed + row) % 2][index] * 0.35
            if axis == "x":
                x, y = along * along_half, cross * cross_half
            else:
                x, y = cross * cross_half, along * along_half
            # Sit just above the raised tile ribs so the snow reads as a thin
            # cover, while retaining the roof's underlying curved slope.
            z = _roof_z(x, y, width, depth, eave, ridge, axis) + 0.115 + 0.008 * math.sin(index * 1.8 + row)
            top_row.append(len(verts))
            verts.append((x, y, z))
            bottom_row.append(len(verts))
            verts.append((x, y, z - 0.055))
        top_rows.append(top_row)
        bottom_rows.append(bottom_row)
    faces: list[tuple[int, ...]] = []
    for row in range(len(cross_knots) - 1):
        for index in range(len(along_knots) - 1):
            a, b = top_rows[row][index], top_rows[row][index + 1]
            c, d = top_rows[row + 1][index + 1], top_rows[row + 1][index]
            faces.append((a, b, c, d))
            a, b = bottom_rows[row][index], bottom_rows[row + 1][index]
            c, d = bottom_rows[row + 1][index + 1], bottom_rows[row][index + 1]
            faces.append((a, b, c, d))
    boundary = []
    boundary.extend(top_rows[0])
    boundary.extend(top_rows[row][-1] for row in range(1, len(top_rows)))
    boundary.extend(reversed(top_rows[-1][:-1]))
    boundary.extend(top_rows[row][0] for row in reversed(range(len(top_rows) - 1)))
    boundary_bottom = []
    boundary_bottom.extend(bottom_rows[0])
    boundary_bottom.extend(bottom_rows[row][-1] for row in range(1, len(bottom_rows)))
    boundary_bottom.extend(reversed(bottom_rows[-1][:-1]))
    boundary_bottom.extend(bottom_rows[row][0] for row in reversed(range(len(bottom_rows) - 1)))
    for index in range(len(boundary)):
        nxt = (index + 1) % len(boundary)
        faces.append((boundary[index], boundary_bottom[index], boundary_bottom[nxt], boundary[nxt]))
    parts.append(_mesh_object(name, verts, faces, materials["snow"], smooth=True))


def _snow_ribbon(
    prefix: str,
    width: float,
    depth: float,
    eave: float,
    ridge: float,
    axis: str,
    materials: dict[str, bpy.types.Material],
    parts: list[bpy.types.Object],
) -> None:
    """Add sparse irregular snow sheets; JS hides this node outside winter."""

    _snow_patch(f"{prefix}_snow_front_main", width, depth, eave, ridge, axis, -0.80, 0.08, -0.90, -0.48, materials, parts, seed=0)
    _snow_patch(f"{prefix}_snow_front_eave", width, depth, eave, ridge, axis, 0.28, 0.80, -0.995, -0.78, materials, parts, seed=1)
    _snow_patch(f"{prefix}_snow_back_small", width, depth, eave, ridge, axis, -0.36, 0.42, 0.42, 0.74, materials, parts, seed=2)
    # A thin ledge on the upper step keeps winter visible in the foreground
    # without turning the base into a continuous white blanket.
    _box(f"{prefix}_snow_step_ledge", (0, -depth * 0.5 - 0.86, 0.70), (width * 0.42, 0.16, 0.055), materials["snow"], parts)


def _snow_railing(
    prefix: str,
    width: float,
    depth: float,
    z: float,
    materials: dict[str, bpy.types.Material],
    parts: list[bpy.types.Object],
) -> None:
    """Add one thin snow line to a front balcony rail."""

    y = -depth * 0.5 - 0.32
    _tube_polyline(
        f"{prefix}_snow_rail",
        [(-width * 0.34, y, z), (0.0, y - 0.012, z + 0.004), (width * 0.34, y, z)],
        0.046,
        materials["snow"],
        parts,
        sides=6,
    )


def _mark_snow_hidden(obj: bpy.types.Object, building_id: str) -> None:
    obj.name = f"snow_{building_id}_winter"
    obj["season"] = "winter"
    obj["building_id"] = building_id
    obj["hide_by_default_in_web"] = True
    obj.hide_render = True
    obj.hide_set(True)


def build_research(materials: dict[str, bpy.types.Material]) -> tuple[bpy.types.Object, bpy.types.Object]:
    parts: list[bpy.types.Object] = []
    snow_parts: list[bpy.types.Object] = []
    width, depth = 8.2, 5.0
    _add_base("research", width, depth, materials, parts, step_width=2.65)
    levels = [(0.69, 3.00, 7.55, 4.35), (3.16, 5.62, 7.18, 4.18), (5.78, 8.24, 6.80, 4.02)]
    for index, (z0, z1, level_width, level_depth) in enumerate(levels):
        _add_level(
            f"research_level_{index + 1}",
            level_width,
            level_depth,
            z0,
            z1,
            materials,
            parts,
            front_windows=5,
            side_windows=3,
            door=True,
            balcony=index > 0,
            open_front=True,
            timber_sides=True,
        )
    # Intermediate eaves make the main tower read as three stacked storeys.
    _add_roof("research_lower_eave_1", 8.88, 5.78, 2.92, 3.62, "x", materials, parts, ornament_scale=0.78)
    _add_eave_brackets("research_lower_brackets_1", 8.88, 5.78, 2.92, "x", materials, parts, count=5, scale=0.78)
    _add_roof("research_lower_eave_2", 8.88, 5.78, 5.55, 6.25, "x", materials, parts, ornament_scale=0.78)
    _add_eave_brackets("research_lower_brackets_2", 8.88, 5.78, 5.55, "x", materials, parts, count=5, scale=0.78)
    # The upper roof has two distinct eave lines, giving the main hall its
    # 重檐歇山 silhouette and enough layered shadow to read at browser scale.
    _add_roof("research_top_lower", 8.98, 5.92, 8.18, 8.88, "x", materials, parts, ornament_scale=1.02)
    _add_eave_brackets("research_top_brackets_lower", 8.98, 5.92, 8.18, "x", materials, parts, count=6, scale=0.94)
    _add_roof("research_top_upper", 8.54, 5.48, 8.75, 10.38, "x", materials, parts, ornament_scale=1.0)
    _add_eave_brackets("research_top_brackets_upper", 8.54, 5.48, 8.75, "x", materials, parts, count=6, scale=0.94)
    _add_gable_panel("research_top_gable", 8.54, 5.48, 8.75, 10.38, "x", materials, parts)
    _snow_ribbon("research", 8.54, 5.48, 8.75, 10.38, "x", materials, snow_parts)
    _snow_railing("research_level_2", 7.18, 4.18, 3.99, materials, snow_parts)
    _snow_railing("research_level_3", 6.80, 4.02, 6.61, materials, snow_parts)
    main = _join_parts(parts, "research_building", "research", "three-storey 重檐歇山主阁")
    snow = _join_parts(snow_parts, "snow_research_winter", "research", "winter roof snow shelves")
    _mark_snow_hidden(snow, "research")
    return main, snow


def build_writing(materials: dict[str, bpy.types.Material]) -> tuple[bpy.types.Object, bpy.types.Object]:
    parts: list[bpy.types.Object] = []
    snow_parts: list[bpy.types.Object] = []
    width, depth = 5.55, 7.55
    _add_base("writing", width, depth, materials, parts, step_width=2.0)
    _add_level("writing_level_1", 4.82, 6.75, 0.69, 3.15, materials, parts, front_windows=5, side_windows=4, door=True, balcony=False, open_front=True, timber_sides=True)
    _add_level("writing_level_2", 4.58, 6.48, 3.32, 5.82, materials, parts, front_windows=5, side_windows=4, door=True, balcony=True, open_front=True, timber_sides=True)
    # The long plan and Y-axis ridge distinguish the quiet藏书楼 from the
    # square main tower while retaining the same material language.
    _add_roof("writing_lower_eave", 5.96, 7.92, 3.08, 3.76, "y", materials, parts, ornament_scale=0.78)
    _add_roof("writing_top_lower", 5.96, 7.92, 5.72, 6.28, "y", materials, parts, ornament_scale=0.90)
    _add_roof("writing_top_upper", 5.66, 7.62, 6.08, 6.86, "y", materials, parts, ornament_scale=0.90)
    _snow_ribbon("writing", 5.66, 7.62, 6.08, 6.86, "y", materials, snow_parts)
    _snow_railing("writing_level_2", 4.58, 6.48, 4.15, materials, snow_parts)
    main = _join_parts(parts, "writing_building", "writing", "two-storey elongated 藏书楼")
    snow = _join_parts(snow_parts, "snow_writing_winter", "writing", "winter roof snow shelves")
    _mark_snow_hidden(snow, "writing")
    return main, snow


def build_about(materials: dict[str, bpy.types.Material]) -> tuple[bpy.types.Object, bpy.types.Object]:
    parts: list[bpy.types.Object] = []
    snow_parts: list[bpy.types.Object] = []
    width = depth = 4.82
    _add_base("about", width, depth, materials, parts, step_width=1.85)
    # An elevated timber floor and open frame keep the water pavilion light.
    _box("about_pavilion_floor", (0, 0, 0.78), (width - 0.15, depth - 0.15, 0.18), materials["wood_dark"], parts)
    _add_pavilion_frame("about_pavilion", 4.36, 4.36, 0.82, 3.16, materials, parts)
    _add_roof("about_lower_eave", 4.92, 4.92, 3.05, 3.56, "x", materials, parts, ornament_scale=0.88)
    _add_roof("about_upper_roof", 4.60, 4.60, 3.38, 4.42, "x", materials, parts, ornament_scale=0.86)
    _snow_ribbon("about", 4.60, 4.60, 3.38, 4.42, "x", materials, snow_parts)
    _snow_railing("about_pavilion", 4.36, 4.36, 1.66, materials, snow_parts)
    main = _join_parts(parts, "about_building", "about", "open 临水水榭 pavilion")
    snow = _join_parts(snow_parts, "snow_about_winter", "about", "winter roof snow shelves")
    _mark_snow_hidden(snow, "about")
    return main, snow


def build_projects(materials: dict[str, bpy.types.Material]) -> tuple[bpy.types.Object, bpy.types.Object]:
    parts: list[bpy.types.Object] = []
    snow_parts: list[bpy.types.Object] = []
    width, depth = 5.55, 4.62
    _add_base("projects", width, depth, materials, parts, step_width=2.0)
    _add_level("projects_level_1", 4.76, 3.86, 0.69, 2.70, materials, parts, front_windows=3, side_windows=1, door=True, balcony=True)
    # A low偏殿 with two eave tiers and broad front overhang, proportioned to
    # sit beside the central tower without competing with it.
    _add_roof("projects_lower_eave", 5.96, 5.02, 2.62, 3.18, "x", materials, parts, ornament_scale=0.82)
    _add_roof("projects_upper_roof", 5.58, 4.70, 3.08, 4.48, "x", materials, parts, ornament_scale=0.82)
    _snow_ribbon("projects", 5.58, 4.70, 3.08, 4.48, "x", materials, snow_parts)
    _snow_railing("projects_level_1", 4.76, 3.86, 1.52, materials, snow_parts)
    main = _join_parts(parts, "projects_building", "projects", "single-storey double-eave 偏殿")
    snow = _join_parts(snow_parts, "snow_projects_winter", "projects", "winter roof snow shelves")
    _mark_snow_hidden(snow, "projects")
    return main, snow


def _object_stats(obj: bpy.types.Object) -> dict[str, object]:
    obj.data.calc_loop_triangles()
    bounds = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    min_corner = Vector((min(point.x for point in bounds), min(point.y for point in bounds), min(point.z for point in bounds)))
    max_corner = Vector((max(point.x for point in bounds), max(point.y for point in bounds), max(point.z for point in bounds)))
    dimensions = max_corner - min_corner
    return {
        "vertices": len(obj.data.vertices),
        "triangles": len(obj.data.loop_triangles),
        "materials": len(obj.data.materials),
        "dimensions": (dimensions.x, dimensions.y, dimensions.z),
        "bytes": 0,
    }


def _export_glb(main: bpy.types.Object, snow: bpy.types.Object, filename: Path) -> None:
    """Export only this building and its winter node."""

    bpy.ops.object.select_all(action="DESELECT")
    snow.hide_set(False)
    snow.hide_viewport = False
    snow.hide_render = False
    main.select_set(True)
    snow.select_set(True)
    bpy.context.view_layer.objects.active = main
    props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    options = {
        "filepath": str(filename),
        "export_format": "GLB",
        "use_selection": True,
        "export_apply": True,
        "export_yup": True,
        "export_materials": "EXPORT",
        "export_cameras": False,
        "export_lights": False,
        "export_animations": False,
        "export_attributes": False,
        "export_extras": True,
        "export_image_format": "AUTO",
    }
    options = {key: value for key, value in options.items() if key in props}
    bpy.ops.export_scene.gltf(**options)
    snow.hide_render = True
    snow.hide_viewport = True
    snow.hide_set(True)
    main.select_set(False)
    snow.select_set(False)


def _write_report(stats: dict[str, dict[str, object]]) -> None:
    total_bytes = sum(int(item["bytes"]) for item in stats.values())
    total_triangles = sum(int(item["triangles"]) for item in stats.values())
    total_snow_triangles = sum(int(item.get("snow_triangles", 0)) for item in stats.values())
    lines = [
        "# Yuyan garden architecture assets",
        "",
        "These four GLB files are original procedural Blender meshes made for the personal homepage. No third-party model or texture is used.",
        "",
        "## Build and export",
        "",
        "```sh",
        "/private/tmp/yuyan-blender-mount/Blender.app/Contents/MacOS/Blender --background --python tools/build_architecture.py",
        "```",
        "",
        "Blender source scene: `/tmp/yuyan-garden-architecture.blend`.",
        "Assets use Blender Z-up while authoring, are centered at the origin, and face -Y. The exporter writes glTF Y-up. Each GLB has one explicitly merged building mesh with preserved per-face material slots plus one `snow_<building>_winter` node. The winter nodes carry `hide_by_default_in_web=true`; the homepage should traverse names beginning with `snow_` and set `visible=false` until winter is selected.",
        "",
        "## Measured output",
        "",
        "| GLB | Bounding size (W × D × H m) | Vertices | Triangles | Material slots | File size |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for name, item in stats.items():
        w, d, h = item["dimensions"]  # type: ignore[misc]
        lines.append(f"| `{name}.glb` | {w:.2f} × {d:.2f} × {h:.2f} | {item['vertices']:,} | {item['triangles']:,} | {item['materials']} | {item['bytes'] / 1024:.1f} KiB |" )
    lines.extend([
        "",
        f"Combined main-building triangles: **{total_triangles:,}**; seasonal snow nodes add **{total_snow_triangles:,}** triangles (**{total_triangles + total_snow_triangles:,}** including winter geometry). Combined GLB bytes: **{total_bytes / 1024:.1f} KiB**.",
        "",
        "### Material and draw-call note",
        "",
        "The meshes use the shared procedural palette `roof_slate`, `roof_rib`, `wood_cinnabar`, `wood_dark`, `wall_cream`, `stone`, `stone_dark`, and `snow`. The material-slot count in the table is the upper bound for the main building draw groups; the snow node adds one winter-only group. There are no external image textures.",
        "",
        "The roof surface is a curved shell with raised corner eaves. Tile courses span each full slope and radial ribs run from each eave toward the ridge on both sides, so the visible roof is covered across the full plane rather than carrying a small repeated patch.",
        "",
        "### Design mapping",
        "",
        "- `research.glb`: 3-storey 重檐歇山主阁, 9×6 class footprint, layered eaves and ridge ornaments.",
        "- `writing.glb`: elongated 2-storey 藏书楼, 6×8 class footprint, Y-axis ridge and repeated side lattice.",
        "- `about.glb`: open 5×5 临水水榭, eight-post frame, bench/table interior, fine railings.",
        "- `projects.glb`: 1-storey 6×5 偏殿, broad double eaves and compact courtyard façade.",
    ])
    report_path = WORKTREE / "design" / "ASSETS-models.md"
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    clear_scene()
    materials = create_materials()
    MATERIALS.update(materials)

    builders = [
        ("research", build_research),
        ("writing", build_writing),
        ("about", build_about),
        ("projects", build_projects),
    ]
    built: dict[str, tuple[bpy.types.Object, bpy.types.Object]] = {}
    for building_id, builder in builders:
        main_obj, snow_obj = builder(materials)
        built[building_id] = (main_obj, snow_obj)

    stats: dict[str, dict[str, object]] = {}
    for building_id, (main_obj, snow_obj) in built.items():
        path = MODEL_DIR / f"{building_id}.glb"
        _export_glb(main_obj, snow_obj, path)
        item = _object_stats(main_obj)
        item["bytes"] = path.stat().st_size
        item["snow_triangles"] = _object_stats(snow_obj)["triangles"]
        stats[building_id] = item

    # Save a source scene with snow nodes hidden.  This file stays outside the
    # static site and is useful when the next visual pass needs a quick rebuild.
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUTPUT))
    _write_report(stats)

    total_triangles = sum(int(item["triangles"]) for item in stats.values())
    total_bytes = sum(int(item["bytes"]) for item in stats.values())
    print("[yuyan-architecture] exported 4 buildings")
    for building_id, item in stats.items():
        w, d, h = item["dimensions"]  # type: ignore[misc]
        print(f"  {building_id}: {w:.2f}m x {d:.2f}m x {h:.2f}m, {item['triangles']:,} triangles, {item['materials']} materials, {item['bytes']:,} bytes")
    print(f"[yuyan-architecture] total triangles={total_triangles:,}, total bytes={total_bytes:,}")
    print(f"[yuyan-architecture] report={WORKTREE / 'ASSETS-models.md'}")
    print(f"[yuyan-architecture] blend={BLEND_OUTPUT}")


if __name__ == "__main__":
    main()
