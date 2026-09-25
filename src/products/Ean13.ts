import { hashString } from '../core/Random';

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map((c) => [...c].map((b) => (b === '0' ? '1' : '0')).join(''));
const G = R.map((c) => [...c].reverse().join(''));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function checkDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

/** Mã EAN-13 giả (đầu 893 như hàng Việt Nam) sinh ổn định từ id sản phẩm. */
export function eanFromId(id: string): string {
  const h = String(hashString(id)).padStart(10, '0').slice(-9);
  const base = `893${h}`;
  return base + checkDigit(base);
}

/** 95 module (1 = vạch đen) theo chuẩn EAN-13. */
export function eanBits(code: string): string {
  if (!/^\d{13}$/.test(code)) throw new Error('EAN-13 phải có 13 chữ số');
  const first = Number(code[0]);
  const parity = PARITY[first];
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === 'L' ? L : G)[Number(code[i])];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[Number(code[i])];
  bits += '101';
  return bits;
}
