/**
 * Lăn chuột → từng nấc ±1 (gom delta để touchpad không nhảy loạn).
 * Trả về hàm gỡ listener.
 */
export function bindWheelSteps(onStep: (dir: 1 | -1) => void, accept: (e: WheelEvent) => boolean): () => void {
  let acc = 0;
  let last = 0;
  const onWheel = (e: WheelEvent) => {
    if (!accept(e)) return;
    e.preventDefault();
    const now = performance.now();
    if (now - last > 250) acc = 0;
    last = now;
    acc += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    if (Math.abs(acc) < 50) return;
    onStep(acc > 0 ? 1 : -1);
    acc = 0;
  };
  window.addEventListener('wheel', onWheel, { passive: false });
  return () => window.removeEventListener('wheel', onWheel);
}
