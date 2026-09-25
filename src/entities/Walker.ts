import * as THREE from 'three';
import type { Services } from '../core/Services';
import type { GridPoint } from '../world/Footprint';
import { cellCenter, worldToCell } from '../world/NavGrid';
import { smoothPath } from '../world/Pathfinding';
import type { HumanBody, HumanLook } from './Human';
import { createHuman } from './RiggedHuman';
import { Bubble } from './Bubble';

/** Nhân vật NPC đi theo đường A* (đã làm mượt), xoay người mượt về hướng đi. */
export class Walker {
  readonly human: HumanBody;
  readonly bubble: Bubble;
  x: number;
  z: number;
  heading = 0;
  private points: THREE.Vector2[] = [];
  private idx = 0;
  goal: GridPoint | null = null;
  private stuck = 0;
  faceTarget: number | null = null;

  constructor(protected s: Services, look: HumanLook, x: number, z: number) {
    this.x = x;
    this.z = z;
    this.human = createHuman(look);
    this.bubble = new Bubble(this.human.root, 2.05);
    this.sync();
  }

  get cell(): GridPoint {
    return worldToCell(this.x, this.z);
  }

  get moving(): boolean {
    return this.idx < this.points.length;
  }

  get remaining(): THREE.Vector2[] {
    return this.points.slice(this.idx);
  }

  walkTo(goals: GridPoint | GridPoint[]): boolean {
    const path = this.s.paths.find(this.cell, goals);
    this.faceTarget = null;
    if (!path) {
      this.points = [];
      this.idx = 0;
      this.goal = Array.isArray(goals) ? goals[0] ?? null : goals;
      return false;
    }
    this.goal = path[path.length - 1];
    const sm = smoothPath(this.s.grid, path);
    this.points = sm.slice(1).map((p) => {
      const c = cellCenter(p.gx, p.gy);
      return new THREE.Vector2(c.x, c.z);
    });
    if (sm.length === 1) {
      const c = cellCenter(sm[0].gx, sm[0].gy);
      this.points = [new THREE.Vector2(c.x, c.z)];
    }
    this.idx = 0;
    return true;
  }

  stop(): void {
    this.points = [];
    this.idx = 0;
  }

  /** Di chuyển; trả true nếu còn đang đi. */
  step(dist: number, dt: number): boolean {
    if (!this.moving) {
      this.human.speed = 0;
      this.turn(dt);
      return false;
    }
    const next = this.points[this.idx];
    const nc = worldToCell(next.x, next.y);
    if (!this.s.grid.isFloorType(nc.gx, nc.gy) || (this.s.grid.occupant(nc.gx, nc.gy) && this.goal)) {
      this.stuck += dt;
      if (this.stuck > 0.4 && this.goal) {
        this.stuck = 0;
        if (!this.walkTo(this.goal)) this.stop();
      }
      this.human.speed = 0;
      return true;
    }
    let remaining = dist;
    let moved = 0;
    while (remaining > 0 && this.idx < this.points.length) {
      const t = this.points[this.idx];
      const dx = t.x - this.x;
      const dz = t.y - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 1e-4) {
        this.idx++;
        continue;
      }
      this.heading = Math.atan2(-dx, -dz);
      if (remaining >= d) {
        this.x = t.x;
        this.z = t.y;
        moved += d;
        remaining -= d;
        this.idx++;
      } else {
        this.x += (dx / d) * remaining;
        this.z += (dz / d) * remaining;
        moved += remaining;
        remaining = 0;
      }
    }
    this.human.speed = dt > 0 ? moved / dt : 0;
    this.turn(dt);
    return this.moving;
  }

  private turn(dt: number): void {
    const target = this.faceTarget ?? this.heading;
    let d = target - this.human.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.human.root.rotation.y += d * Math.min(1, dt * 9);
  }

  /** Quay mặt về điểm (m). */
  face(x: number, z: number): void {
    this.faceTarget = Math.atan2(-(x - this.x), -(z - this.z));
  }

  sync(): void {
    this.human.root.position.set(this.x, 0, this.z);
  }

  update(dt: number, cameraPos: THREE.Vector3, cullDist: number): void {
    const far = cameraPos.distanceToSquared(this.human.root.position) > cullDist * cullDist;
    this.human.animate = !far;
    this.human.update(dt);
    this.bubble.update();
    this.sync();
  }

  dispose(): void {
    this.human.dispose();
  }
}
