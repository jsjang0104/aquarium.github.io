export const PALETTE = ['#f7b56b', '#83c8b5', '#e9a5bc', '#a6b7ee', '#e6d987'];
export const DEFAULT_FISH = [
  {
    id: 'friend-1',
    name: '채붕이',
    src: './KakaoTalk_Photo_2026-09-14-21-55-43.jpeg',
    color: PALETTE[0],
    crop: { x: 0.45, y: 0.34, zoom: 1.45 },
  },
  {
    id: 'friend-2',
    name: '???',
    src: './KakaoTalk_Photo_2026-09-14-21-57-30.jpeg',
    color: PALETTE[1],
    crop: { x: 0.49, y: 0.63, zoom: 1.5 },
  },
  {
    id: 'friend-3',
    name: '꽉수',
    src: './KakaoTalk_Photo_2026-09-14-21-57-38.jpeg',
    color: PALETTE[2],
    crop: { x: 0.54, y: 0.49, zoom: 2.05 },
  },
  {
    id: 'friend-4',
    name: '하붕이',
    src: './KakaoTalk_Photo_2026-09-14-23-38-10.jpeg',
    color: PALETTE[3],
    crop: { x: 0.42, y: 0.645, zoom: 1.1 },
  },
];
const KEY = 'doongdoong.fish.v1';
export const MAX_FISH = 12;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function readFish() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (!Array.isArray(saved) || saved.length > MAX_FISH) return structuredClone(DEFAULT_FISH);
    return saved.map((f, i) => {
      if (
        !f ||
        typeof f.name !== 'string' ||
        typeof f.id !== 'string' ||
        typeof f.src !== 'string' ||
        !(
          /^data:image\/(jpeg|png|webp);base64,/.test(f.src) ||
          DEFAULT_FISH.some((d) => d.src === f.src)
        )
      )
        throw new Error('Invalid saved fish');
      const num = (value, fallback) => (Number.isFinite(value) ? value : fallback);
      return {
        id: f.id,
        name: f.name.slice(0, 20) || `친구 ${i + 1}`,
        src: f.src,
        color: /^#[0-9a-f]{6}$/i.test(f.color) ? f.color : PALETTE[i % 5],
        crop: {
          x: clamp(num(f.crop?.x, 0.5), 0, 1),
          y: clamp(num(f.crop?.y, 0.5), 0, 1),
          zoom: clamp(num(f.crop?.zoom, 1), 1, 5),
        },
      };
    });
  } catch {
    return structuredClone(DEFAULT_FISH);
  }
}
export function saveFish(fish) {
  try {
    localStorage.setItem(KEY, JSON.stringify(fish));
    return true;
  } catch {
    return false;
  }
}
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('사진을 읽을 수 없어요. JPG, PNG, WebP 사진을 골라주세요.'));
    img.src = src;
  });
}
export function drawPortrait(canvas, img, crop) {
  const ctx = canvas.getContext('2d'),
    w = canvas.width,
    h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w * 0.49, h * 0.49, 0, 0, Math.PI * 2);
  ctx.clip();
  const size = Math.min(img.naturalWidth, img.naturalHeight) / crop.zoom;
  const sx = clamp(crop.x * img.naturalWidth - size / 2, 0, img.naturalWidth - size);
  const sy = clamp(crop.y * img.naturalHeight - size / 2, 0, img.naturalHeight - size);
  ctx.drawImage(img, sx, sy, size, size, 0, 0, w, h);
  ctx.restore();
  return canvas;
}
export async function portraitCanvas(fish) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  try {
    drawPortrait(canvas, await loadImage(fish.src), fish.crop);
  } catch {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = fish.color;
    ctx.beginPath();
    ctx.arc(128, 128, 125, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#173b32';
    ctx.fillText('◡', 128, 145);
  }
  return canvas;
}
export async function readPhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('JPG, PNG, WebP 사진을 골라주세요.');
  if (file.size > 15 * 1024 * 1024) throw new Error('15MB 이하의 사진을 골라주세요.');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
