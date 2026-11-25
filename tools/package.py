"""Build dist/RemoteLens-<version>.eagleplugin from the plugin folder.

An .eagleplugin file is a zip archive with the plugin's files at its root
(manifest.json, index.html, ...). Run:  python tools/package.py
"""
from __future__ import annotations

import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLUGIN = ROOT / "RemoteLens"
SKIP_NAMES = {"window-state.json", ".DS_Store", "Thumbs.db"}


def collect(folder: Path) -> list[Path]:
    """Every file of the plugin, in a stable order, without editor or OS leftovers."""
    return sorted(
        path
        for path in folder.rglob("*")
        if path.is_file() and path.name not in SKIP_NAMES and not any(part.startswith(".") for part in path.parts)
    )


def build() -> Path:
    manifest = json.loads((PLUGIN / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("devTools"):
        raise SystemExit("manifest.json: devTools must be false in a release")
    target = ROOT / "dist" / f"RemoteLens-{manifest['version']}.eagleplugin"
    target.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in collect(PLUGIN):
            archive.write(path, path.relative_to(PLUGIN).as_posix())
        archive.write(ROOT / "LICENSE", "LICENSE")
    return target


if __name__ == "__main__":
    built = build()
    with zipfile.ZipFile(built) as archive:
        names = archive.namelist()
    print(f"{built}  ({built.stat().st_size / 1024:.0f} KB, {len(names)} files)")
    for name in names:
        print("  " + name)
