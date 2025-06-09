// --- IndexedDBラッパー ---
const DB_NAME = "simple_memo_db";
const STORE_NAME = "memos";
let db;

function openDB() {
  return new Promise((resolve, reject) => {
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
  });
}

function getAllMemos() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = e => reject(e);
  });
}

function getMemo(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = e => reject(e);
  });
}

function putMemo(memo) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(memo);
    req.onsuccess = () => resolve(req.result);
    req.onerror = e => reject(e);
  });
}

function deleteMemo(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = e => reject(e);
  });
}

// --- UI・アプリ本体 ---
let currentMemo = null;
let isDrawing = false;
let lastX, lastY;

const memoListSection = document.getElementById("memo-list-section");
const editorSection = document.getElementById("editor-section");
const memoList = document.getElementById("memo-list");
const newMemoBtn = document.getElementById("new-memo-btn");
const backBtn = document.getElementById("back-btn");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const textLayer = document.getElementById("text-layer");
const addTextBtn = document.getElementById("add-text-btn");
const tagInput = document.getElementById("tag-input");
const tagChips = document.getElementById("tag-chips");
const saveBtn = document.getElementById("save-btn");
const deleteBtn = document.getElementById("delete-btn");
const tagFilter = document.getElementById("tag-filter");
const drawArea = document.getElementById("draw-area");

// キャンバスサイズをレスポンシブで最大化
function resizeCanvas() {
  const size = drawArea.offsetWidth;
  canvas.width = size;
  canvas.height = size;
  textLayer.style.width = size + "px";
  textLayer.style.height = size + "px";
  // 背景再描画
  ctx.fillStyle = "#111217";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // 既存画像があれば再描画
  if (currentMemo && currentMemo.image) {
    const img = new window.Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = currentMemo.image;
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
  isDrawing = true;
  [lastX, lastY] = [e.offsetX, e.offsetY];
});
canvas.addEventListener("mousemove", e => {
  if (!isDrawing) return;
  drawLine(lastX, lastY, e.offsetX, e.offsetY);
  [lastX, lastY] = [e.offsetX, e.offsetY];
});
canvas.addEventListener("mouseup", () => isDrawing = false);
canvas.addEventListener("mouseleave", () => isDrawing = false);

// タッチ対応
canvas.addEventListener("touchstart", e => {
  e.preventDefault();
  isDrawing = true;
  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  [lastX, lastY] = [t.clientX - rect.left, t.clientY - rect.top];
});
canvas.addEventListener("touchmove", e => {
  e.preventDefault();
  if (!isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  const x = t.clientX - rect.left, y = t.clientY - rect.top;
  drawLine(lastX, lastY, x, y);
  [lastX, lastY] = [x, y];
});
canvas.addEventListener("touchend", () => isDrawing = false);

// テキストボックス追加
addTextBtn.onclick = () => {
  const box = document.createElement("textarea");
  box.className = "textbox";
  box.style.left = "10px";
  box.style.top = "10px";
  box.rows = 1;
  box.value = "";
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
    let x = e.clientX - rect.left - offsetX;
    let y = e.clientY - rect.top - offsetY;
    box.style.left = x + "px";
    box.style.top = y + "px";
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
    let x = t.clientX - rect.left - offsetX;
    let y = t.clientY - rect.top - offsetY;
    box.style.left = x + "px";
    box.style.top = y + "px";
  });
  document.addEventListener("touchend", () => {
    dragging = false;
    box.style.zIndex = 2;
  });
  textLayer.appendChild(box);
  box.focus();
};

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
    li.textContent = (memo.texts && memo.texts.length ? memo.texts.map(t=>t.value).join(" ") : "[手書きのみ]") + (memo.tags && memo.tags.length ? " [" + memo.tags.join(",") + "]" : "");
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
  // すべて表示ボタン
  const allBtn = document.createElement("button");
  allBtn.textContent = "すべて";
  allBtn.onclick = () => renderMemoList(memos);
  tagFilter.appendChild(allBtn);
}

async function refreshList() {
  const memos = await getAllMemos();
  renderMemoList(memos);
  renderTagFilter(memos);
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
  if (id) {
    getMemo(id).then(memo => {
      currentMemo = Object.assign({}, memo);
      setTimeout(() => {
        resizeCanvas();
        loadMemoToEditor(currentMemo);
      }, 50);
    });
  } else {
    currentMemo = {
      id: undefined,
      image: "",
      texts: [],
      tags: []
    };
    setTimeout(() => {
      resizeCanvas();
      clearCanvas();
    }, 50);
    renderTagChips([]);
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
    const box = document.createElement("textarea");
    box.className = "textbox";
    box.value = t.value;
    box.style.left = (t.left * canvas.width) + "px";
    box.style.top = (t.top * canvas.height) + "px";
    box.rows = 1;
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
      let x = e.clientX - rect.left - offsetX;
      let y = e.clientY - rect.top - offsetY;
      box.style.left = x + "px";
      box.style.top = y + "px";
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
      let x = t.clientX - rect.left - offsetX;
      let y = t.clientY - rect.top - offsetY;
      box.style.left = x + "px";
      box.style.top = y + "px";
    });
    document.addEventListener("touchend", () => {
      dragging = false;
      box.style.zIndex = 2;
    });
    textLayer.appendChild(box);
    box.focus();
  });
  renderTagChips(memo.tags || []);
}

saveBtn.onclick = async () => {
  // キャンバス画像を保存
  currentMemo.image = canvas.toDataURL();
  // テキストボックス情報を保存（位置は比率で保存）
  const boxes = textLayer.querySelectorAll(".textbox");
  currentMemo.texts = Array.from(boxes).map(box => ({
    value: box.value,
    left: parseFloat(box.style.left) / canvas.width,
    top: parseFloat(box.style.top) / canvas.height
  }));
  await putMemo(currentMemo);
  showSection(memoListSection);
  refreshList();
};

deleteBtn.onclick = async () => {
  if (currentMemo.id !== undefined) {
    await deleteMemo(currentMemo.id);
  }
  showSection(memoListSection);
  refreshList();
};

backBtn.onclick = () => {
  showSection(memoListSection);
};

newMemoBtn.onclick = () => openEditor();

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

window.addEventListener("DOMContentLoaded", async () => {
  await openDB();
  refreshList();
  // PWA登録
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
  }
});
