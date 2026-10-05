import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PRODUCTS } from '../config/products';
import { productMesh } from '../products/PackagingFactory';
import { h } from './dom';

/**
 * Ảnh sản phẩm trong máy tính = chính mô hình 3D (bao bì + nhãn canvas) đang bày trên kệ, chụp sẵn thành ảnh PNG
 * trong suốt. Một renderer nhỏ riêng, chụp lười (vài ảnh mỗi khung hình) rồi cache theo id.
 */
const SIZE = 192;
const cache = new Map<string, string>();
const waiting = new Map<string, Job>();

interface Job {
  make: () => THREE.Object3D | null;
  imgs: HTMLImageElement[];
}

/** Nguồn model do Game đăng ký (cần asset đã nạp). Mô hình trả về dùng một lần, mặt trước hướng -Z. */
export interface ThumbSources {
  furniture(type: string): THREE.Object3D | null;
  vehicle(type: string, variant?: string): THREE.Object3D | null;
}
let sources: ThumbSources | null = null;
export function setThumbSources(src: ThumbSources): void {
  sources = src;
}
let queued = false;

interface Studio {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}
let studio: Studio | null | undefined;

function getStudio(): Studio | null {
  if (studio !== undefined) return studio;
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.9;
    const key = new THREE.DirectionalLight(0xfff1dc, 2.2);
    key.position.set(1.5, 2.5, 3);
    scene.add(key);
    studio = { renderer, scene, camera: new THREE.PerspectiveCamera(26, 1, 0.05, 200) };
  } catch {
    studio = null; // không tạo được WebGL thứ hai → dùng chữ thay ảnh
  }
  return studio;
}

/** Chụp một vật: mặt trước hướng về máy ảnh, xoay nhẹ 3/4 để thấy khối; lùi máy ảnh vừa khít khung. */
function render(obj: THREE.Object3D): string {
  const st = getStudio();
  if (!st) return '';
  const pack = new THREE.Group();
  pack.add(obj);
  pack.rotation.y = Math.PI - 0.5; // mặt trước gốc là -Z
  st.scene.add(pack);
  pack.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(pack);
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getBoundingSphere(new THREE.Sphere()).radius;
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  let dist = (r / Math.sin(THREE.MathUtils.degToRad(st.camera.fov / 2))) * 1.1;
  const place = () => {
    st.camera.position.set(c.x, c.y + r * 0.35, c.z + dist);
    st.camera.lookAt(c);
    st.camera.updateMatrixWorld(true);
    st.camera.updateProjectionMatrix();
  };
  // vật dẹt / cao: kéo máy ảnh lại gần tới khi chạm khung (tối đa 92% khung)
  for (let k = 0; k < 4; k++) {
    place();
    const m = Math.max(...corners.map((v) => { const p = v.clone().project(st.camera); return Math.max(Math.abs(p.x), Math.abs(p.y)); }));
    if (m > 0.98 || m < 0.88) dist *= Math.max(0.55, Math.min(1.5, m / 0.92));
  }
  place();
  st.renderer.render(st.scene, st.camera);
  const url = st.renderer.domElement.toDataURL('image/png');
  st.scene.remove(pack);
  return url;
}

function flush(): void {
  queued = false;
  let n = 0;
  for (const [key, job] of waiting) {
    if (n++ >= 3) break;
    waiting.delete(key);
    let url = cache.get(key);
    if (url === undefined) {
      const obj = job.make();
      url = obj ? render(obj) : '';
      cache.set(key, url);
    }
    for (const img of job.imgs) {
      if (url) img.src = url;
      else img.parentElement?.classList.add('no-thumb');
    }
  }
  if (waiting.size) schedule();
}

function schedule(): void {
  if (queued) return;
  queued = true;
  requestAnimationFrame(flush);
}

/**
 * Thẻ ảnh (img) chụp từ `make()`. Ảnh đã chụp thì hiện ngay, chưa thì chụp dần ở các khung hình sau.
 * `size`: cạnh hiển thị (px); `locked`: ảnh xám tối + ổ khoá; `fallback`: chữ thay ảnh khi không chụp được.
 */
function thumb(key: string, make: () => THREE.Object3D | null, size: number, locked: boolean, fallback = ''): HTMLElement {
  const img = h('img', { class: 'prod-thumb', attrs: { alt: '', draggable: 'false', width: String(size), height: String(size) } }) as HTMLImageElement;
  const url = cache.get(key);
  if (url) img.src = url;
  else {
    const job = waiting.get(key) ?? { make, imgs: [] };
    job.imgs.push(img);
    waiting.set(key, job);
    schedule();
  }
  const wrap = h('span', { class: `prod-thumb-wrap${locked ? ' locked' : ''}`, style: { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.6)}px` }, attrs: { 'data-fallback': fallback } }, [img]);
  if (locked) wrap.append(h('span', { class: 'prod-thumb-lock', text: '🔒' }));
  return wrap;
}

/** Ảnh sản phẩm (mô hình bao bì đúng như trên kệ). */
export function productImg(id: string, size = 56, locked = false): HTMLElement {
  return thumb(`p:${id}`, () => productMesh(id), size, locked);
}

/** Ảnh nội thất (mô hình 3D như khi đặt trong cửa hàng). */
export function furnitureImg(type: string, size = 84, locked = false, fallback = ''): HTMLElement {
  return thumb(`f:${type}`, () => sources?.furniture(type) ?? null, size, locked, fallback);
}

/** Ảnh xe theo kiểu xe (mô hình 3D xe cổ). */
export function vehicleImg(type: string, variant: string | undefined, size = 84, fallback = ''): HTMLElement {
  return thumb(`v:${type}:${variant ?? ''}`, () => sources?.vehicle(type, variant) ?? null, size, false, fallback);
}

/** Ảnh giấy phép: ba món hàng tiêu biểu của nhóm xếp chồng lên nhau như một xấp hàng mẫu. */
export function licenseImg(licenseId: number, size = 84, locked = false): HTMLElement {
  const list = PRODUCTS.filter((p) => p.licenseId === licenseId);
  const pick = list.length <= 3 ? list : [list[0], list[Math.floor(list.length / 2)], list[list.length - 1]];
  const k = size * 0.62;
  const wrap = h('span', { class: `prod-thumb-wrap license-thumb${locked ? ' locked' : ''}`, style: { width: `${size}px`, height: `${size}px` } });
  pick.forEach((p, i) => {
    const el = productImg(p.id, k, false);
    const off = pick.length === 1 ? 0.5 : i / (pick.length - 1);
    el.style.position = 'absolute';
    el.style.left = `${off * (size - k)}px`;
    el.style.top = `${(i === 1 ? 0 : 0.18) * size}px`;
    el.style.zIndex = String(i === 1 ? 2 : 1);
    wrap.append(el);
  });
  if (locked) wrap.append(h('span', { class: 'prod-thumb-lock', text: '🔒' }));
  return wrap;
}
