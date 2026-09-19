export const PALETTE = ['#f7b56b', '#83c8b5', '#e9a5bc', '#a6b7ee', '#e6d987'];
export const DEFAULT_FISH = [
  {
    id: 'friend-1',
    name: '채붕이',
    src: './KakaoTalk_Photo_2026-09-14-21-55-43.jpeg',
    color: PALETTE[0],
    crop: { x: 0.45, y: 0.34, zoom: 1.5 },
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
    name: '장꽉수',
    src: './KakaoTalk_Photo_2026-09-14-21-57-38.jpeg',
    color: PALETTE[2],
    crop: { x: 0.54, y: 0.49, zoom: 2.2 },
  },
  {
    id: 'friend-4',
    name: '하붕이',
    src: './KakaoTalk_Photo_2026-09-14-23-38-10.jpeg',
    color: PALETTE[3],
    crop: { x: 0.42, y: 0.645, zoom: 1.1 },
  },
  {
    id: 'friend-5',
    name: '페어빌레',
    src: './KakaoTalk_Photo_2026-09-16-22-58-38.jpeg',
    color: PALETTE[4],
    crop: { x: 0.52, y: 0.61, zoom: 1.4 },
  },
  {
    id: 'friend-6',
    name: '아그다',
    src: './KakaoTalk_Photo_2026-09-16-22-58-49.jpeg',
    color: PALETTE[4],
    crop: { x: 0.515, y: 0.465, zoom: 2.2 },
  },
  {
    id: 'friend-7',
    name: '홍햄',
    src: './KakaoTalk_Photo_2026-09-17-17-21-11.jpeg',
    color: PALETTE[1],
    crop: { x: 0.5, y: 0.47, zoom: 1.15 },
  },
  {
    id: 'friend-8',
    name: '레전드 세일러문 하츠투하츠 쵀정우',
    src: './KakaoTalk_Photo_2026-09-20-00-24-57.jpeg',
    color: PALETTE[2],
    crop: { x: 0.53, y: 0.505, zoom: 1.12 },
  },
  {
    id: 'friend-9',
    name: '이  강  준',
    src: './KakaoTalk_Photo_2026-09-20-00-29-15.jpeg',
    color: PALETTE[3],
    crop: { x: 0.49, y: 0.415, zoom: 1.12 },
  },
];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('기본 주민 사진을 읽을 수 없어요.'));
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
