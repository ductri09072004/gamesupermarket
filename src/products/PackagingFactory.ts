import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getProduct, type ProductDef } from '../config/products';
import { capParts, garmentParts } from './Apparel';
import { labelTexture } from './LabelTexture';
import { crinkleNormal, dentNormal, grainRoughness, paperNormal } from './PackagingFx';

export interface Packaging {
  geometry: THREE.BufferGeometry;
  materials: THREE.Material[];
}

const cache = new Map<string, Packaging>();
const metal = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.85, roughness: 0.3 });

/** Chỉ giữ position/normal/uv để merge được, gán materialIndex cho cả geometry. */
function part(g: THREE.BufferGeometry, materialIndex: number): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
  geo.clearGroups();
  geo.addGroup(0, geo.attributes.position.count, materialIndex);
  return geo;
}

/** Ghép nhiều phần (mỗi phần 1 vật liệu) thành 1 geometry; group theo materialIndex của từng phần. */
function combine(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false)!;
  merged.clearGroups();
  let start = 0;
  for (const p of parts) {
    const count = p.attributes.position.count;
    merged.addGroup(start, count, p.groups[0]?.materialIndex ?? 0);
    start += count;
  }
  return merged;
}

/** Hộp: nhãn ở mặt trước (-Z), các mặt còn lại màu nền. Box groups: +x,-x,+y,-y,+z,-z. */
function boxGeo(w: number, h: number, d: number, radius: number): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 4, h / 4, d / 4));
  g.translate(0, h / 2, 0);
  g.rotateY(Math.PI); // mặt +z của BoxGeometry (nhãn đẹp, UV thuận) quay về -Z
  return g;
}

function paperMat(color: string, rough = 0.75): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
}

type Surface = 'paper' | 'plastic' | 'metal';

/** Gắn hạt nhiễu theo chất liệu: giấy có thớ, ni-lông nhăn, kim loại lõm xước; độ nhám loang để phản chiếu không đều. */
function surface(m: THREE.MeshStandardMaterial, kind: Surface, repeat = 2): THREE.MeshStandardMaterial {
  const n = kind === 'plastic' ? crinkleNormal() : kind === 'metal' ? dentNormal() : paperNormal();
  m.normalMap = n.clone();
  m.normalMap.repeat.set(repeat, repeat);
  m.normalMap.needsUpdate = true;
  m.normalScale.setScalar(kind === 'plastic' ? 0.9 : kind === 'metal' ? 0.35 : 0.3);
  m.roughnessMap = grainRoughness().clone();
  m.roughnessMap.repeat.set(repeat, repeat);
  m.roughnessMap.needsUpdate = true;
  m.envMapIntensity = kind === 'paper' ? 0.6 : 1.1;
  return m;
}

function labelMat(p: ProductDef, opts: THREE.MeshStandardMaterialParameters = {}, kind: Surface = 'paper'): THREE.MeshStandardMaterial {
  return surface(new THREE.MeshStandardMaterial({ map: labelTexture(p), roughness: 0.55, metalness: 0, ...opts }), kind);
}

/** Chai thuỷ tinh có màu (nước mắm, bia, rượu vang...) — còn lại là chai nhựa. */
const GLASS: Record<string, { tint: number; cap: number }> = {
  fishsauce: { tint: 0x7a4a14, cap: 0xd8b04a }, beer: { tint: 0x6b3f10, cap: 0xc9a227 }, wine: { tint: 0x23401c, cap: 0x8c1d1d }, ketchup: { tint: 0x7a2a1c, cap: 0xb8402d },
};

function build(p: ProductDef): Packaging {
  const [w, h, d] = p.size;
  const r = Math.min(w, d) / 2;
  const side = paperMat(p.label.bg);
  const accent = paperMat(p.label.accent, 0.4);
  switch (p.shape) {
    case 'box': {
      const g = boxGeo(w, h, d, 0.006);
      // Sau khi xoay: group 4 (+z gốc) thành mặt trước -Z
      return { geometry: g, materials: [side, side, side, side, labelMat(p, { roughness: 0.7 }), side].map((m, i) => (i === 4 ? m : surface(m.clone() as THREE.MeshStandardMaterial, 'paper'))) };
    }
    case 'bag': {
      const g = new THREE.BoxGeometry(w, h, d, 8, 10, 2);
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) / (w / 2);
        const y = pos.getY(i) / (h / 2);
        const z = pos.getZ(i);
        const puff = (1 - x * x) * (1 - Math.pow(Math.abs(y), 4));
        const crimp = Math.abs(y) > 0.86 ? 0.15 : 1;
        pos.setZ(i, z * (0.35 + puff * 0.9) * crimp);
        if (Math.abs(y) > 0.97) pos.setY(i, pos.getY(i) + Math.sin(x * 30) * 0.003);
      }
      g.computeVertexNormals();
      g.translate(0, h / 2, 0);
      g.rotateY(Math.PI);
      const lm = labelMat(p, { roughness: 0.35, metalness: 0.15 }, 'plastic');
      return { geometry: g, materials: [side, side, side, side, lm, lm] };
    }
    case 'can': {
      const body = new THREE.CylinderGeometry(r, r, h * 0.84, 28, 1, true);
      body.translate(0, h * 0.5, 0);
      const top = new THREE.CylinderGeometry(r * 0.82, r, h * 0.08, 28);
      top.translate(0, h * 0.96, 0);
      const bottom = new THREE.CylinderGeometry(r, r * 0.8, h * 0.08, 28);
      bottom.translate(0, h * 0.04, 0);
      const rim = new THREE.TorusGeometry(r * 0.8, r * 0.05, 6, 28);
      rim.rotateX(Math.PI / 2);
      rim.translate(0, h, 0);
      const geo = combine([part(body, 0), part(top, 1), part(bottom, 1), part(rim, 1)]);
      return { geometry: geo, materials: [labelMat(p, { metalness: 0.6, roughness: 0.3 }, 'metal'), metal] };
    }
    case 'bottle': {
      const pts: THREE.Vector2[] = [];
      const prof: Array<[number, number]> = [[0, 0], [0.92, 0], [1, 0.03], [1, 0.62], [0.95, 0.7], [0.55, 0.82], [0.36, 0.88], [0.36, 0.9]];
      for (const [px, py] of prof) pts.push(new THREE.Vector2(px * r, py * h));
      const body = new THREE.LatheGeometry(pts, 28);
      const band = new THREE.CylinderGeometry(r * 1.01, r * 1.01, h * 0.34, 28, 1, true);
      band.translate(0, h * 0.35, 0);
      const cap = new THREE.CylinderGeometry(r * 0.4, r * 0.4, h * 0.1, 20);
      cap.translate(0, h * 0.95, 0);
      const clear = p.id === 'water';
      const glass = GLASS[p.id];
      const bodyMat = glass
        ? new THREE.MeshStandardMaterial({ color: glass.tint, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.86, envMapIntensity: 1.6 })
        : surface(new THREE.MeshStandardMaterial({
          color: clear ? 0xeaf7ff : p.color, roughness: 0.2, metalness: 0, transparent: clear, opacity: clear ? 0.38 : 1,
        }), 'plastic', 3);
      const capMat = glass
        ? new THREE.MeshStandardMaterial({ color: glass.cap, roughness: 0.3, metalness: 0.9 })
        : new THREE.MeshStandardMaterial({ color: p.label.accent, roughness: 0.4 });
      const geo = combine([part(body, 1), part(band, 0), part(cap, 2)]);
      return { geometry: geo, materials: [labelMat(p, { roughness: 0.35 }, 'plastic'), bodyMat, capMat] };
    }
    case 'jar': {
      const body = new THREE.CylinderGeometry(r * 0.98, r * 0.92, h * 0.8, 28, 1, true);
      body.translate(0, h * 0.4, 0);
      const bottom = new THREE.CircleGeometry(r * 0.92, 28);
      bottom.rotateX(Math.PI / 2);
      const lid = new THREE.CylinderGeometry(r, r, h * 0.2, 28);
      lid.translate(0, h * 0.9, 0);
      const geo = combine([part(body, 0), part(bottom, 1), part(lid, 1)]);
      return { geometry: geo, materials: [labelMat(p, { roughness: 0.3 }, 'plastic'), accent] };
    }
    case 'carton': {
      const bodyH = h * 0.8;
      const body = boxGeo(w, bodyH, d, 0.003);
      const tri = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, h * 0.16)]);
      const gable = new THREE.ExtrudeGeometry(tri, { depth: w, bevelEnabled: false });
      gable.rotateY(Math.PI / 2);
      gable.translate(-w / 2, bodyH, 0);
      const fin = new THREE.BoxGeometry(w, h * 0.04, 0.004);
      fin.translate(0, h * 0.98, 0);
      const cap = new THREE.CylinderGeometry(r * 0.25, r * 0.25, 0.012, 14);
      cap.rotateX(Math.PI / 2);
      cap.translate(w * 0.2, bodyH + h * 0.06, -d * 0.26);
      const bodyParts = part(body, 0);
      // nhãn trên mặt trước (group gốc +z sau khi xoay = -Z) — dùng UV của cả hộp cho đơn giản
      const geo = combine([bodyParts, part(gable, 1), part(fin, 1), part(cap, 2)]);
      return { geometry: geo, materials: [labelMat(p, { roughness: 0.6 }), surface(side.clone(), 'paper'), accent] };
    }
    case 'tube': {
      const body = new THREE.CylinderGeometry(r, r, h * 0.82, 24, 4, true);
      const pos = body.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const t = (pos.getY(i) + h * 0.41) / (h * 0.82);
        pos.setZ(i, pos.getZ(i) * (1 - t * 0.85));
        pos.setX(i, pos.getX(i) * (1 + t * 0.35));
      }
      body.computeVertexNormals();
      body.translate(0, h * 0.53, 0);
      const cap = new THREE.CylinderGeometry(r * 0.7, r * 0.75, h * 0.12, 18);
      cap.translate(0, h * 0.06, 0);
      const crimp = new THREE.BoxGeometry(r * 2.7, h * 0.06, r * 0.3);
      crimp.translate(0, h * 0.97, 0);
      const geo = combine([part(body, 0), part(cap, 1), part(crimp, 2)]);
      return { geometry: geo, materials: [labelMat(p, { roughness: 0.4 }, 'plastic'), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }), side] };
    }
    case 'garment':
    case 'pants':
    case 'cap': {
      const a = p.shape === 'cap' ? capParts(p) : garmentParts(p);
      return { geometry: combine(a.parts.map(([g, i]) => part(g, i))), materials: a.materials };
    }
  }
}

/** Geometry + vật liệu của sản phẩm (cache theo id). Gốc ở giữa đáy, mặt trước -Z. */
export function packaging(productId: string): Packaging {
  let p = cache.get(productId);
  if (!p) {
    p = build(getProduct(productId));
    p.geometry.computeBoundingSphere();
    cache.set(productId, p);
  }
  return p;
}

/** Mesh độc lập (cho vật đang bay, gallery, giỏ khách...). */
export function productMesh(productId: string): THREE.Mesh {
  const pk = packaging(productId);
  const m = new THREE.Mesh(pk.geometry, pk.materials);
  m.castShadow = true;
  return m;
}
