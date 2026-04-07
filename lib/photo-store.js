"use client";

import { deletePhotoEntry, listPhotosByDay as listLocalPhotosByDay, savePhotoEntry } from "@/lib/browser-photo-store";

// Current local adapter. Replace with shared cloud storage/database calls later.
export async function listPhotosByDay(dayId) {
  return listLocalPhotosByDay(dayId);
}

export async function savePhoto({ dayId, spotName, caption, file }) {
  return savePhotoEntry({ dayId, spotName, caption, file });
}

export async function deletePhoto(id) {
  return deletePhotoEntry(id);
}
