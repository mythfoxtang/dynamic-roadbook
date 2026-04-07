"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, LoaderCircle, Trash2, X } from "lucide-react";
import { deletePhoto, listPhotosByDay, savePhoto } from "@/lib/photo-store";

function formatPhotoTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function PhotoViewer({ item, onClose }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div className="flex min-h-screen items-center justify-center px-4 py-6">
        <div className="relative w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#120f0d]" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/85 transition hover:bg-black/55">
            <X className="h-4 w-4" />
          </button>
          <div className="relative aspect-[16/10] max-h-[78vh] w-full">
            <Image src={item.dataUrl} alt={item.caption || item.spotName || item.fileName} fill className="object-contain" sizes="100vw" unoptimized />
          </div>
          <div className="border-t border-white/10 bg-black/30 px-5 py-4 sm:px-6">
            <div className="text-lg font-semibold text-white">{item.spotName || "未标注景点"}</div>
            {item.caption ? <div className="mt-2 text-sm text-white/72">{item.caption}</div> : null}
            <div className="mt-2 text-xs text-white/50">{`${item.fileName} · ${formatPhotoTime(item.createdAt)}`}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DayPhotoPanel({ activeDay, activeStops, onPhotosChange }) {
  const [photos, setPhotos] = useState([]);
  const [spotName, setSpotName] = useState("");
  const [caption, setCaption] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [viewerItem, setViewerItem] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let disposed = false;

    async function loadPhotos() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const next = await listPhotosByDay(activeDay.id);
        if (!disposed) setPhotos(next);
      } catch (error) {
        if (!disposed) setErrorMessage(error?.message || "照片读取失败");
      } finally {
        if (!disposed) setIsLoading(false);
      }
    }

    setSpotName(activeStops[0] ? (typeof activeStops[0] === "string" ? activeStops[0] : activeStops[0]?.name || "") : "");
    setCaption("");
    loadPhotos();

    return () => {
      disposed = true;
    };
  }, [activeDay.id, activeStops]);

  useEffect(() => {
    onPhotosChange?.(photos);
  }, [onPhotosChange, photos]);

  async function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setIsSaving(true);
    setErrorMessage("");

    try {
      const created = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const entry = await savePhoto({ dayId: activeDay.id, spotName, caption, file });
        created.push(entry);
      }
      setPhotos((current) => [...created.reverse(), ...current]);
      setCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setErrorMessage(error?.message || "照片保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deletePhoto(id);
      setPhotos((current) => current.filter((item) => item.id !== id));
      setViewerItem((current) => (current?.id === id ? null : current));
    } catch (error) {
      setErrorMessage(error?.message || "删除照片失败");
    }
  }

  return (
    <section className="panel rounded-[24px] p-4 sm:p-5 sm:rounded-[28px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/50">随手照片</div>
          <div className="mt-2 text-xl font-semibold text-white">当天拍到的好看照片</div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs tracking-[0.18em] text-white/60">
          {`${photos.length} 张`}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,220px),minmax(0,1fr),auto]">
        <select value={spotName} onChange={(event) => setSpotName(event.target.value)} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none">
          {activeStops.map((stop, index) => {
            const label = typeof stop === "string" ? stop : stop?.name || `点位 ${index + 1}`;
            return <option key={`${activeDay.id}-photo-spot-${index}-${label}`} value={label} className="bg-[#162129] text-white">{label}</option>;
          })}
        </select>
        <input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="备注一下这张照片，比如光线很好 / 今天天气超通透" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none" />
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent transition hover:bg-accent/15">
          {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {isSaving ? "保存中..." : "添加照片"}
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
        </label>
      </div>

      <div className="mt-3 text-xs leading-6 text-white/50">照片保存在当前浏览器本地，不会上传服务器。换浏览器或清理站点数据后会丢失。</div>
      {errorMessage ? <div className="mt-2 text-sm text-amber-200">{errorMessage}</div> : null}

      {isLoading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-white/60">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          读取照片中...
        </div>
      ) : photos.length ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {photos.map((item) => (
            <article key={item.id} className="panel-soft overflow-hidden rounded-[24px]">
              <button type="button" onClick={() => setViewerItem(item)} className="block w-full text-left">
                <div className="relative aspect-[4/3]">
                  <Image src={item.dataUrl} alt={item.caption || item.spotName || item.fileName} fill className="object-cover transition duration-300 hover:scale-[1.03]" unoptimized />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] tracking-[0.18em] text-white/80">
                    {item.spotName || "未标注"}
                  </div>
                  <div className="absolute right-4 top-4 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] tracking-[0.18em] text-white/80">
                    点击放大
                  </div>
                </div>
              </button>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{item.spotName || item.fileName}</div>
                    <div className="mt-1 text-xs text-white/45">{formatPhotoTime(item.createdAt)}</div>
                  </div>
                  <button type="button" onClick={() => handleDelete(item.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/65 transition hover:bg-white/10 hover:text-white">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {item.caption ? <div className="mt-3 text-sm leading-6 text-white/72">{item.caption}</div> : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-white/12 bg-white/5 px-5 py-8 text-center text-white/55">
          <Camera className="mx-auto h-6 w-6 text-white/45" />
          <div className="mt-3 text-sm">今天还没存照片，拍到喜欢的就直接加进来。</div>
        </div>
      )}

      <PhotoViewer item={viewerItem} onClose={() => setViewerItem(null)} />
    </section>
  );
}
