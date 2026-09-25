#!/usr/bin/env python3
"""Tải HDRI / texture PBR CC0 từ Poly Haven vào public/assets và đăng ký vào manifest.json + CREDITS.md.

Ví dụ:
  python3 fetch_polyhaven.py list --type hdris --search studio
  python3 fetch_polyhaven.py hdri brown_photostudio_02 --res 1k
  python3 fetch_polyhaven.py texture floor_tiles_06 --slot floor --res 1k
  python3 fetch_polyhaven.py texture metal_plate --slot metal --maps diff nor_gl rough

Dùng curl (tôn trọng HTTPS_PROXY / CA của môi trường). Cần mở mạng tới api.polyhaven.com và dl.polyhaven.org.
"""
import argparse
import json
import os
import subprocess
import sys

API = "https://api.polyhaven.com"
UA = "MiniMartTycoon3D-asset-fetch/1.0"
# Tên map trong API Poly Haven -> hậu tố file của dự án
MAP_KEYS = {"diff": "Diffuse", "nor_gl": "nor_gl", "rough": "Rough", "ao": "AO", "arm": "arm", "disp": "Displacement"}


def repo_root() -> str:
    d = os.path.dirname(os.path.abspath(__file__))
    while d != "/" and not os.path.exists(os.path.join(d, "package.json")):
        d = os.path.dirname(d)
    if d == "/":
        sys.exit("Không tìm thấy package.json — chạy script bên trong repo game.")
    return d


def curl_json(url: str):
    r = subprocess.run(["curl", "-sSfL", "-m", "30", "-A", UA, url], capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"Lỗi tải {url}: {r.stderr.strip()}\n→ Có thể mạng đang chặn host này; cần mở api.polyhaven.com / dl.polyhaven.org.")
    return json.loads(r.stdout)


def curl_file(url: str, dest: str) -> None:
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    r = subprocess.run(["curl", "-sSfL", "-m", "300", "-A", UA, "-o", dest, url], capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"Lỗi tải {url}: {r.stderr.strip()}")
    print(f"  ✓ {os.path.relpath(dest, repo_root())} ({os.path.getsize(dest) // 1024} KB)")


def load_manifest(root: str) -> dict:
    p = os.path.join(root, "public/assets/manifest.json")
    try:
        with open(p) as f:
            return json.load(f)
    except FileNotFoundError:
        return {"models": []}


def save_manifest(root: str, m: dict) -> None:
    with open(os.path.join(root, "public/assets/manifest.json"), "w") as f:
        json.dump(m, f, indent=2, ensure_ascii=False)
        f.write("\n")


def credit(root: str, files: list, asset_id: str) -> None:
    p = os.path.join(root, "public/assets/CREDITS.md")
    existing = open(p).read() if os.path.exists(p) else "# Credits\n\n| File | Nguồn | License |\n| --- | --- | --- |\n"
    rows = [f"| `{f}` | Poly Haven — https://polyhaven.com/a/{asset_id} | CC0 |" for f in files if f"`{f}`" not in existing]
    if rows:
        with open(p, "w") as fh:
            fh.write(existing.rstrip("\n") + "\n" + "\n".join(rows) + "\n")


def cmd_list(a) -> None:
    data = curl_json(f"{API}/assets?t={a.type}")
    q = (a.search or "").lower()
    hits = [(k, v) for k, v in data.items() if not q or q in k or q in " ".join(v.get("tags", [])) or q in " ".join(v.get("categories", []))]
    for k, v in sorted(hits, key=lambda kv: -kv[1].get("download_count", 0))[: a.limit]:
        print(f"{k:40} {', '.join(v.get('categories', [])[:4])}")


def cmd_hdri(a) -> None:
    root = repo_root()
    files = curl_json(f"{API}/files/{a.id}")
    try:
        url = files["hdri"][a.res]["hdr"]["url"]
    except KeyError:
        sys.exit(f"{a.id} không có HDRI {a.res}. Có: {list(files.get('hdri', {}).keys())}")
    rel = f"hdri/{a.id}_{a.res}.hdr"
    curl_file(url, os.path.join(root, "public/assets", rel))
    m = load_manifest(root)
    m["hdri"] = rel
    save_manifest(root, m)
    credit(root, [rel], a.id)


def cmd_texture(a) -> None:
    root = repo_root()
    files = curl_json(f"{API}/files/{a.id}")
    maps = {}
    for key in a.maps:
        api_key = MAP_KEYS[key]
        try:
            url = files[api_key][a.res]["jpg"]["url"]
        except KeyError:
            print(f"  – bỏ qua {key}: không có {api_key} {a.res} jpg")
            continue
        rel = f"textures/{a.slot}/{a.id}_{a.res}_{key}.jpg"
        curl_file(url, os.path.join(root, "public/assets", rel))
        maps[key] = rel
    if not maps:
        sys.exit("Không tải được map nào.")
    m = load_manifest(root)
    m.setdefault("textures", {})[a.slot] = {"id": a.id, "maps": maps}
    save_manifest(root, m)
    credit(root, list(maps.values()), a.id)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("list", help="Liệt kê asset")
    p.add_argument("--type", choices=["hdris", "textures", "models"], default="hdris")
    p.add_argument("--search")
    p.add_argument("--limit", type=int, default=25)
    p.set_defaults(fn=cmd_list)
    p = sub.add_parser("hdri", help="Tải HDRI làm scene.environment")
    p.add_argument("id")
    p.add_argument("--res", default="1k")
    p.set_defaults(fn=cmd_hdri)
    p = sub.add_parser("texture", help="Tải bộ texture PBR cho 1 slot vật liệu")
    p.add_argument("id")
    p.add_argument("--slot", required=True, help="floor, wall, ceiling, metal, wood, concrete...")
    p.add_argument("--res", default="1k")
    p.add_argument("--maps", nargs="+", default=["diff", "nor_gl", "rough", "ao"], choices=list(MAP_KEYS))
    p.set_defaults(fn=cmd_texture)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
