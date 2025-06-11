// --- IndexedDBラッパー ---
const DB_NAME = "simple_memo_db";
const STORE_NAME = "memos";
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = e => {
        db = e.target.result;
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      };
      req.onsuccess = e => {
        db = e.target.result;
        resolve();
      };
      req.onerror = e => reject(e);
    } catch (err) {
      reject(err);
    }
  });
}

function getAllMemos() {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = e => reject(e);
    } catch (err) {
      reject(err);
    }
  });
}

function getMemo(id) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = e => reject(e);
    } catch (err) {
      reject(err);
    }
  });
}

function putMemo(memo) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(memo);
      req.onsuccess = () => resolve(req.result);
      req.onerror = e => reject(e);
    } catch (err) {
      reject(err);
    }
  });
}

function deleteMemo(id) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = e => reject(e);
    } catch (err) {
      reject(err);
    }
  });
}

// --- UI・アプリ本体 ---
let currentMemo = null;
let isDrawing = false;
let lastX, lastY;
let openedMemoId = null;
let addTextMode = false; // テキスト追加モード

const memoListSection = document.getElementById("memo-list-section");
const editorSection = document.getElementById("editor-section");
const memoList = document.getElementById("memo-list");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const textLayer = document.getElementById("text-layer");
const addTextBtn = document.getElementById("add-text-btn");
const tagInput = document.getElementById("tag-input");
const tagChips = document.getElementById("tag-chips");
const saveBtn = document.getElementById("save-btn");
const tagFilter = document.getElementById("tag-filter");
const drawArea = document.getElementById("draw-area");
const hamburger = document.getElementById('hamburger');
const menu = document.getElementById('header-menu');
const menuOpenList = document.getElementById('menu-open-list');
const menuNew = document.getElementById('menu-new');
const menuDelete = document.getElementById('menu-delete');
const saveToast = document.getElementById("save-toast");

function resizeCanvas() {
  try {
    const size = drawArea.offsetWidth;
    // Canvas内容を一時保存
    const tmpImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = size;
    canvas.height = size;
    textLayer.style.width = size + "px";
    textLayer.style.height = size + "px";
    ctx.fillStyle = "#111217";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // 画像データがあれば復元
    if (currentMemo && currentMemo.image) {
      const img = new window.Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = currentMemo.image;
    } else if (tmpImage) {
      // 手書き途中の内容もリサイズ時に復元
      try {
        ctx.putImageData(tmpImage, 0, 0);
      } catch (e) {}
    }
  } catch (e) {
    alert("キャンバスのリサイズに失敗しました: " + (e.message || e));
    console.error(e);
  }
}

window.addEventListener("resize", () => {
  if (!editorSection.classList.contains("hidden")) resizeCanvas();
});

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111217";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawLine(x1, y1, x2, y2) {
  ctx.strokeStyle = "#3af9e5";
  ctx.lineWidth = Math.max(2, canvas.width / 160);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// 手書きイベント
canvas.addEventListener("mousedown", e => {
  if (addTextMode) return; // テキスト追加モード時は無効
  isDrawing = true;
  [lastX, lastY] = [e.offsetX, e.offsetY];
});
canvas.addEventListener("mousemove", e => {
  if (!isDrawing || addTextMode) return;
  drawLine(lastX, lastY, e.offsetX, e.offsetY);
  [lastX, lastY] = [e.offsetX, e.offsetY];
});
canvas.addEventListener("mouseup", () => isDrawing = false);
canvas.addEventListener("mouseleave", () => isDrawing = false);

canvas.addEventListener("touchstart", e => {
  if (addTextMode) return;
  e.preventDefault();
  isDrawing = true;
  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  [lastX, lastY] = [t.clientX - rect.left, t.clientY - rect.top];
});
canvas.addEventListener("touchmove", e => {
  if (!isDrawing || addTextMode) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  const x = t.clientX - rect.left, y = t.clientY - rect.top;
  drawLine(lastX, lastY, x, y);
  [lastX, lastY] = [x, y];
});
canvas.addEventListener("touchend", () => isDrawing = false);

// --- テキスト追加機能（好きな場所に配置） ---
addTextBtn.onclick = () => {
  addTextMode = true;
  drawArea.style.cursor = "crosshair";
};

canvas.addEventListener("click", e => {
  if (!addTextMode) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  createTextBox(x, y);
  addTextMode = false;
  drawArea.style.cursor = "default";
});
canvas.addEventListener("touchend", e => {
  if (!addTextMode) return;
  const rect = canvas.getBoundingClientRect();
  const t = e.changedTouches[0];
  const x = t.clientX - rect.left;
  const y = t.clientY - rect.top;
  createTextBox(x, y);
  addTextMode = false;
  drawArea.style.cursor = "default";
});

function createTextBox(x, y, value = "") {
  try {
    const box = document.createElement("textarea");
    box.className = "textbox";
    box.style.left = x + "px";
    box.style.top = y + "px";
    box.rows = 1;
    box.value = value;
    box.setAttribute("draggable", "true");
    box.addEventListener("input", () => {
      box.style.height = "auto";
      box.style.height = (box.scrollHeight) + "px";
    });
    // ドラッグ移動
    let dragging = false, offsetX = 0, offsetY = 0;
    box.addEventListener("mousedown", e => {
      dragging = true;
      offsetX = e.offsetX;
      offsetY = e.offsetY;
      box.style.zIndex = 10;
    });
    document.addEventListener("mousemove", e => {
      if (!dragging) return;
      const rect = textLayer.getBoundingClientRect();
      let nx = e.clientX - rect.left - offsetX;
      let ny = e.clientY - rect.top - offsetY;
      box.style.left = nx + "px";
      box.style.top = ny + "px";
    });
    document.addEventListener("mouseup", () => {
      dragging = false;
      box.style.zIndex = 2;
    });
    // タッチで移動
    box.addEventListener("touchstart", e => {
      dragging = true;
      const t = e.touches[0];
      const rect = box.getBoundingClientRect();
      offsetX = t.clientX - rect.left;
      offsetY = t.clientY - rect.top;
      box.style.zIndex = 10;
    });
    document.addEventListener("touchmove", e => {
      if (!dragging) return;
      const t = e.touches[0];
      const rect = textLayer.getBoundingClientRect();
      let nx = t.clientX - rect.left - offsetX;
      let ny = t.clientY - rect.top - offsetY;
      box.style.left = nx + "px";
      box.style.top = ny + "px";
    });
    document.addEventListener("touchend", () => {
      dragging = false;
      box.style.zIndex = 2;
    });
    textLayer.appendChild(box);
    box.focus();
  } catch (e) {
    alert("テキストボックスの作成に失敗しました: " + (e.message || e));
    console.error(e);
  }
}

function showSection(section) {
  memoListSection.classList.add("hidden");
  editorSection.classList.add("hidden");
  section.classList.remove("hidden");
}

function renderMemoList(memos, filterTag = null) {
  memoList.innerHTML = "";
  let filtered = memos;
  if (filterTag) {
    filtered = memos.filter(m => (m.tags || []).includes(filterTag));
  }
  filtered.forEach(memo => {
    const li = document.createElement("li");
    // タイトル：最初のテキスト or [手書きのみ] + 日時
    let title = (memo.texts && memo.texts.length ? memo.texts[0].value : "[手書きのみ]");
    if (memo.updatedAt) title += " (" + memo.updatedAt + ")";
    li.textContent = title + (memo.tags && memo.tags.length ? " [" + memo.tags.join(",") + "]" : "");
    li.onclick = () => openEditor(memo.id);
    memoList.appendChild(li);
  });
}

function renderTagFilter(memos) {
  const tags = Array.from(new Set(memos.flatMap(m => m.tags || [])));
  tagFilter.innerHTML = "";
  if (tags.length === 0) return;
  tagFilter.textContent = "タグで絞り込み: ";
  tags.forEach(tag => {
    const btn = document.createElement("button");
    btn.textContent = tag;
    btn.onclick = () => {
      renderMemoList(memos, tag);
    };
    tagFilter.appendChild(btn);
  });
  const allBtn = document.createElement("button");
  allBtn.textContent = "すべて";
  allBtn.onclick = () => renderMemoList(memos);
  tagFilter.appendChild(allBtn);
}

async function refreshList() {
  try {
    const memos = await getAllMemos();
    renderMemoList(memos);
    renderTagFilter(memos);
  } catch (e) {
    alert("メモ一覧の取得に失敗しました: " + (e.message || e));
    console.error(e);
  }
}

function renderTagChips(tags) {
  tagChips.innerHTML = "";
  tags.forEach((tag, idx) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.textContent = tag;
    const rm = document.createElement("span");
    rm.className = "remove-tag";
    rm.textContent = "×";
    rm.onclick = () => {
      currentMemo.tags.splice(idx, 1);
      renderTagChips(currentMemo.tags);
    };
    chip.appendChild(rm);
    tagChips.appendChild(chip);
  });
}

function openEditor(id = null) {
  showSection(editorSection);
  textLayer.innerHTML = "";
  openedMemoId = id;
  if (id) {
    getMemo(id).then(memo => {
      currentMemo = Object.assign({}, memo);
      setTimeout(() => {
        resizeCanvas();
        loadMemoToEditor(currentMemo);
      }, 50);
      menuDelete.classList.remove('hidden');
    }).catch(e => {
      alert("メモの取得に失敗しました: " + (e.message || e));
      console.error(e);
    });
  } else {
    currentMemo = {
      id: undefined,
      image: "",
      texts: [],
      tags: [],
      createdAt: undefined,
      updatedAt: undefined
    };
    setTimeout(() => {
      resizeCanvas();
      clearCanvas();
    }, 50);
    renderTagChips([]);
    menuDelete.classList.add('hidden');
  }
}

function loadMemoToEditor(memo) {
  clearCanvas();
  if (memo.image) {
    const img = new window.Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = memo.image;
  }
  (memo.texts || []).forEach(t => {
    createTextBox(t.left * canvas.width, t.top * canvas.height, t.value);
  });
  renderTagChips(memo.tags || []);
}

function showSaveToast() {
  saveToast.classList.remove("hidden");
  setTimeout(() => {
    saveToast.classList.add("hidden");
  }, 1000);
}

// --- 保存ボタン ---
saveBtn.onclick = async () => {
  try {
    // 日時を記録
    const now = new Date();
    if (!currentMemo.createdAt) {
      currentMemo.createdAt = now.toLocaleString();
    }
    currentMemo.updatedAt = now.toLocaleString();

    // 保存するデータを準備
    const memoToSave = { ...currentMemo };
    memoToSave.image = canvas.toDataURL();
    const boxes = textLayer.querySelectorAll(".textbox");
    memoToSave.texts = Array.from(boxes).map(box => ({
      value: box.value,
      left: parseFloat(box.style.left) / canvas.width,
      top: parseFloat(box.style.top) / canvas.height
    }));

    if (memoToSave.id === undefined) {
      delete memoToSave.id;
    }

    const savedId = await putMemo(memoToSave);
    currentMemo.id = savedId;
    openedMemoId = savedId;

    showSaveToast();
    showSection(memoListSection);
    menuDelete.classList.remove('hidden');
    refreshList();

  } catch (e) {
    alert("保存に失敗しました：" + (e.message || e));
    console.error(e);
  }
};

menuDelete.onclick = async () => {
  if (openedMemoId !== null && openedMemoId !== undefined) {
    if (confirm("このメモを削除しますか？")) {
      try {
        await deleteMemo(openedMemoId);
        showSection(memoListSection);
        menuDelete.classList.add('hidden');
        refreshList();
      } catch (e) {
        alert("削除に失敗しました: " + (e.message || e));
        console.error(e);
      }
    }
  }
};

tagInput.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    const val = tagInput.value.trim();
    if (val) {
      const tags = val.split(",").map(t => t.trim()).filter(Boolean);
      currentMemo.tags = (currentMemo.tags || []).concat(tags.filter(t => !(currentMemo.tags||[]).includes(t)));
      renderTagChips(currentMemo.tags);
      tagInput.value = "";
    }
  }
});

hamburger.addEventListener('click', () => {
  menu.classList.toggle('hidden');
});
document.body.addEventListener('click', e => {
  if (!menu.contains(e.target) && !hamburger.contains(e.target)) {
    menu.classList.add('hidden');
  }
});

menuOpenList.addEventListener('click', () => {
  showSection(memoListSection);
  menu.classList.add('hidden');
  menuDelete.classList.add('hidden');
});
menuNew.addEventListener('click', () => {
  openEditor();
  menu.classList.add('hidden');
});
window.addEventListener("DOMContentLoaded", async () => {
  try {
    await openDB();
    refreshList();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js");
    }
    showSection(memoListSection);
  } catch (e) {
    alert("アプリの初期化に失敗しました: " + (e.message || e));
    console.error(e);
  }
});
