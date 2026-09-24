import Phaser from 'phaser';
import type { Facing } from '../iso/IsoMath';
import { makeTexture, OUTLINE, shade } from './IsoDraw';

export const SHIRTS = [0xef476f, 0x06d6a0, 0x118ab2, 0xffd166, 0x9b5de5, 0xf78c6b, 0x43aa8b, 0x577590];
export const HAIRS = [0x2b2d42, 0x6d4c41, 0xd4a373, 0xb5651d, 0x8d99ae];
export const SKINS = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642];

export const CHAR_W = 26;
export const CHAR_H = 46;

export interface Look {
  shirt: number;
  hair: number;
  skin: number;
  apron?: number;
  pants?: number;
}

export function lookKey(l: Look): string {
  return `${l.shirt.toString(16)}_${l.hair.toString(16)}_${l.skin.toString(16)}_${(l.apron ?? 0).toString(16)}`;
}

export function characterTexture(scene: Phaser.Scene, look: Look, dir: Facing): string {
  const key = `char_${lookKey(look)}_${dir}`;
  return makeTexture(scene, key, CHAR_W, CHAR_H, (g) => {
    const pants = look.pants ?? 0x3d405b;
    const cx = CHAR_W / 2;
    // chân
    g.fillStyle(pants, 1);
    if (dir === 'left' || dir === 'right') g.fillRoundedRect(cx - 4, 33, 8, 11, 2);
    else g.fillRoundedRect(cx - 7, 33, 6, 11, 2).fillRoundedRect(cx + 1, 33, 6, 11, 2);
    // thân
    const bw = dir === 'left' || dir === 'right' ? 12 : 16;
    g.fillStyle(look.shirt, 1).fillRoundedRect(cx - bw / 2, 19, bw, 16, 4);
    if (look.apron !== undefined && dir !== 'up') {
      g.fillStyle(look.apron, 1).fillRoundedRect(cx - bw / 2 + 2, 23, bw - 4, 13, 2);
    }
    // tay
    g.fillStyle(shade(look.shirt, -0.2), 1);
    if (dir === 'down' || dir === 'up') g.fillRoundedRect(cx - bw / 2 - 3, 21, 4, 11, 2).fillRoundedRect(cx + bw / 2 - 1, 21, 4, 11, 2);
    else g.fillRoundedRect(cx - 2, 22, 5, 11, 2);
    // đầu
    g.fillStyle(look.skin, 1).fillCircle(cx, 12, 8);
    g.fillStyle(look.hair, 1);
    if (dir === 'up') g.fillCircle(cx, 11, 8.5);
    else if (dir === 'down') g.fillEllipse(cx, 7, 17, 9);
    else if (dir === 'left') { g.fillEllipse(cx + 2, 7, 16, 9); g.fillCircle(cx + 5, 11, 5); }
    else { g.fillEllipse(cx - 2, 7, 16, 9); g.fillCircle(cx - 5, 11, 5); }
    // mắt
    g.fillStyle(0x2b2d42, 1);
    if (dir === 'down') g.fillCircle(cx - 3, 13, 1.3).fillCircle(cx + 3, 13, 1.3);
    else if (dir === 'left') g.fillCircle(cx - 4, 13, 1.3);
    else if (dir === 'right') g.fillCircle(cx + 4, 13, 1.3);
    if (dir === 'down') {
      g.fillStyle(0xff8fab, 0.6).fillCircle(cx - 5, 16, 1.5).fillCircle(cx + 5, 16, 1.5);
    }
    g.lineStyle(1.5, OUTLINE, 0.9).strokeCircle(cx, 12, 8);
    g.strokeRoundedRect(cx - bw / 2, 19, bw, 16, 4);
  });
}
