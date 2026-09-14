import { Aquarium } from './aquarium.js';
import {
  readFish,
  saveFish,
  portraitCanvas,
  drawPortrait,
  loadImage,
  readPhoto,
  PALETTE,
  MAX_FISH,
} from './portraits.js';
const $ = (selector) => document.querySelector(selector);
const dialog = $('#fish-dialog');
let fish = readFish(),
  aquarium,
  draft,
  draftImage,
  toastTimer,
  replacePhoto = false,
  busy = false,
  renderVersion = 0,
  editorVersion = 0;
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
  const version = ++renderVersion;
  const canvases = await Promise.all(fish.map(portraitCanvas));
  if (version !== renderVersion) return;
  aquarium?.setFish(fish, canvases);
  const roster = $('#residents');
  roster.replaceChildren();
  fish.forEach((record, i) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'resident';
    card.style.setProperty('--fish-color', record.color);
    card.setAttribute('aria-label', `${record.name} 편집`);
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
    const arrow = document.createElement('span');
    arrow.className = 'resident-arrow';
    arrow.textContent = '↗';
    card.append(avatar, info, arrow);
    card.addEventListener('click', () => openEditor(record));
    roster.append(card);
  });
  const add = document.createElement('button');
  add.className = 'add-card';
  add.type = 'button';
  add.textContent =
    fish.length < MAX_FISH ? '+  다음 입주자는 누구?' : '바다가 북적북적해요 (12/12)';
  add.disabled = fish.length >= MAX_FISH;
  add.addEventListener('click', chooseNewPhoto);
  roster.append(add);
  $('#resident-count').textContent = fish.length;
  $('#add-fish').disabled = fish.length >= MAX_FISH;
}
function persist() {
  if (!saveFish(fish))
    toast('브라우저 저장 공간이 부족하거나 저장이 차단됐어요. 이번 방문에만 반영돼요.');
}
function syncPause() {
  if (!aquarium) return;
  $('#pause').setAttribute('aria-pressed', String(aquarium.paused));
  $('#pause-icon').textContent = aquarium.paused ? '▷' : 'Ⅱ';
  $('#pause-label').textContent = aquarium.paused ? '다시 헤엄' : '잠깐 멈춤';
  $('#swim-status').textContent = aquarium.paused ? '잠시 쉬어가는 중' : '자유롭게 헤엄치는 중';
}
function feed() {
  if (!aquarium) return;
  if (!fish.length) {
    toast('먼저 친구를 입수시켜 주세요.');
    return;
  }
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
    dialog.open ||
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
function chooseNewPhoto() {
  if (fish.length >= MAX_FISH) {
    toast('물고기는 최대 12마리까지 함께할 수 있어요.');
    return;
  }
  replacePhoto = false;
  $('#photo-input').click();
}
$('#add-fish').addEventListener('click', chooseNewPhoto);
$('#replace-photo').addEventListener('click', () => {
  replacePhoto = true;
  $('#photo-input').click();
});
$('#photo-input').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file || busy) return;
  busy = true;
  $('#save-fish').disabled = true;
  const replacing = replacePhoto;
  const version = editorVersion;
  const activeDraft = draft;
  const editorIsCurrent = () => dialog.open && editorVersion === version && draft === activeDraft;
  try {
    const src = await readPhoto(file);
    if (replacing) {
      if (!editorIsCurrent()) return;
      const image = await loadImage(src);
      if (!editorIsCurrent()) return;
      draft.src = src;
      draftImage = image;
      // Keep unsaved name/color input intact; only the photo crop changes.
      $('#crop-x').value = '0.5';
      $('#crop-y').value = '0.5';
      $('#crop-zoom').value = '1';
      updatePreview();
    } else if (fish.length < MAX_FISH) {
      await openEditor({
        id: crypto.randomUUID(),
        name: `친구 ${String(fish.length + 1).padStart(2, '0')}`,
        src,
        color: PALETTE[fish.length % PALETTE.length],
        crop: { x: 0.5, y: 0.5, zoom: 1 },
      });
    }
  } catch (error) {
    toast(error.message);
  } finally {
    busy = false;
    $('#save-fish').disabled = false;
  }
});
async function openEditor(record) {
  const version = ++editorVersion;
  try {
    const image = await loadImage(record.src);
    if (version !== editorVersion) return;
    draft = structuredClone(record);
    draftImage = image;
    fillEditor();
    dialog.showModal();
  } catch (error) {
    toast(error.message);
  }
}
function fillEditor() {
  $('#fish-name').setCustomValidity('');
  $('#fish-name').value = draft.name;
  $('#fish-color').value = draft.color;
  $('#crop-x').value = draft.crop.x;
  $('#crop-y').value = draft.crop.y;
  $('#crop-zoom').value = draft.crop.zoom;
  $('#remove-fish').hidden = !fish.some((f) => f.id === draft.id);
  $('#dialog-title').textContent = $('#remove-fish').hidden
    ? '새 친구를 소개해요'
    : '이 친구를 꾸며볼까요?';
  updatePreview();
}
function updatePreview() {
  if (!draftImage) return;
  draft.crop = {
    x: Number($('#crop-x').value),
    y: Number($('#crop-y').value),
    zoom: Number($('#crop-zoom').value),
  };
  drawPortrait($('#crop-preview'), draftImage, draft.crop);
  $('#crop-preview').style.borderColor = $('#fish-color').value;
}
['#crop-x', '#crop-y', '#crop-zoom', '#fish-color'].forEach((id) =>
  $(id).addEventListener('input', updatePreview),
);
$('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (
    event.clientX < r.left ||
    event.clientX > r.right ||
    event.clientY < r.top ||
    event.clientY > r.bottom
  )
    dialog.close();
});
dialog.addEventListener('close', () => {
  editorVersion++;
  draft = null;
  draftImage = null;
  replacePhoto = false;
});
$('#fish-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || !draft) return;
  const name = $('#fish-name').value.trim();
  if (!name) {
    $('#fish-name').setCustomValidity('이름을 입력해주세요.');
    $('#fish-name').reportValidity();
    return;
  }
  busy = true;
  $('#save-fish').disabled = true;
  try {
    draft.name = name;
    draft.color = $('#fish-color').value;
    const index = fish.findIndex((f) => f.id === draft.id);
    if (index < 0) fish.push(draft);
    else fish[index] = draft;
    dialog.close();
    await renderFish();
    toast('새로운 모습으로 둥둥, 바다에 반영했어요.');
    persist();
  } finally {
    busy = false;
    $('#save-fish').disabled = false;
  }
});
$('#fish-name').addEventListener('input', () => $('#fish-name').setCustomValidity(''));
$('#remove-fish').addEventListener('click', async () => {
  if (busy || !draft) return;
  busy = true;
  try {
    fish = fish.filter((f) => f.id !== draft.id);
    dialog.close();
    await renderFish();
    toast('친구를 떠나보냈어요. 사진으로 다시 초대할 수 있어요.');
    persist();
  } finally {
    busy = false;
  }
});
await renderFish();
syncPause();
$('#scene-loading').hidden = true;
document.body.dataset.ready = 'true';
