import * as THREE from "three";

let _asphalt = null;

/**
 * Procedural asphalt-road grid texture for the Applicants City ground plane.
 * Dark city blocks, lighter road bands every CELL_PX pixels, dashed center stripes.
 * Tileable via RepeatWrapping.
 */
export function getRoadTexture() {
  if (_asphalt) return _asphalt;
  const size = 512;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");

  // 4 blocks per tile, 4 roads per tile
  const blocks = 4;
  const cell = size / blocks; // 128
  const roadW = cell * 0.30;

  // Block (dark) base
  ctx.fillStyle = "#06070A";
  ctx.fillRect(0, 0, size, size);

  // Block subtle grit
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = `rgba(20, 30, 38, ${Math.random() * 0.22})`;
    const r = Math.random() * 2 + 0.5;
    ctx.fillRect(Math.random() * size, Math.random() * size, r, r);
  }

  // Horizontal & vertical roads
  ctx.fillStyle = "#15171C";
  for (let i = 0; i < blocks; i++) {
    const y = i * cell + (cell - roadW) / 2;
    ctx.fillRect(0, y, size, roadW);
    const x = i * cell + (cell - roadW) / 2;
    ctx.fillRect(x, 0, roadW, size);
  }

  // Road edges (slightly lighter strokes)
  ctx.strokeStyle = "rgba(0, 255, 204, 0.16)";
  ctx.lineWidth = 1;
  for (let i = 0; i < blocks; i++) {
    const y = i * cell + (cell - roadW) / 2;
    ctx.strokeRect(0.5, y + 0.5, size - 1, roadW - 1);
    const x = i * cell + (cell - roadW) / 2;
    ctx.strokeRect(x + 0.5, 0.5, roadW - 1, size - 1);
  }

  // Center dashed cyan lines on each road
  ctx.fillStyle = "#00FFCC";
  const dashLen = 14;
  const gap = 12;
  for (let i = 0; i < blocks; i++) {
    const yMid = i * cell + cell / 2;
    for (let x = 0; x < size; x += dashLen + gap) {
      ctx.fillRect(x, yMid - 0.6, dashLen, 1.2);
    }
    const xMid = i * cell + cell / 2;
    for (let y = 0; y < size; y += dashLen + gap) {
      ctx.fillRect(xMid - 0.6, y, 1.2, dashLen);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  _asphalt = tex;
  return tex;
}
