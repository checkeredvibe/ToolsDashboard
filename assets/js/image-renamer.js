(function () {
  'use strict';

  const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const SI_PREFIXES = [[1e12, 'TB'], [1e9, 'GB'], [1e6, 'MB'], [1e3, 'kB'], [1, 'B']];

  let dirHandle = null;
  let files = [];
  let currentIndex = 0;
  const thumbUrls = [];

  const $ = (id) => document.getElementById(id);
  const btnOpenFolder = $('btn-open-folder');
  const errorMsg = $('error-msg');
  const doneMsg = $('done-msg');
  const cardManual = $('card-manual');
  const cardBatch = $('card-batch');
  const inNewName = $('in-new-name');
  const btnApply = $('btn-apply');
  const btnCancel = $('btn-cancel');
  const inPrefix = $('in-prefix');
  const inCounterStart = $('in-counter-start');
  const inCounterStep = $('in-counter-step');
  const inPadding = $('in-padding');
  const btnApplyBatch = $('btn-apply-batch');
  const progressBar = $('progress-bar');
  const progress = $('progress');
  const statusBar = $('status-bar');
  const progressMode = $('progress-mode');
  const cardPreviewManual = $('card-preview-manual');
  const imagePreview = $('image-preview');
  const previewPlaceholder = $('preview-placeholder');
  const fileInfo = $('file-info');
  const cardPreviewBatch = $('card-preview-batch');
  const batchPlaceholder = $('batch-placeholder');
  const cardFileList = $('card-file-list');
  const fileListBody = $('file-list-body');

  function formatBytes(bytes) {
    const [factor, unit] = SI_PREFIXES.find(([f]) => bytes >= f) || [1, 'B'];
    return SI.format(bytes / factor, unit);
  }

  function showError(message) {
    errorMsg.textContent = message;
    errorMsg.classList.remove('d-none');
  }

  function clearError() {
    errorMsg.classList.add('d-none');
  }

  function showDone(message) {
    doneMsg.textContent = message;
    doneMsg.classList.remove('d-none');
  }

  function hideDone() {
    doneMsg.classList.add('d-none');
  }

  function getMode() {
    const checked = document.querySelector('input[name="rename-mode"]:checked');
    return checked ? checked.value : 'manual';
  }

  function setControlsEnabled(enabled) {
    [inNewName, btnApply, btnCancel, inPrefix, inCounterStart, inCounterStep, inPadding, btnApplyBatch]
      .forEach((el) => { el.disabled = !enabled; });
  }

  function updateProgress(done, total) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    progressBar.style.width = pct + '%';
    progress.setAttribute('aria-valuenow', String(pct));
    statusBar.textContent = 'Progress: ' + done + ' / ' + total;
    progressMode.textContent = getMode() === 'batch' ? 'batch' : 'manual';
  }

  function renderFileList() {
    fileListBody.innerHTML = '';
    files.forEach((f, i) => {
      const tr = document.createElement('tr');
      const tdNum = document.createElement('td');
      tdNum.textContent = String(i + 1);
      const tdOld = document.createElement('td');
      tdOld.textContent = f.originalName;
      const tdNew = document.createElement('td');
      tdNew.textContent = f.newName || '\u2014';
      tr.append(tdNum, tdOld, tdNew);
      fileListBody.appendChild(tr);
    });
  }

  function clearThumbs() {
    thumbUrls.forEach((u) => URL.revokeObjectURL(u));
    thumbUrls.length = 0;
    for (let i = 0; i < 3; i++) {
      const img = $('thumb-' + i);
      img.removeAttribute('src');
      img.hidden = true;
    }
    batchPlaceholder.hidden = false;
  }

  async function renderBatchThumbs() {
    clearThumbs();
    if (!files.length) return;
    const pool = files.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picks = pool.slice(0, Math.min(3, pool.length));
    for (let i = 0; i < picks.length; i++) {
      try {
        const file = await picks[i].handle.getFile();
        const url = URL.createObjectURL(file);
        thumbUrls.push(url);
        const img = $('thumb-' + i);
        img.onload = () => URL.revokeObjectURL(url);
        img.src = url;
        img.hidden = false;
      } catch (err) {
        console.error(err);
      }
    }
    if (picks.length) batchPlaceholder.hidden = true;
  }

  async function showCurrentImage() {
    if (currentIndex >= files.length) {
      finishManual();
      return;
    }
    const f = files[currentIndex];
    const file = await f.handle.getFile();
    const url = URL.createObjectURL(file);
    imagePreview.onload = () => URL.revokeObjectURL(url);
    imagePreview.src = url;
    imagePreview.hidden = false;
    previewPlaceholder.hidden = true;
    fileInfo.textContent = f.originalName + ' \u00b7 ' + formatBytes(file.size);
    updateProgress(currentIndex, files.length);
    inNewName.value = '';
    inNewName.focus();
  }

  function finishManual() {
    updateProgress(files.length, files.length);
    imagePreview.hidden = true;
    previewPlaceholder.hidden = false;
    previewPlaceholder.textContent = 'All images processed. Open a folder to start again.';
    fileInfo.textContent = '\u2014';
    showDone('All ' + files.length + ' images processed (manual mode).');
  }

  async function applyManual() {
    if (getMode() !== 'manual' || !files.length) return;
    const base = inNewName.value.trim();
    if (!base) return;
    const f = files[currentIndex];
    const newName = base + f.ext;
    try {
      await f.handle.move(newName);
      f.name = newName;
      f.newName = newName;
      currentIndex++;
      hideDone();
      await showCurrentImage();
    } catch (err) {
      console.error(err);
      showError('Rename failed: ' + err.message);
    }
  }

  async function applyBatch() {
    if (getMode() !== 'batch' || !files.length) return;
    hideDone();
    clearError();
    const prefix = inPrefix.value;
    let counter = SI.parse(inCounterStart.value);
    if (!Number.isFinite(counter)) counter = 1;
    const parsedStep = SI.parse(inCounterStep.value);
    const step = Number.isFinite(parsedStep) && parsedStep !== 0 ? parsedStep : 1;
    const parsedWidth = SI.parse(inPadding.value);
    const width = Number.isFinite(parsedWidth) ? Math.min(10, Math.max(0, Math.floor(parsedWidth))) : 0;
    btnApplyBatch.disabled = true;
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const num = width > 0 ? String(counter).padStart(width, '0') : String(counter);
      const newName = prefix + num + f.ext;
      try {
        await f.handle.move(newName);
        f.name = newName;
        f.newName = newName;
      } catch (err) {
        console.error(err);
        failed++;
        f.newName = '(failed)';
      }
      counter += step;
      updateProgress(i + 1, files.length);
      renderFileList();
    }
    btnApplyBatch.disabled = false;
    showDone('Batch done: ' + (files.length - failed) + ' of ' + files.length + ' images renamed' +
      (failed ? ' (' + failed + ' failed)' : '') + '.');
  }

  async function selectFolder() {
    clearError();
    hideDone();
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.error(err);
      showError('Error accessing folder. Make sure you use Chrome or Edge.');
      return;
    }
    files = [];
    for await (const entry of dirHandle.values()) {
      if (entry.kind !== 'file') continue;
      const ext = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(ext)) {
        files.push({ handle: entry, originalName: entry.name, name: entry.name, ext, newName: '' });
      }
    }
    files.sort((a, b) => a.originalName.localeCompare(b.originalName));
    if (!files.length) {
      showError('No supported images found in this folder.');
      return;
    }
    currentIndex = 0;
    setControlsEnabled(true);
    renderMode();
  }

  function renderMode() {
    const mode = getMode();
    const loaded = files.length > 0;
    cardManual.hidden = mode !== 'manual';
    cardBatch.hidden = mode !== 'batch';
    cardPreviewManual.hidden = mode !== 'manual' || !loaded;
    cardPreviewBatch.hidden = mode !== 'batch' || !loaded;
    cardFileList.hidden = mode !== 'batch' || !loaded;
    if (!loaded) return;
    updateProgress(mode === 'manual' ? currentIndex : files.filter((f) => f.newName && f.newName !== '(failed)').length, files.length);
    if (mode === 'manual') {
      showCurrentImage();
    } else {
      renderFileList();
      renderBatchThumbs();
    }
  }

  function reset() {
    if (!window.confirm('Are you sure? This will stop the current session.')) return;
    dirHandle = null;
    files = [];
    currentIndex = 0;
    setControlsEnabled(false);
    hideDone();
    clearError();
    clearThumbs();
    imagePreview.hidden = true;
    previewPlaceholder.hidden = false;
    previewPlaceholder.textContent = 'Open a folder to preview its images here.';
    fileInfo.textContent = '\u2014';
    fileListBody.innerHTML = '';
    cardPreviewManual.hidden = true;
    cardPreviewBatch.hidden = true;
    cardFileList.hidden = true;
    updateProgress(0, 0);
  }

  btnOpenFolder.addEventListener('click', selectFolder);
  btnApply.addEventListener('click', applyManual);
  btnCancel.addEventListener('click', reset);
  btnApplyBatch.addEventListener('click', applyBatch);
  inNewName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyManual();
  });
  document.querySelectorAll('input[name="rename-mode"]').forEach((r) => {
    r.addEventListener('change', renderMode);
  });

  if (!('showDirectoryPicker' in window)) {
    showError('This tool requires a browser with the File System Access API (Chrome or Edge).');
    btnOpenFolder.disabled = true;
  }
  updateProgress(0, 0);
})();
