import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

/**
 * Nạp HDRI (equirect .hdr) → PMREM để làm scene.environment (phản xạ + ánh sáng gián tiếp).
 * Trả null nếu lỗi — nơi gọi giữ RoomEnvironment sinh bằng code.
 */
export async function loadHdriEnvironment(renderer: THREE.WebGLRenderer, url: string): Promise<THREE.Texture | null> {
  try {
    const hdr = await new HDRLoader().loadAsync(url);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
    pmrem.dispose();
    return env;
  } catch {
    console.warn(`[Environment] Không nạp được HDRI ${url}, dùng môi trường mặc định.`);
    return null;
  }
}
