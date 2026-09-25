import { describe, expect, it } from 'vitest';
import { DEV_MONEY, SAVE_VERSION } from '../src/config/constants';
import { getFurniture } from '../src/config/furniture';
import { LICENSES } from '../src/config/licenses';
import { createDevState, createNewState, GameState, makeFurniture } from '../src/core/GameState';
import { migrate } from '../src/core/SaveSystem';
import { Services } from '../src/core/Services';
import { canPlace } from '../src/systems/BuildSystem';
import { interiorLight, lampCoverage, nightAt, storeBrightness } from '../src/systems/LightingSystem';

describe('ngày đêm & đèn', () => {
  it('nightAt: bình minh hơi tối, trưa sáng, tối hẳn sau 20h', () => {
    expect(nightAt(8)).toBeGreaterThan(0);
    expect(nightAt(12)).toBe(0);
    expect(nightAt(19)).toBeGreaterThan(0.3);
    expect(nightAt(21)).toBe(1);
  });

  it('độ phủ đèn & độ sáng: tắt đèn ban đêm là tối om, ban ngày vẫn có ánh sáng qua kính', () => {
    const d = createNewState(1);
    const cov = lampCoverage(d.furniture, d.storeW, d.storeH);
    expect(cov).toBeCloseTo((4 * getFurniture('lamp_tube').light!.area) / (d.storeW * d.storeH));
    expect(interiorLight(false, cov)).toBe(0);
    expect(interiorLight(true, 5)).toBe(1);
    expect(storeBrightness(1, 0)).toBe(0);
    expect(storeBrightness(0, 0)).toBeGreaterThan(0.8);
    // 4 đèn cơ bản đủ để khách không chê tối
    expect(storeBrightness(1, interiorLight(true, cov))).toBeGreaterThan(0.3);
  });

  it('đèn gắn trần: không chiếm ô sàn, không chặn đường, chỉ không chồng lên đèn khác', () => {
    const s = new Services(createNewState(1));
    const lamp = getFurniture('lamp_tube');
    // ngay trên quầy thu ngân (gx 9..12, gy 13..14) vẫn gắn được
    expect(canPlace(s.grid, lamp, 9, 14, 0, s.data.furniture).ok).toBe(true);
    expect(s.grid.occupant(4, 6)).toBeNull();
    // trùng đèn cơ bản L1 (gx 4..6, gy 6)
    expect(canPlace(s.grid, lamp, 5, 6, 0, s.data.furniture).ok).toBe(false);
    expect(canPlace(s.grid, lamp, 5, 6, 0, s.data.furniture, 'L1').ok).toBe(true);
    // ngoài cửa hàng thì không
    expect(canPlace(s.grid, lamp, 4, 30, 0, s.data.furniture).ok).toBe(false);
  });

  it('bản lưu v3 được tặng 4 đèn cơ bản và bật đèn', () => {
    const old = createNewState(1) as unknown as Record<string, unknown>;
    old.version = 3;
    old.furniture = (old.furniture as Array<{ type: string }>).filter((f) => !f.type.startsWith('lamp_'));
    delete old.lightsOn;
    const m = migrate(old);
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.lightsOn).toBe(true);
    expect(m.furniture.filter((f) => f.type === 'lamp_tube')).toHaveLength(4);
    expect(m.devMode).toBe(false);
  });
});

describe('chế độ developer', () => {
  it('nhiều tiền, mọi giấy phép, không giới hạn cấp, không phá sản', () => {
    const d = createDevState(1);
    expect(d.devMode).toBe(true);
    expect(d.money).toBe(DEV_MONEY);
    expect(d.licenses).toHaveLength(LICENSES.length);
    expect(d.settings.gameOverEnabled).toBe(false);
    const st = new GameState(d);
    expect(st.levelAtLeast(99)).toBe(true);
    expect(new GameState(createNewState(1)).levelAtLeast(2)).toBe(false);
  });

  it('mua mở rộng, kho, xe, thuê nhân viên ở cấp 1', () => {
    const s = new Services(createDevState(1));
    expect(s.data.level).toBe(1);
    expect(s.shop.buyExpansion().ok).toBe(true);
    expect(s.shop.buyWarehouse().ok).toBe(true);
    expect(s.staff.hire(0).ok).toBe(true);
    expect(s.vehicles.buy('pickup', { x: 0, z: 0, yaw: 0 }).ok).toBe(true);
    expect(s.shop.canBuyFurniture('self_checkout').ok).toBe(true);
    expect(makeFurniture('x', 'lamp_pendant', 0, 0).slots).toHaveLength(0);
  });
});
