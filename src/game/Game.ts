import * as THREE from 'three';
import { PRODUCTS } from '../config/products';
import { bus } from '../core/EventBus';
import { createNewState, type SaveData, type Settings } from '../core/GameState';
import { SaveSystem } from '../core/SaveSystem';
import { Services, setServices } from '../core/Services';
import { Assets } from '../engine/Assets';
import { AudioEngine } from '../engine/Audio';
import { Input } from '../engine/Input';
import { Loop } from '../engine/Loop';
import { Renderer } from '../engine/Renderer';
import { Gallery } from '../products/Gallery';
import { labelTexture } from '../products/LabelTexture';
import { packaging } from '../products/PackagingFactory';
import { showMainMenu } from '../ui/menu';
import { slotCapacity } from '../systems/SlotLayout';
import { DebugPanel } from './Debug';
import { GameUI } from './GameUI';
import { World } from './World';

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
  private gallery: Gallery;
  private debug = new DebugPanel();
  private saves = new SaveSystem();
  private frameDt = 0;

  constructor(container: HTMLElement) {
    this.r = new Renderer(container);
    this.r.renderer.info.autoReset = false;
    this.input = new Input(this.r.canvas);
    this.audio = new AudioEngine(this.r.scene);
    this.r.camera.add(this.audio.listener);
    this.r.scene.add(this.r.camera);
    this.gallery = new Gallery(this.r.scene.environment);
    this.gallery.onClose = () => this.toggleGallery();
    this.loop = new Loop((dt) => this.update(dt), (dt) => this.render(dt));
    (window as unknown as { __game: Game }).__game = this;
  }

  get current(): World | null {
    return this.world;
  }

  async boot(): Promise<void> {
    this.assets.showLoading();
    await this.assets.run([
      ['Đang đọc danh sách asset', () => this.assets.loadManifest()],
      ['Đang in nhãn sản phẩm', () => { for (const p of PRODUCTS) labelTexture(p); }],
      ['Đang tạo bao bì 3D', () => { for (const p of PRODUCTS) packaging(p.id); }],
      ['Đang dựng cửa hàng', () => this.buildMenuWorld()],
      ['Đang biên dịch shader', () => this.r.renderer.compile(this.r.scene, this.r.camera)],
    ]);
    this.loop.start();
    this.assets.hideLoading();
    this.showMenu();
  }

  applySettings(st: Settings): void {
    this.audio.applySettings(st);
    if (this.r.quality !== st.quality) this.r.setQuality(st.quality);
    this.r.setFov(st.fov);
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
    const saved = this.saves.load();
    const settings = saved?.settings ?? { ...DEFAULT_SETTINGS };
    this.applySettings(settings);
    showMainMenu(
      {
        hasSave: !!saved && !saved.gameOver,
        onContinue: () => this.startSession(this.saves.load() ?? createNewState()),
        onNewGame: () => {
          this.saves.clear();
          const fresh = createNewState();
          fresh.settings = { ...settings };
          this.startSession(fresh);
        },
      },
      settings,
      (st) => {
        this.applySettings(st);
        if (saved) this.saves.save({ ...saved, settings: st });
      },
    );
  }

  startSession(data: SaveData): void {
    this.disposeWorld();
    bus.clear();
    this.audio.attach(bus);
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
      const c = new THREE.Vector3(W / 2, 1.1, D / 2);
      w.camera.position.set(c.x + Math.cos(this.orbit) * W * 0.32, 2.3, c.z + Math.sin(this.orbit) * D * 0.3);
      w.camera.lookAt(c);
    }
    w.update(dt, this.menu || !!this.ui?.isUiOpen() || this.gallery.active);
    this.ui?.update();
  }

  private render(dt: number): void {
    this.frameDt = dt;
    this.r.renderer.info.reset();
    if (this.gallery.active) this.gallery.render(this.r.renderer, dt);
    else this.r.render(dt);
    const w = this.world;
    if (w) {
      this.debug.update(dt, this.r.info, [
        `Player: (${w.player.x.toFixed(2)}, ${w.player.z.toFixed(2)}) yaw ${w.player.yaw.toFixed(2)}`,
        `Khách: ${w.customers.customers.length} · Món trên kệ: ${w.products.total} · Chế độ: ${w.mode}`,
      ]);
    }
  }

  get fps(): number {
    return this.debug.fps || Math.round(1 / Math.max(1e-3, this.frameDt));
  }
}
