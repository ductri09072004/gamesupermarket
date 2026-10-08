import * as THREE from 'three';
import { PRODUCTS } from '../config/products';
import { bus } from '../core/EventBus';
import { ENV_INTENSITY, STORE_FRONT_Z } from '../config/constants';
import { nextLighter } from '../config/quality';
import { createDevState, createNewState, type SaveData, type Settings } from '../core/GameState';
import { saveSlots } from '../core/SaveSlots';
import { Services, setServices } from '../core/Services';
import { Assets } from '../engine/Assets';
import { AudioEngine } from '../engine/Audio';
import { Input } from '../engine/Input';
import { perf } from '../engine/Perf';
import { Loop } from '../engine/Loop';
import { Renderer } from '../engine/Renderer';
import { loadHdriEnvironment } from '../engine/Environment';
import { Gallery } from '../products/Gallery';
import { labelTexture } from '../products/LabelTexture';
import { packaging } from '../products/PackagingFactory';
import { buildVehicleModel } from '../entities/VehicleModels';
import { FurnitureView } from '../entities/Shelf';
import type { VehicleType } from '../config/vehicles';
import { showMainMenu } from '../ui/menu';
import { setThumbSources } from '../ui/productThumb';
import { slotCapacity } from '../systems/SlotLayout';
import { DebugPanel } from './Debug';
import { GameUI } from './GameUI';
import { World } from './World';
import { loadSignFonts } from '../world/SignFactory';
import { loadSignWear } from '../world/SignWear';

const DEFAULT_SETTINGS: Settings = createNewState(1).settings;

/** Khởi tạo engine, main menu (nền là cảnh cửa hàng, camera bay chậm), vào/thoát ván chơi. */
export class Game {
  readonly r: Renderer;
  readonly input: Input;
  readonly audio: AudioEngine;
  readonly assets = new Assets();
  private loop: Loop;
  private world: World | null = null;
  private ui: GameUI | null = null;
  private menu = false;
  private orbit = 0;
  private slowT = 0;
  private slowHinted = false;
  private gallery: Gallery;
  private debug = new DebugPanel();
  private frameDt = 0;
  /** CPU của logic (ms) cộng dồn giữa 2 lần vẽ — ghi vào bộ đo hiệu năng */
  private updMs = 0;

  constructor(container: HTMLElement) {
    this.r = new Renderer(container);
    this.r.renderer.info.autoReset = false;
    this.input = new Input(this.r.canvas);
    this.audio = new AudioEngine(this.r.scene);
    this.r.camera.add(this.audio.listener);
    this.r.scene.add(this.r.camera);
    this.gallery = new Gallery(this.r.scene.environment);
    this.gallery.onClose = () => this.toggleGallery();
    this.loop = new Loop((dt) => {
      const t = performance.now();
      this.update(dt);
      this.updMs += performance.now() - t;
    }, (dt) => this.render(dt));
    // ảnh nội thất / xe trong máy tính = chụp từ chính mô hình 3D (cần asset đã nạp nên tạo lười)
    setThumbSources({
      furniture: (type) => {
        const view = new FurnitureView({ uid: 'thumb', type, gx: 0, gy: 0, rot: 0, slots: [], boxes: [] }, this.assets, () => ({ price: 0, market: 0, cost: 0 }));
        view.root.remove(view.model);
        return view.model;
      },
      vehicle: (type, variant) => buildVehicleModel(type as VehicleType, variant).group,
    });
    perf.env = this.describeEnv();
    (window as unknown as { __game: Game }).__game = this;
  }

  get current(): World | null {
    return this.world;
  }

  async boot(): Promise<void> {
    this.assets.showLoading();
    await this.assets.run([
      ['Đang đọc danh sách asset', () => this.assets.loadManifest()],
      ['Đang nạp ánh sáng môi trường', () => this.loadEnvironment()],
      ['Đang nạp phông chữ biển hiệu', () => Promise.all([loadSignFonts(), loadSignWear()]).then(() => undefined)],
      ['Đang in nhãn sản phẩm', () => { for (const p of PRODUCTS) labelTexture(p); }],
      ['Đang tạo bao bì 3D', () => { for (const p of PRODUCTS) packaging(p.id); }],
      ['Đang dựng cửa hàng', () => this.buildMenuWorld()],
      ['Đang biên dịch shader', () => this.r.precompile()],
    ]);
    this.loop.start();
    this.assets.hideLoading();
    this.showMenu();
  }

  private async loadEnvironment(): Promise<void> {
    const url = this.assets.hdri;
    if (!url) return;
    const env = await loadHdriEnvironment(this.r.renderer, url);
    if (!env) return;
    this.r.setEnvironment(env, ENV_INTENSITY);
    this.gallery.setEnvironment(env);
  }

  applySettings(st: Settings): void {
    this.audio.applySettings(st);
    if (this.r.quality !== st.quality) {
      this.r.setQuality(st.quality);
      this.world?.rebuildCity(); // bán kính dựng phố & số đèn phụ thuộc mức đồ hoạ
    }
    this.r.setFov(st.fov);
    perf.env.quality = st.quality;
    if (this.world) {
      this.world.player.sensitivity = st.sensitivity;
      this.world.player.headbob = st.headbob;
    }
  }

  /** Cảnh nền main menu: cửa hàng mẫu đã bày hàng, có khách. */
  private buildMenuWorld(): void {
    this.disposeWorld();
    bus.clear();
    this.audio.attach(bus);
    saveSlots.setActive(null); // cảnh demo không ghi vào hồ sơ nào
    const demo = createNewState(7);
    demo.licenses = [0, 1];
    demo.storeOpen = true;
    demo.minutes = 17 * 60 + 30;
    const fill: Array<[number, string[]]> = [[0, ['noodles', 'chips', 'cookies', 'candy', 'rice', 'oil', 'soda', 'water']], [1, ['soda', 'water', 'chips', 'noodles', 'oil', 'rice', 'candy', 'cookies']], [2, ['milk', 'yogurt', 'juice', 'beer', 'cheese', 'eggs', 'milk', 'yogurt']]];
    for (const [fi, ids] of fill) demo.furniture[fi].slots.forEach((sl, i) => {
      sl.productId = ids[i % ids.length];
      sl.qty = slotCapacity(demo.furniture[fi].type, sl.productId);
    });
    const s = new Services(demo);
    this.world = new World(s, this.r, this.input, this.audio, this.assets);
    this.world.mode = 'modal';
    this.world.player.cameraOverride = true;
    this.menu = true;
  }

  private showMenu(): void {
    this.loop.setMaxFps(30);
    const last = saveSlots.lastSlot();
    const saved = last === null ? null : saveSlots.system(last).load();
    const settings = saved?.settings ?? { ...DEFAULT_SETTINGS };
    this.applySettings(settings);
    showMainMenu(
      {
        slots: () => saveSlots.list(),
        lastSlot: () => saveSlots.lastSlot(),
        onContinue: () => this.loadSlot(saveSlots.lastSlot()),
        onLoad: (slot) => this.loadSlot(slot),
        onDelete: (slot) => saveSlots.clear(slot),
        onNewGame: (slot) => this.newGame(createNewState(), settings, slot),
        onDevGame: (slot) => this.newGame(createDevState(), { ...settings, gameOverEnabled: false }, slot),
      },
      settings,
      (st) => {
        this.applySettings(st);
        if (saved && last !== null) saveSlots.system(last).save({ ...saved, settings: st });
      },
    );
  }

  private loadSlot(slot: number | null): void {
    const data = slot === null ? null : saveSlots.system(slot).load();
    if (data && slot !== null) this.startSession(data, slot);
  }

  private newGame(fresh: SaveData, settings: Settings, slot: number): void {
    saveSlots.clear(slot);
    fresh.settings = { ...settings };
    this.startSession(fresh, slot);
    this.world?.s.save(); // giữ chỗ hồ sơ ngay, không đợi lần lưu đầu
  }

  /** slot: hồ sơ ghi tiến trình ván này (bỏ trống → hồ sơ gần nhất, hoặc ô trống đầu tiên) */
  startSession(data: SaveData, slot: number | null = saveSlots.lastSlot() ?? saveSlots.firstEmpty() ?? 1): void {
    this.loop.setMaxFps(60);
    this.disposeWorld();
    bus.clear();
    perf.listen(bus);
    this.audio.attach(bus);
    saveSlots.setActive(slot);
    const s = new Services(data);
    setServices(s);
    this.menu = false;
    this.world = new World(s, this.r, this.input, this.audio, this.assets);
    this.applySettings(data.settings);
    this.ui = new GameUI(this.world, {
      applySettings: (st) => this.applySettings(st),
      quitToMenu: () => this.quitToMenu(),
      toggleGallery: () => this.toggleGallery(),
      toggleDebug: () => this.world?.customers.setDebug(this.debug.toggle()),
    });
    // biên dịch trước shader của TOÀN BỘ cảnh (kể cả phố ngoài tầm nhìn): không thì lần đầu quay camera / lên xe
    // lòi ra vật liệu mới, three.js biên dịch lúc đó làm màn hình đứng hình cả giây
    this.r.precompile();
    // lần nữa sau khi đèn / hàng hoá / phố đã dựng xong (trạng thái đèn đổi → biến thể shader đổi theo)
    const world = this.world;
    window.setTimeout(() => { if (this.world === world) this.r.precompile(); }, 1500);
  }

  quitToMenu(): void {
    this.disposeWorld();
    setServices(null);
    document.querySelectorAll('#ui-root > *').forEach((el) => el.remove());
    this.debug = new DebugPanel();
    this.buildMenuWorld();
    this.showMenu();
  }

  private disposeWorld(): void {
    this.ui?.destroy();
    this.ui = null;
    this.world?.destroy();
    this.world = null;
  }

  toggleGallery(): void {
    if (this.gallery.active) {
      this.gallery.close();
      this.ui?.setModal('gallery', false);
      this.ui?.relock();
    } else {
      this.ui?.setModal('gallery', true);
      this.gallery.open();
    }
  }

  private update(dt: number): void {
    const w = this.world;
    if (!w) return;
    if (this.menu) {
      this.orbit += dt * 0.06;
      const { W, D } = w.store;
      // phần cửa hàng đã mở khoá nằm sát mặt tiền cố định (z từ FRONT − D tới FRONT)
      const c = new THREE.Vector3(W / 2, 1.1, STORE_FRONT_Z - D / 2);
      w.camera.position.set(c.x + Math.cos(this.orbit) * W * 0.32, 2.3, c.z + Math.sin(this.orbit) * D * 0.3);
      w.camera.lookAt(c);
    }
    w.update(dt, this.menu || !!this.ui?.isUiOpen() || this.gallery.active);
    this.ui?.update(dt);
  }

  /** Máy chậm kéo dài (khung hình > 45ms trong ~8s chơi) → gợi ý chuyển sang chế độ nhẹ hơn, đúng một lần mỗi phiên. */
  private watchSlow(dt: number): void {
    if (this.slowHinted || this.menu || !this.world) return;
    const lighter = nextLighter(this.world.s.data.settings.quality);
    if (!lighter) return;
    this.slowT = Math.max(0, this.slowT + (dt > 0.045 ? dt : -dt * 2));
    if (this.slowT < 8) return;
    this.slowHinted = true;
    const name = { lite: 'Siêu nhẹ', low: 'Thấp', medium: 'Trung', high: 'Cao' }[lighter];
    bus.emit('toast', { message: `Máy đang chạy chậm — thử Cài đặt → Chất lượng → ${name} cho mượt hơn.`, kind: 'info' });
  }

  private render(dt: number): void {
    this.frameDt = dt;
    this.watchSlow(dt);
    this.r.renderer.info.reset();
    const t0 = performance.now();
    if (this.gallery.active) this.gallery.render(this.r.renderer, dt);
    else {
      this.world?.city.culling.update(this.r.camera);
      this.r.render(dt);
    }
    perf.frame(this.updMs, performance.now() - t0, this.r.info.render.calls, this.r.info.render.triangles);
    this.updMs = 0;
    const w = this.world;
    if (w) {
      this.debug.update(dt, this.r.info, [
        `Player: (${w.player.x.toFixed(2)}, ${w.player.z.toFixed(2)}) yaw ${w.player.yaw.toFixed(2)}`,
        `Khách: ${w.customers.customers.length} · Món trên kệ: ${w.products.total} · Chế độ: ${w.mode}`,
      ]);
    }
  }

  /** Máy / GPU / chất lượng đồ hoạ — đính vào báo cáo hiệu năng (laptop 2 GPU: xem trình duyệt đang dùng GPU nào). */
  private describeEnv(): Record<string, unknown> {
    const gl = this.r.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const nav = navigator as Navigator & { deviceMemory?: number };
    return {
      gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'không đọc được',
      gpuVendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '',
      webgl: gl.getParameter(gl.VERSION),
      cores: nav.hardwareConcurrency,
      memoryGB: nav.deviceMemory,
      devicePixelRatio: window.devicePixelRatio,
      screen: `${screen.width}x${screen.height}`,
      viewport: `${innerWidth}x${innerHeight}`,
      userAgent: nav.userAgent,
    };
  }

  get fps(): number {
    return this.debug.fps || Math.round(1 / Math.max(1e-3, this.frameDt));
  }
}
