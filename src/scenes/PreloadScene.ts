import Phaser from 'phaser';
import { FURNITURE } from '../config/furniture';
import { PRODUCTS } from '../config/products';
import { showMenu } from '../core/GameSession';
import { boxTexture } from '../render/BoxArt';
import { characterTexture } from '../render/CharacterArt';
import { furnitureTexture } from '../render/FurnitureArt';
import { generateTileTextures } from '../render/TileArt';
import { PLAYER_LOOK } from '../entities/Player';

/**
 * Tạo toàn bộ texture placeholder bằng Graphics → generateTexture.
 * Muốn thay bằng PNG: load ảnh với cùng texture key trong preload() — các hàm makeTexture sẽ bỏ qua key đã tồn tại.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    const text = this.add.text(this.scale.width / 2, this.scale.height / 2, 'Đang chuẩn bị cửa hàng...', {
      fontFamily: 'Nunito, sans-serif', fontSize: '20px', color: '#3d3551',
    }).setOrigin(0.5);
    generateTileTextures(this);
    for (const def of FURNITURE) {
      furnitureTexture(this, def, 0);
      furnitureTexture(this, def, 1);
    }
    for (const p of PRODUCTS) {
      boxTexture(this, p.id, false, false);
      boxTexture(this, p.id, true, false);
      boxTexture(this, p.id, true, true);
    }
    for (const dir of ['down', 'up', 'left', 'right'] as const) characterTexture(this, PLAYER_LOOK, dir);
    text.destroy();
    showMenu(this.game);
  }
}
