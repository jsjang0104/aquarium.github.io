import { Aquarium } from './aquarium.js';
import { TankPlay } from './tank-play.js';
import { FishDuel } from './fish-duel.js';
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
  aquarium?.duel?.dispose();
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
    '#duel-first',
    '#duel-second',
    '#duel-start',
    '#duel-cancel',
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
  $('#pause').setAttribute('aria-pressed', String(aquarium.paused));
  $('#pause-icon').textContent = aquarium.paused ? '▷' : 'Ⅱ';
  $('#pause-label').textContent = aquarium.paused ? '다시 헤엄' : '잠깐 멈춤';
  $('#swim-status').textContent = aquarium.paused ? '잠시 쉬어가는 중' : '자유롭게 헤엄치는 중';
}
function feed() {
  if (!aquarium || $('#feed').disabled) return;
  aquarium.duel?.cancel();
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
  $('#gesture-hint').textContent =
    mode === 'play'
      ? '톡 누르기 · 길게 눌러 기포 · 움직여 따라오기'
      : '드래그로 둘러보기 · 스크롤 / 두 손가락으로 확대';
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

function syncDuelControls() {
  const available = aquarium?.duel && $('#scene-error').hidden;
  const active = Boolean(aquarium?.duel?.active);
  const first = $('#duel-first').value,
    second = $('#duel-second').value;
  $('#duel-first').disabled = $('#duel-second').disabled = !available || active;
  $('#duel-start').disabled = !available || active || !first || !second || first === second;
  $('#duel-cancel').disabled = !available || !active;
}
if (aquarium && $('#scene-error').hidden) {
  const name = (id) => fish.find((record) => record.id === id)?.name ?? '';
  aquarium.duel = new FishDuel(aquarium, {
    onChange({ phase, ids, winner }) {
      const stages = {
        approach: '선수 입장!',
        circle: '빙글빙글 탐색전',
        charge: '돌진! 한판 승부',
        celebrate: `${name(winner)}의 승리 세리머니!`,
      };
      const result =
        phase === 'finished'
          ? `${name(winner)} 승리! 다시 평화로운 바다로.`
          : phase === 'cancelled'
            ? '대결 끝! 사이좋게 헤엄쳐요.'
            : stages[phase];
      $('#duel-banner').hidden = ['finished', 'cancelled'].includes(phase);
      $('#duel-banner').textContent = `${name(ids[0])} vs ${name(ids[1])} · ${result}`;
      $('#duel-status').textContent = `${name(ids[0])} vs ${name(ids[1])} · ${result}`;
      if (phase === 'finished') toast(`${name(winner)} 승리! 다음 승부는 누가 이길까요?`);
      syncDuelControls();
    },
  });
  for (const id of ['#duel-first', '#duel-second']) {
    fish.forEach((record) => $(id).add(new Option(record.name, record.id)));
    $(id).addEventListener('change', syncDuelControls);
  }
}
$('#duel-start').addEventListener('click', () => {
  if (aquarium?.duel?.start([$('#duel-first').value, $('#duel-second').value])) {
    aquarium.paused = false;
    syncPause();
    $('#tank-card').scrollIntoView({ block: 'center', behavior: 'instant' });
  }
});
$('#duel-cancel').addEventListener('click', () => aquarium?.duel?.cancel());
syncDuelControls();
syncPause();
$('#scene-loading').hidden = true;
document.body.dataset.ready = 'true';
