import * as THREE from 'three';

/** Bộ map PBR của 1 "slot" vật liệu (floor, wall, concrete...) nạp từ manifest.textures. */
export interface PbrSet {
  map?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  aoMap?: THREE.Texture;
}

export interface TextureEntry {
  id: string;
  maps: Record<string, string>;
}

type MapKey = keyof PbrSet;
const KEY: Record<string, MapKey> = { diff: 'map', nor_gl: 'normalMap', rough: 'roughnessMap', ao: 'aoMap' };
const sets = new Map<string, PbrSet>();

/** Nạp mọi bộ texture khai báo trong manifest. Map màu là sRGB, các map dữ liệu giữ Linear. */
export async function loadPbrTextures(entries: Record<string, TextureEntry>, base = 'assets/'): Promise<void> {
  const loader = new THREE.TextureLoader();
  for (const [slot, entry] of Object.entries(entries)) {
    const set: PbrSet = {};
    for (const [name, path] of Object.entries(entry.maps)) {
      const key = KEY[name];
      if (!key) continue;
      try {
        const t = await loader.loadAsync(base + path);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 8;
        if (key === 'map') t.colorSpace = THREE.SRGBColorSpace;
        set[key] = t;
      } catch {
        console.warn(`[Materials] Không nạp được ${path}`);
      }
    }
    if (Object.keys(set).length) sets.set(slot, set);
  }
}

export function pbrSet(slot: string): PbrSet | null {
  return sets.get(slot) ?? null;
}

/**
 * Gắn bộ map vào vật liệu. `clone` = true khi mỗi mesh cần repeat riêng (texture clone dùng chung ảnh trên GPU).
 * Trả danh sách texture đã gắn để đổi repeat sau (setRepeat).
 */
export function applyPbr(mat: THREE.MeshStandardMaterial, set: PbrSet, keys: MapKey[], clone = false): THREE.Texture[] {
  const out: THREE.Texture[] = [];
  for (const k of keys) {
    const src = set[k];
    if (!src) continue;
    const t = clone ? src.clone() : src;
    mat[k] = t;
    out.push(t);
  }
  mat.needsUpdate = true;
  return out;
}

export function setRepeat(textures: THREE.Texture[], x: number, y: number): void {
  for (const t of textures) t.repeat.set(x, y);
}
