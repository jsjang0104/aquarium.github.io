import { Aquarium } from './aquarium.js';
import { TankPlay } from './tank-play.js';
import { FishDance } from './fish-dance.js';
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
  aquarium?.play?.dispose();
  aquarium?.dance?.dispose();
  $('#scene-loading').hidden = true;
  $('#scene-error').hidden = false;
  [
    '#feed',
    '#pause',
    '#night',
    '#reset-view',
    '#fullscreen',
    '#speed',
    '#play-mode',
    '#view-mode',
    '#dance',
  ].forEach((id) => ($(id).disabled = true));
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
  aquarium.dance?.syncMusic();
  $('#pause').setAttribute('aria-pressed', String(aquarium.paused));
  $('#pause-icon').textContent = aquarium.paused ? '▷' : 'Ⅱ';
  $('#pause-label').textContent = aquarium.paused ? '다시 헤엄' : '잠깐 멈춤';
  $('#swim-status').textContent = aquarium.paused
    ? '잠시 쉬어가는 중'
    : aquarium.dance?.active
      ? '다 같이 박자에 맞춰 춤추는 중'
      : '자유롭게 헤엄치는 중';
  syncDanceControls();
}
function feed() {
  if (!aquarium || $('#feed').disabled) return;
  aquarium.play?.clear();
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
  if (aquarium.paused) aquarium.play?.clear();
  syncPause();
});
$('#speed').addEventListener('input', (event) => {
  aquarium.speed = Number(event.target.value);
  aquarium.dance?.syncMusic();
  $('#speed-value').textContent = `${aquarium.speed.toFixed(1)}×`;
  syncDanceControls();
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
    event.altKey ||
    event.repeat
  )
    return;
  if (event.key.toLowerCase() === 'f') {
    event.preventDefault();
    feed();
  } else if (aquarium?.play?.mode === 'play' && !$('#play-mode').disabled) {
    if (event.key.toLowerCase() === 't') {
      event.preventDefault();
      aquarium.play.tapAt(aquarium.controls.target);
    }
    if (event.key.toLowerCase() === 'b') {
      event.preventDefault();
      aquarium.play.bubbleBurst();
    }
  }
});
function setMode(mode) {
  aquarium?.play?.setMode(mode);
  $('#play-mode').setAttribute('aria-pressed', String(mode === 'play'));
  $('#view-mode').setAttribute('aria-pressed', String(mode === 'view'));
  syncDanceControls();
}
$('#play-mode').addEventListener('click', () => setMode('play'));
$('#view-mode').addEventListener('click', () => setMode('view'));
await renderFish();
if (aquarium && $('#scene-error').hidden) {
  aquarium.play = new TankPlay(aquarium, {
    onActivity(type) {
      aquarium.paused = false;
      syncPause();
      if (type === 'tap') toast('톡톡! 놀란 친구들이 잠깐 흩어졌다 돌아와요.');
      if (type === 'bubbles') toast('보글보글, 기포 사이로 헤엄쳐요.');
    },
    onStatus(message) {
      if ($('#play-status').textContent !== message) $('#play-status').textContent = message;
    },
  });
}

function syncDanceControls() {
  const active = Boolean(aquarium?.dance?.active);
  $('#dance').disabled = !aquarium?.dance || !$('#scene-error').hidden;
  $('#dance').setAttribute('aria-pressed', String(active));
  $('#dance-label').textContent = active ? '춤 그만추기' : '춤추기';
  $('#dance-banner').hidden = !active;
  $('#gesture-hint').textContent =
    aquarium?.play?.mode === 'view'
      ? '드래그로 둘러보기 · 스크롤 / 두 손가락으로 확대'
      : active
        ? '다 같이 댄스 타임 · 춤 그만추기를 누르면 다시 헤엄쳐요'
        : '톡 누르기 · 길게 눌러 기포 · 움직여 따라오기';
  $('#tank-card').classList.toggle('is-dancing', active);
  const bpm = Math.round(120 * (aquarium?.speed ?? 1));
  $('#dance-bpm').textContent = `${bpm} BPM`;
  $('#dance-status').textContent = active
    ? aquarium.paused
      ? '잠깐 쉬는 중 · 다시 헤엄을 누르면 춤이 이어져요.'
      : '모두 정면을 보고 박자에 맞춰 춤추는 중! 다시 누르면 자유롭게 헤엄쳐요.'
    : '버튼을 누르면 조명이 켜지고, 모든 친구들이 함께 춤춰요.';
}
if (aquarium && $('#scene-error').hidden) {
  aquarium.dance = new FishDance(aquarium, {
    onChange: syncPause,
    onMusicError: () => toast('음악을 재생하지 못했어요. 춤을 껐다가 다시 켜주세요.'),
  });
}
$('#dance').addEventListener('click', () => {
  if (!aquarium?.dance) return;
  if (aquarium.dance.active) aquarium.dance.stop();
  else if (aquarium.dance.start()) {
    toast('댄스 타임! 모두 함께 박자를 타요.');
    $('#tank-card').scrollIntoView({ block: 'center', behavior: 'instant' });
  }
});
syncPause();
$('#scene-loading').hidden = true;
document.body.dataset.ready = 'true';
