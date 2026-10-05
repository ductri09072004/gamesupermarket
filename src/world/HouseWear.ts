import * as THREE from 'three';

/**
 * Tường nhà phố cũ: vật liệu nhà chỉ là màu phẳng (vertex color) nên thêm lớp "năm tháng" bằng shader, dựa trên toạ độ thế giới
 * (mỗi căn một vẻ, không cần texture): vữa sần, các mảng sơn phai/bám bụi, vệt nước mưa chảy từ trên xuống, ẩm mốc & rêu ở chân tường,
 * vệt ố dưới mỗi sàn tầng, sơn bong tróc lộ lớp vữa, mái bê tông ngả màu. Chi tiết mịn tắt dần theo khoảng cách cho nhẹ GPU.
 */
const NOISE = /* glsl */ `
varying vec3 vWp;
varying vec3 vWn;
float hash31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
vec2 hash22(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
// khoảng cách tới cạnh ô Voronoi (F2 - F1): đường nứt ngoằn ngoèo
float crackDist(vec2 x) {
  vec2 i = floor(x); vec2 f = fract(x); float d1 = 8.0; float d2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++) {
    vec2 g = vec2(float(k), float(j)); vec2 r = g + hash22(i + g) - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(d2) - sqrt(d1);
}
float fbm3(vec3 p) { float a = 0.5; float s = 0.0; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

const WEAR = /* glsl */ `
{
  vec3 p = vWp;
  vec3 n = normalize(vWn);
  float dist = length(vViewPosition);
  float wall = 1.0 - smoothstep(0.35, 0.7, abs(n.y));
  float up = smoothstep(0.55, 0.85, n.y);
  float lum = dot(diffuseColor.rgb, vec3(0.333));
  // chỉ tường sáng (lớp sơn) mới ố / bong; cửa & khung tối chịu ít hơn
  float paint = smoothstep(0.3, 0.75, lum);
  float closeUp = 1.0 - smoothstep(18.0, 60.0, dist);
  // mảng sơn phai / sơn lại không đều (tần số thấp)
  float blotch = fbm3(p * 0.42 + 3.1);
  vec3 col = diffuseColor.rgb * (1.0 + (blotch - 0.5) * 0.5 * wall);
  // vữa sần
  float grain = vnoise(p * 34.0);
  col *= 1.0 + (grain - 0.5) * 0.2 * closeUp;
  float midN = vnoise(p * 2.4 + 7.0);
  col *= 1.0 + (midN - 0.5) * 0.14;
  // vệt nước mưa chảy dọc tường, đậm dần lên phía trên (từ mái / mép sàn xuống)
  float streak = smoothstep(0.6, 0.92, vnoise(vec3((p.x + p.z) * 4.2, p.y * 0.28, (p.x - p.z) * 0.6)));
  col *= 1.0 - streak * wall * paint * (0.2 + 0.28 * smoothstep(1.0, 8.0, p.y));
  // vệt ố ngay dưới mỗi sàn tầng (~3.3m)
  float fy = fract(p.y / 3.3);
  col *= 1.0 - wall * paint * 0.2 * smoothstep(0.55, 0.0, abs(fy - 0.96)) * (0.5 + 0.5 * midN);
  // ẩm mốc: chân tường tối + rêu xanh đen loang lổ lên cao
  float damp = 1.0 - smoothstep(0.0, 0.55 + fbm3(p * vec3(3.0, 1.0, 3.0)) * 1.1, p.y);
  col = mix(col, col * vec3(0.46, 0.43, 0.38), damp * wall * 0.85);
  float moss = smoothstep(0.58, 0.8, fbm3(p * vec3(1.8, 1.0, 1.8) + 9.0)) * wall * (1.0 - smoothstep(0.0, 3.2, p.y) * 0.65);
  col = mix(col, vec3(0.13, 0.17, 0.11), moss * 0.7 * paint);
  // sơn bong tróc lộ lớp vữa/gạch bên dưới (chỉ nhìn gần)
  float pe = fbm3(p * 3.1 + 21.0);
  float flake = smoothstep(0.66, 0.7, pe) * wall * paint * closeUp;
  float rim = (smoothstep(0.62, 0.66, pe) - smoothstep(0.66, 0.7, pe)) * wall * paint * closeUp;
  col = mix(col, vec3(0.5, 0.4, 0.3) * (0.7 + lum * 0.5), flake * 0.85);
  col *= 1.0 + rim * 0.35;
  // mái / sân thượng bê tông: ngả xám, loang ố, rêu
  // vết nứt tường (vữa nứt chân chim) ở từng vùng, kèm nứt mảnh nhỏ gần góc
  vec2 wp2 = vec2(p.x * abs(n.z) + p.z * abs(n.x), p.y);
  if (closeUp > 0.0 && wall > 0.5) {
    vec2 warp = 0.45 * vec2(vnoise(p * 2.7), vnoise(p * 2.7 + 5.0));
    float cr = 1.0 - smoothstep(0.0, 0.03, crackDist(wp2 * 0.8 + warp));
    float crMask = smoothstep(0.5, 0.62, fbm3(p * 0.6 + 12.0));
    float cr2 = 1.0 - smoothstep(0.0, 0.022, crackDist(wp2 * 2.6 + warp * 1.7 + 4.0));
    float cr2Mask = smoothstep(0.58, 0.7, fbm3(p * 1.1 + 31.0));
    col *= 1.0 - (cr * crMask * 0.8 + cr2 * cr2Mask * 0.6) * paint * closeUp;
  }
  // vữa tróc lộ gạch: lớp vữa rơi từng mảng (nhất là sát chân tường)
  float brickMask = smoothstep(0.69, 0.72, fbm3(p * 1.9 + 52.0)) + (1.0 - smoothstep(0.0, 0.35 + fbm3(p * 5.0 + 3.0) * 0.5, p.y));
  brickMask = clamp(brickMask, 0.0, 1.0) * wall * paint;
  if (brickMask > 0.01) {
    vec2 b = vec2(wp2.x / 0.23, wp2.y / 0.072);
    b.x += mod(floor(b.y), 2.0) * 0.5;
    vec2 bi = floor(b); vec2 bf = fract(b);
    float mortar = max(step(bf.x, 0.07), step(bf.y, 0.14));
    vec3 brick = vec3(0.5, 0.23, 0.17) * (0.65 + 0.7 * hash31(vec3(bi, 3.0)));
    col = mix(col, mix(brick, vec3(0.5, 0.46, 0.4), mortar), brickMask * 0.92);
  }
  // vệt gỉ sắt chảy từ ô cửa / thanh sắt
  float rust = smoothstep(0.78, 0.95, vnoise(vec3(wp2.x * 7.0, wp2.y * 0.22, 9.0)));
  col = mix(col, vec3(0.42, 0.22, 0.1), rust * wall * paint * 0.32);
  // cũ chung: bạc màu, kém rực
  col = mix(col, vec3(dot(col, vec3(0.333))), 0.12);
  col *= 0.93;
  float roof = fbm3(p * 1.5 + 40.0);
  col = mix(col, col * vec3(0.62, 0.6, 0.55) * (0.75 + roof * 0.5), up * 0.8);
  col = mix(col, vec3(0.16, 0.2, 0.12), up * smoothstep(0.62, 0.8, roof) * 0.45);
  diffuseColor.rgb = col;
}
`;

/** Gắn shader "năm tháng" vào vật liệu tường nhà (dùng chung nhiều căn: dựa trên toạ độ thế giới nên mỗi căn một vẻ). */
export function applyHouseWear(mat: THREE.MeshStandardMaterial): void {
  if (mat.userData.worn) return;
  mat.userData.worn = true;
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;\nvarying vec3 vWn;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  vec4 wp4 = vec4(transformed, 1.0);
  mat3 wm = mat3(modelMatrix);
  #ifdef USE_INSTANCING
    wp4 = instanceMatrix * wp4;
    wm = wm * mat3(instanceMatrix);
  #endif
  vWp = (modelMatrix * wp4).xyz;
  vWn = wm * objectNormal;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${WEAR}`);
  };
  mat.customProgramCacheKey = () => 'houseWear1';
  mat.needsUpdate = true;
}
