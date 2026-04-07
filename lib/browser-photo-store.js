"use client";

const DB_NAME = "dynamic-roadbook-photo-store";
const DB_VERSION = 1;
const STORE_NAME = "travel-photos";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("dayId", "dayId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("failed to open photo db"));
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function listPhotosByDay(dayId) {
  if (typeof window === "undefined" || !window.indexedDB) return [];
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("dayId");
    const request = index.getAll(dayId);

    request.onsuccess = () => {
      const items = Array.isArray(request.result) ? request.result : [];
      resolve(items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))));
    };
    request.onerror = () => reject(request.error || new Error("failed to load photos"));
  });
}

export async function savePhotoEntry({ dayId, spotName, caption, file }) {
  if (typeof window === "undefined" || !window.indexedDB) throw new Error("当前浏览器不支持本地照片存储");
  const db = await openDb();
  const dataUrl = await readFileAsDataUrl(file);

  const entry = {
    id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    dayId,
    spotName: spotName || "",
    caption: caption || "",
    fileName: file.name,
    mimeType: file.type || "image/jpeg",
    size: file.size || 0,
    dataUrl,
    createdAt: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve(entry);
    tx.onerror = () => reject(tx.error || new Error("failed to save photo"));
  });
}

export async function deletePhotoEntry(id) {
  if (typeof window === "undefined" || !window.indexedDB) return;
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("failed to delete photo"));
  });
}
