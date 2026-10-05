import { createDevState } from '../core/GameState';
import { perf } from '../engine/Perf';
import { forward } from '../systems/VehicleDrive';
import { summarize, verdict } from '../systems/PerfStats';
import { h, uiRoot } from '../ui/dom';
import { nearestD } from './TrafficKnock';
import { poseAt, type Route } from '../world/CityRoutes';
import type { Game } from './Game';
import type { World } from './World';

/**
 * Bench tự động: mở web với ?bench=drive. Game tự vào ván developer, chạy một kịch bản cố định (đứng trong tiệm → mở cửa cho khách →
 * máy tính → xây dựng → mua xe và lái một vòng phố bằng lái tự động → xuống xe), ghi thời gian từng khung rồi in báo cáo + tải file JSON.
 * Mọi lần chạy cùng kịch bản nên so sánh được trước / sau khi tối ưu.
 */

const CRUISE = 11; // m/s ≈ 40 km/h
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface Phase {
  name: string;
  from: number;
  to: number;
}

class Runner {
  private phases: Phase[] = [];
  private status = h('div', { class: 'bench-status' });

  constructor(private game: Game) {
    uiRoot().append(this.status);
  }

  say(text: string): void {
    this.status.textContent = `BENCH · ${text}`;
  }

  /** Chạy 1 pha: gắn nhãn, chạy hành động, ghi lại khoảng khung của pha đó. */
  async phase(name: string, run: () => Promise<void>): Promise<void> {
    this.say(name);
    perf.mark(name);
    const from = perf.ms.length;
    await run();
    this.phases.push({ name, from, to: perf.ms.length });
  }

  get world(): World {
    return this.game.current!;
  }

  finish(label: string): void {
    this.status.remove();
    const all = summarize(perf.ms);
    const v = verdict(all);
    const rows = this.phases.map((p) => {
      const s = summarize(perf.ms.slice(p.from, p.to));
      return `<tr><td>${p.name}</td><td>${s.avgFps.toFixed(0)} FPS</td><td>1% ${s.lowFps.toFixed(0)}</td><td>${s.worstMs.toFixed(0)}ms</td></tr>`;
    }).join('');
    const box = h('div', { class: `bench-result ${v.pass ? '' : 'fail'}` });
    box.innerHTML = `<h3>${v.pass ? '✔ Đạt 60 FPS ổn định' : '✘ Chưa đạt 60 FPS ổn định'}</h3>
      <div>${all.frames} khung · ${all.seconds.toFixed(0)} giây · TB ${all.avgFps.toFixed(1)} FPS · 1% thấp ${all.lowFps.toFixed(0)} FPS · tệ nhất ${all.worstMs.toFixed(0)}ms</div>
      <table><tr><td><b>Pha</b></td><td><b>FPS</b></td><td><b>1% thấp</b></td><td><b>Khung tệ nhất</b></td></tr>${rows}</table>
      ${v.issues.map((i) => `<div class="issue">• ${i}</div>`).join('')}
      <div style="margin-top:8px">GPU: ${String(perf.env.gpu ?? '?')}<br>Báo cáo JSON đã được tải về — gửi file đó cho tôi để phân tích.</div>`;
    box.append(h('button', { class: 'btn', text: 'Tải lại báo cáo', onClick: () => perf.download(label) }), h('button', { class: 'btn', text: 'Đóng', onClick: () => box.remove() }));
    uiRoot().append(box);
    (window as unknown as { __bench: unknown }).__bench = { summary: all, verdict: v, phases: this.phases };
    perf.download(label);
  }
}

/** Tay lái tự động: bám tim làn của tuyến xe NPC đầu tiên, giữ ~40 km/h. */
function autopilot(w: World, route: Route, ms: number): Promise<void> {
  const keys = w.input.keys;
  const end = performance.now() + ms;
  let d = 0;
  let frame = 0;
  return new Promise((resolve) => {
    const tick = () => {
      const st = w.driving.state;
      if (frame++ % 6 === 0) d = nearestD(route, st.x, st.z);
      const t = poseAt(route, d + 7);
      const f = forward(st.yaw);
      // phía bên trái của xe = (f.z, -f.x)
      const side = (t.x - st.x) * f.z + (t.z - st.z) * -f.x;
      keys.simulate('KeyA', side > 0.35);
      keys.simulate('KeyD', side < -0.35);
      keys.simulate('KeyW', st.speed < CRUISE);
      if (performance.now() < end) requestAnimationFrame(tick);
      else {
        for (const k of ['KeyA', 'KeyD', 'KeyW']) keys.simulate(k, false);
        resolve();
      }
    };
    tick();
  });
}

async function driveScenario(game: Game): Promise<void> {
  const run = new Runner(game);
  const w = run.world;
  const s = w.s;
  const keys = w.input.keys;
  document.querySelector('.click-to-play')?.remove();
  document.querySelector('.tutorial')?.remove();
  perf.reset();
  perf.mark('bắt đầu bench');

  await run.phase('1. Đứng trong tiệm (nền)', () => sleep(6000));

  await run.phase('2. Mở cửa, khách vào mua', async () => {
    s.data.storeOpen = true;
    s.bus.emit('store:toggled', { open: true });
    s.time.setSpeed(3);
    await sleep(14000);
  });

  await run.phase('3. Mở / đóng máy tính', async () => {
    s.bus.emit('ui:openPc', { app: 'market' });
    await sleep(2500);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
    await sleep(1500);
  });

  const route = (w.life.traffic as unknown as { routes: Route[] }).routes[0];
  let uid = '';
  await run.phase('5. Mua xe', async () => {
    const p = poseAt(route, 0);
    const res = s.vehicles.buy('car', { x: p.x, z: p.z, yaw: Math.atan2(-p.dx, -p.dz) });
    uid = res.vehicle?.uid ?? '';
    w.vehicles.update(0.016, null);
    await sleep(1500);
  });

  await run.phase('6. Lên xe', async () => {
    w.driving.enter(uid);
    await sleep(2500);
  });

  await run.phase('7. Lái một vòng phố', () => autopilot(w, route, 30000));

  await run.phase('8. Xuống xe', async () => {
    keys.simulate('Space', true);
    for (let i = 0; i < 60 && Math.abs(w.driving.state.speed) > 1; i++) await sleep(100);
    keys.simulate('Space', false);
    w.driving.exit();
    await sleep(3000);
  });

  s.time.setSpeed(1);
  run.finish('bench drive');
}

/** Khởi chạy bench theo tên kịch bản ('drive'). Không ghi đè bản lưu nào. */
export async function runBench(game: Game, name: string): Promise<void> {
  document.querySelector('.main-menu')?.remove();
  game.startSession(createDevState(), null);
  await sleep(2500); // chờ dựng xong + biên dịch shader
  if (name === 'drive') await driveScenario(game);
}
