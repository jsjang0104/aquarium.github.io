import { Aquarium } from './aquarium.js';
import { DEFAULT_FISH, portraitCanvas } from './portraits.js';
const $ = (selector) => document.querySelector(selector);
const fish = DEFAULT_FISH;
let aquarium, toastTimer;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4200);
}
function sceneError() {
  $('#scene-loading').hidden = true;
  $('#scene-error').hidden = false;
  ['#feed', '#pause', '#night', '#reset-view', '#fullscreen', '#speed'].forEach(
    (id) => ($(id).disabled = true),
  );
}
try {
  aquarium = new Aquarium($('#aquarium'), {
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    onError: sceneError,
  });
} catch (error) {
  console.error(error);
  sceneError();
}

async function renderFish() {
  const canvases = await Promise.all(fish.map(portraitCanvas));
  aquarium?.setFish(fish, canvases);
  const roster = $('#residents');
  roster.replaceChildren();
  fish.forEach((record, i) => {
    const card = document.createElement('li');
    card.className = 'resident';
    card.style.setProperty('--fish-color', record.color);
    const avatar = document.createElement('img');
    avatar.src = canvases[i].toDataURL();
    avatar.alt = '';
    const info = document.createElement('span');
    info.className = 'resident-info';
    const name = document.createElement('span');
    name.className = 'resident-name';
    name.textContent = record.name;
    const detail = document.createElement('span');
    detail.className = 'resident-detail';
    const dot = document.createElement('i');
    detail.append(
      dot,
      document.createTextNode(
        ['호기심 많은 탐험가', '여유로운 유영가', '바다의 분위기 메이커'][i % 3],
      ),
    );
    info.append(name, detail);
    card.append(avatar, info);
    roster.append(card);
  });
  $('#resident-count').textContent = fish.length;
}
function syncPause() {
  if (!aquarium) return;
  $('#pause').setAttribute('aria-pressed', String(aquarium.paused));
  $('#pause-icon').textContent = aquarium.paused ? '▷' : 'Ⅱ';
  $('#pause-label').textContent = aquarium.paused ? '다시 헤엄' : '잠깐 멈춤';
  $('#swim-status').textContent = aquarium.paused ? '잠시 쉬어가는 중' : '자유롭게 헤엄치는 중';
}
function feed() {
  if (!aquarium || $('#feed').disabled) return;
  aquarium.paused = false;
  syncPause();
  toast(
    aquarium.feed()
      ? '먹이 시간! 친구들이 모여들어요.'
      : '아직 먹이가 남아 있어요. 조금만 기다려주세요.',
  );
}
$('#feed').addEventListener('click', feed);
$('#pause').addEventListener('click', () => {
  aquarium.paused = !aquarium.paused;
  syncPause();
});
$('#speed').addEventListener('input', (event) => {
  aquarium.speed = Number(event.target.value);
  $('#speed-value').textContent = `${aquarium.speed.toFixed(1)}×`;
});
$('#night').addEventListener('click', () => {
  const night = $('#night').getAttribute('aria-pressed') !== 'true';
  $('#night').setAttribute('aria-pressed', String(night));
  aquarium.setNight(night);
  toast(night ? '고요한 밤바다가 찾아왔어요.' : '바다에 햇살이 돌아왔어요.');
});
$('#reset-view').addEventListener('click', () => aquarium.resetView());
$('#fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('#tank-card').requestFullscreen) await $('#tank-card').requestFullscreen();
    else toast('이 브라우저는 전체 화면을 지원하지 않아요.');
  } catch {
    toast('이 브라우저에서는 전체 화면을 열 수 없어요.');
  }
});
document.addEventListener('keydown', (event) => {
  if (
    ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement.tagName) ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return;
  if (event.key.toLowerCase() === 'f') {
    event.preventDefault();
    feed();
  }
});
await renderFish();
syncPause();
$('#scene-loading').hidden = true;
document.body.dataset.ready = 'true';
