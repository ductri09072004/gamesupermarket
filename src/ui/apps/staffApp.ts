import { STAFF_UNLOCK_LEVEL } from '../../config/constants';
import { STAFF_ROLES } from '../../config/staff';
import type { AppContext } from '../computer';
import { h, money } from '../dom';

export function renderStaff(body: HTMLElement, ctx: AppContext): void {
  const { s } = ctx;
  if (!s.staff.unlocked) {
    body.append(h('div', { class: 'locked-msg' }, [
      h('div', { class: 'shop-icon', text: '🔒' }),
      h('b', { text: `Mở khoá ở cấp ${STAFF_UNLOCK_LEVEL}` }),
      h('p', { class: 'muted', text: `Cấp hiện tại: ${s.data.level}. Bán thêm hàng để lên cấp!` }),
    ]));
    return;
  }
  body.append(h('h3', { text: 'Nhân viên hiện tại' }));
  if (s.data.staff.length === 0) body.append(h('p', { class: 'muted', text: 'Chưa có nhân viên.' }));
  for (const st of s.data.staff) {
    const role = STAFF_ROLES[st.role];
    body.append(h('div', { class: 'staff-row' }, [
      h('span', { class: 'big', text: role.icon }),
      h('div', {}, [h('b', { text: st.name }), h('div', { class: 'muted small', text: `${role.name} · tốc độ ${st.speed.toFixed(2)}x · ${money(st.wage)}/ngày` })]),
      h('button', { class: 'btn small danger', text: 'Sa thải', onClick: () => { s.staff.fire(st.uid); ctx.rerender(); } }),
    ]));
  }
  body.append(h('h3', { text: 'Ứng viên' }));
  const grid = h('div', { class: 'card-grid' });
  s.staff.candidates.forEach((c, i) => {
    const role = STAFF_ROLES[c.role];
    grid.append(h('div', { class: 'shop-card' }, [
      h('div', { class: 'shop-icon', text: role.icon }),
      h('b', { text: c.name }),
      h('div', { class: 'muted small', text: `${role.name} — ${role.desc}` }),
      h('div', { class: 'small', text: `Tốc độ ${c.speed.toFixed(2)}x · Lương ${money(c.wage)}/ngày` }),
      h('button', {
        class: 'btn primary', text: 'Thuê',
        onClick: () => {
          const r = s.staff.hire(i);
          if (!r.ok) s.bus.emit('toast', { message: r.reason ?? 'Lỗi', kind: 'error' });
          ctx.rerender();
        },
      }),
    ]));
  });
  body.append(grid, h('p', { class: 'muted small', text: 'Lương được trả cuối mỗi ngày. Thu ngân NPC nhường chỗ khi bạn đứng vào quầy.' }));
}
