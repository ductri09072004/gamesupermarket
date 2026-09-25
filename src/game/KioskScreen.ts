/** Vẽ màn hình cảm ứng của máy tự tính tiền (canvas 512×360). */
export type KioskScreenState =
  | { kind: 'idle' }
  | { kind: 'scan'; lines: string[]; total: number; count: number; of: number }
  | { kind: 'help'; blink: boolean }
  | { kind: 'pay'; total: number }
  | { kind: 'done'; total: number };

const FONT = '"Nunito", Arial';

export function drawKioskScreen(canvas: HTMLCanvasElement, st: KioskScreenState): void {
  const g = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const bg = st.kind === 'help' ? (st.blink ? '#b91c1c' : '#7f1d1d') : '#0f2530';
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // thanh tiêu đề
  g.fillStyle = st.kind === 'help' ? '#fecaca' : '#2a9d8f';
  g.fillRect(0, 0, W, 54);
  g.fillStyle = st.kind === 'help' ? '#7f1d1d' : '#fff';
  g.font = `900 28px ${FONT}`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText('MINI MART · TỰ THANH TOÁN', 18, 29);
  g.textAlign = 'center';
  g.fillStyle = '#fff';
  switch (st.kind) {
    case 'idle':
      g.font = `900 40px ${FONT}`;
      g.fillText('Chạm để bắt đầu', W / 2, 160);
      g.font = `600 24px ${FONT}`;
      g.fillStyle = '#9ad1c9';
      g.fillText('Quét mã vạch từng món trên kính', W / 2, 215);
      g.fillText('Hỗ trợ thẻ & tiền mặt', W / 2, 250);
      break;
    case 'scan': {
      g.textAlign = 'left';
      g.font = `600 24px ${FONT}`;
      st.lines.slice(-5).forEach((l, i) => g.fillText(l, 22, 90 + i * 34));
      g.fillStyle = '#1b3a47';
      g.fillRect(0, H - 76, W, 76);
      g.fillStyle = '#9ad1c9';
      g.font = `700 22px ${FONT}`;
      g.fillText(`${st.count}/${st.of} món`, 22, H - 38);
      g.textAlign = 'right';
      g.fillStyle = '#fff';
      g.font = `900 38px ${FONT}`;
      g.fillText(`$${st.total.toFixed(2)}`, W - 22, H - 38);
      break;
    }
    case 'help':
      g.font = `900 44px ${FONT}`;
      g.fillText('⚠ CẦN HỖ TRỢ', W / 2, 150);
      g.font = `700 26px ${FONT}`;
      g.fillText('Vui lòng chờ nhân viên', W / 2, 210);
      g.fillText('Please wait for assistance', W / 2, 250);
      break;
    case 'pay':
      g.font = `700 28px ${FONT}`;
      g.fillText('Đang thanh toán...', W / 2, 140);
      g.font = `900 56px ${FONT}`;
      g.fillText(`$${st.total.toFixed(2)}`, W / 2, 215);
      break;
    case 'done':
      g.font = `900 44px ${FONT}`;
      g.fillStyle = '#86efac';
      g.fillText('✓ CẢM ƠN QUÝ KHÁCH!', W / 2, 160);
      g.font = `700 28px ${FONT}`;
      g.fillStyle = '#fff';
      g.fillText(`Đã thanh toán $${st.total.toFixed(2)}`, W / 2, 220);
      break;
  }
}
