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
const textInput = document.getElementById("text-input");
const tagInput = document.getElementById("tag-input");
const tagChips = document.getElementById("tag-chips");
const saveBtn = document.getElementById("save-btn");
const deleteBtn = document.getElementById("delete-btn");
const tagFilter = document.getElementById("tag-filter");

function clearCanvas() {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawLine(x1, y1, x2, y2) {
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

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
    li.textContent = (memo.text || "[手書きのみ]") + (memo.tags && memo.tags.length ? " [" + memo.tags.join(",") + "]" : "");
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
  if (id) {
    getMemo(id).then(memo => {
      currentMemo = Object.assign({}, memo);
      loadMemoToEditor(currentMemo);
    });
  } else {
    currentMemo = {
      id: undefined,
      text: "",
      image: "",
      tags: []
    };
    clearCanvas();
    textInput.value = "";
    tagInput.value = "";
    renderTagChips([]);
  }
}

function loadMemoToEditor(memo) {
  clearCanvas();
  if (memo.image) {
    const img = new window.Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = memo.image;
  }
  textInput.value = memo.text || "";
  renderTagChips(memo.tags || []);
}

saveBtn.onclick = async () => {
  // キャンバス画像を保存
  currentMemo.image = canvas.toDataURL();
  currentMemo.text = textInput.value;
  currentMemo.tags = currentMemo.tags || [];
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
