"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { get, set, del } from "idb-keyval";
import {
  Camera,
  Image as ImageIcon,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Eye,
  Trash2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { MovementPhotoViewer } from "./movement-photo-viewer";
import { createClientId } from "@/lib/browser-crypto";

export interface UploadedPhoto {
  photo_batch_id?: string;
  id: number;
  r2_key: string;
  original_filename: string;
  file_size_bytes: number;
  mime_type: string;
  width?: number;
  height?: number;
  movement_type: string;
  movement_id?: number | null;
  movement_number?: string | null;
  party_name?: string | null;
  subplate_id?: number | null;
  stage_key?: string | null;
  watermark_text?: string;
  server_uploaded_at: string;
  view_url: string;
  download_url?: string;
  uploader_name?: string;
}

interface PendingItem {
  id: string; // client temporary ID
  clientUploadId: string; // stable idempotency UUID
  file: File;
  previewUrl: string;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  errorMessage?: string;
  uploadedPhoto?: UploadedPhoto;
  retryCount?: number;
}

interface DraftRecord {
  lastUserEditedAt: number;
  draftId: string;
  eventId: string;
  items: {
    id: string;
    clientUploadId: string;
    name: string;
    type: string;
    size: number;
    blob: Blob;
  }[];
}

export interface MovementPhotoUploaderProps {
  movementType:
    | "purchase_inward"
    | "jobwork_outward"
    | "jobwork_inward"
    | "subplate_qc"
    | "packing"
    | "dispatch";
  movementId?: number | null;
  movementNumber?: string | null;
  partyName?: string | null;
  subplateId?: number | null;
  subplateCode?: string | null;
  stageKey?: string | null;
  projectCodes?: string[];
  mouldCode?: string | null;
  required?: boolean;
  readOnly?: boolean;
  className?: string;
  title?: string;
  onPhotosChange?: (photos: UploadedPhoto[], hasValidUpload: boolean) => void;
}

const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function MovementPhotoUploader({
  movementType,
  movementId,
  movementNumber,
  partyName,
  subplateId,
  subplateCode,
  stageKey,
  projectCodes = [],
  mouldCode,
  required = true,
  readOnly = false,
  className = "",
  title = "Movement Verification Photos",
  onPhotosChange,
}: MovementPhotoUploaderProps) {
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<UploadedPhoto | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const batchRef = useRef<string | null>(null);
  const [initialDraftId] = useState(createClientId);
  const [initialEventId] = useState(createClientId);
  const draftIdRef = useRef(initialDraftId);
  const eventIdRef = useRef(initialEventId);
  const lastUserEditedAtRef = useRef<number>(Date.now());
  const onPhotosChangeRef = useRef(onPhotosChange);
  onPhotosChangeRef.current = onPhotosChange;

  const propsRef = useRef({
    movementType,
    movementId,
    movementNumber,
    partyName,
    subplateId,
    subplateCode,
    stageKey,
    mouldCode,
    projectCodes,
  });

  useEffect(() => {
    propsRef.current = {
      movementType,
      movementId,
      movementNumber,
      partyName,
      subplateId,
      subplateCode,
      stageKey,
      mouldCode,
      projectCodes,
    };
  });

  const draftKey = `sm_photo_draft_${movementType}_${movementId || "temp"}_${subplateId || "all"}`;
  const lastFetchedKeyRef = useRef<string | null>(null);

  // 1. Fetch already committed photos from server (ONLY when editing/viewing an existing entity)
  useEffect(() => {
    // Only query if there is an existing database record (movementId or subplateId)
    // For new drafts/movements being created in modals, do not query or wipe
    if (!movementId && !(subplateId && (movementType === "subplate_qc" || movementType === "packing"))) {
      return;
    }

    const entityKey = `${movementType}_${movementId ?? ""}_${subplateId ?? ""}_${stageKey ?? ""}`;
    if (lastFetchedKeyRef.current === entityKey) {
      return;
    }
    lastFetchedKeyRef.current = entityKey;

    let isCancelled = false;
    const fetchExisting = async () => {
      setIsLoadingExisting(true);
      try {
        const params = new URLSearchParams();
        params.set("movementType", movementType);
        if (movementId) params.set("movementId", String(movementId));
        if (subplateId) params.set("subplateId", String(subplateId));
        if (stageKey) params.set("stageKey", stageKey);

        const res = await fetch(`/api/photos/list?${params.toString()}`);
        if (res.ok && !isCancelled) {
          const data = await res.json();
          const photos: UploadedPhoto[] = data.photos || [];
          setUploadedPhotos((prev) => {
            const serverMap = new Map(photos.map((p) => [p.id, p]));
            const merged: UploadedPhoto[] = [];
            // Preserve all photos uploaded in the current active session
            for (const p of prev) {
              if (serverMap.has(p.id)) {
                merged.push({ ...serverMap.get(p.id)!, ...p });
                serverMap.delete(p.id);
              } else {
                merged.push(p);
              }
            }
            // Add server photos not already present
            for (const p of serverMap.values()) {
              merged.push(p);
            }
            return merged;
          });
        }
      } catch (err) {
        console.error("[PhotoUploader] Failed to fetch existing photos:", err);
      } finally {
        if (!isCancelled) {
          setIsLoadingExisting(false);
        }
      }
    };

    fetchExisting();

    return () => {
      isCancelled = true;
    };
  }, [movementType, movementId, subplateId, stageKey]);

  // 2. Restore persistent offline draft from IndexedDB using binary Blobs (Requirement F07)
  const restoreDraft = useCallback(async () => {
    if (readOnly) return;
    try {
      const draft = await get<DraftRecord>(draftKey);
      if (!draft) return;

      const editedAt = draft.lastUserEditedAt || (draft as any).updatedAt || 0;
      const isExpired = Date.now() - editedAt > DRAFT_EXPIRY_MS;
      if (isExpired) {
        await del(draftKey);
        return;
      }

      if (draft.draftId) draftIdRef.current = draft.draftId;
      if (draft.eventId) eventIdRef.current = draft.eventId;
      if (draft.lastUserEditedAt) lastUserEditedAtRef.current = draft.lastUserEditedAt;

      if (draft.items && draft.items.length > 0) {
        const restored: PendingItem[] = [];
        for (const item of draft.items) {
          let file: File;
          if (item.blob) {
            file = new File([item.blob], item.name, { type: item.type });
          } else if ((item as any).base64Data) {
            const res = await fetch((item as any).base64Data);
            const blob = await res.blob();
            file = new File([blob], item.name, { type: item.type });
          } else {
            continue;
          }
          const previewUrl = URL.createObjectURL(file);
          restored.push({
            id: item.id || createClientId(),
            clientUploadId: item.clientUploadId || item.id || createClientId(),
            file,
            previewUrl,
            progress: 0,
            status: "pending",
          });
        }
        setPendingItems(restored);
      }
    } catch (err) {
      console.warn("[PhotoUploader] Failed to restore offline draft:", err);
    }
  }, [draftKey, readOnly]);

  useEffect(() => {
    restoreDraft();
  }, [restoreDraft]);

  // Safely notify parent whenever uploadedPhotos changes (post-render effect)
  useEffect(() => {
    onPhotosChangeRef.current?.(uploadedPhotos, uploadedPhotos.length > 0);
  }, [uploadedPhotos]);

  // Save pending items to IndexedDB draft using binary Blobs (Requirement F07)
  const persistDraft = async (items: PendingItem[]) => {
    try {
      const uncompleted = items.filter((i) => i.status !== "success");
      if (uncompleted.length === 0) {
        await del(draftKey);
        return;
      }

      lastUserEditedAtRef.current = Date.now();
      const record: DraftRecord = {
        lastUserEditedAt: lastUserEditedAtRef.current,
        draftId: draftIdRef.current,
        eventId: eventIdRef.current,
        items: uncompleted.map((item) => ({
          id: item.id,
          clientUploadId: item.clientUploadId,
          name: item.file.name,
          type: item.file.type,
          size: item.file.size,
          blob: item.file,
        })),
      };
      await set(draftKey, record);
    } catch (err) {
      console.warn("[PhotoUploader] Failed to persist draft:", err);
    }
  };

  // Upload an individual file to /api/photos/upload with retryable idempotency
  const uploadSingleItem = async (item: PendingItem, retryCount = 0) => {
    setPendingItems((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, status: "uploading", progress: 20 } : p))
    );

    const cur = propsRef.current;
    const formData = new FormData();
    batchRef.current ||= createClientId();
    formData.append("photoBatchId", batchRef.current);
    formData.append("clientUploadId", item.clientUploadId);
    formData.append("draftId", draftIdRef.current);
    formData.append("eventId", eventIdRef.current);
    formData.append("file", item.file);
    formData.append("movementType", cur.movementType);
    if (cur.movementId) formData.append("movementId", String(cur.movementId));
    if (cur.movementNumber) formData.append("movementNumber", cur.movementNumber);
    if (cur.partyName) formData.append("partyName", cur.partyName);
    if (cur.subplateId) formData.append("subplateId", String(cur.subplateId));
    if (cur.subplateCode) formData.append("subplateCode", cur.subplateCode);
    if (cur.stageKey) formData.append("stageKey", cur.stageKey);
    if (cur.mouldCode) formData.append("mouldCode", cur.mouldCode);
    if (cur.projectCodes && cur.projectCodes.length > 0) {
      formData.append("projectCodes", JSON.stringify(cur.projectCodes));
    }

    try {
      const res = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed (${res.status})`);
      }

      const result = await res.json();
      const newPhoto: UploadedPhoto = {
        ...result.photo,
        photo_batch_id: result.photo.photo_batch_id || result.photo.claim_batch_id || batchRef.current,
        view_url: `/api/photos/view/${result.photo.id}`,
        download_url: `/api/photos/view/${result.photo.id}?download=1`,
      };

      setUploadedPhotos((prev) => [newPhoto, ...prev]);
      window.dispatchEvent(new Event("starmould:photo-history-changed"));

      setPendingItems((prev) => {
        const updated = prev.filter((p) => p.id !== item.id);
        persistDraft(updated);
        return updated;
      });
    } catch (err: any) {
      if (retryCount < 1) {
        // Exponential backoff auto-retry (attempt 2 after 1.5s)
        setTimeout(() => {
          uploadSingleItem(item, retryCount + 1);
        }, 1500);
        return;
      }

      setPendingItems((prev) => {
        const updated = prev.map((p) =>
          p.id === item.id
            ? { ...p, status: "error" as const, errorMessage: err.message || "Failed to upload", retryCount }
            : p
        );
        persistDraft(updated);
        return updated;
      });
    }
  };

  // Add files to queue and automatically trigger upload
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    lastUserEditedAtRef.current = Date.now();
    const newPending: PendingItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      const previewUrl = URL.createObjectURL(file);
      const clientUploadId = createClientId();
      const item: PendingItem = {
        id: `upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        clientUploadId,
        file,
        previewUrl,
        progress: 0,
        status: "pending",
        retryCount: 0,
      };
      newPending.push(item);
    }

    setPendingItems((prev) => {
      const combined = [...prev, ...newPending];
      persistDraft(combined);
      return combined;
    });

    // Fire upload for each
    newPending.forEach((item) => {
      uploadSingleItem(item);
    });
  };
  const hasPhotos = uploadedPhotos.length > 0;
  const isSatisfied = !required || hasPhotos;

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all ${className}`}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
            <p className="text-xs text-slate-500">
              WebP compressed • Server IST watermarked • Private R2 backup
            </p>
          </div>
        </div>

        {/* Validation requirement indicator badge */}
        <div>
          {isSatisfied ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {uploadedPhotos.length} Photo{uploadedPhotos.length === 1 ? "" : "s"} Ready
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
              <AlertCircle className="w-3.5 h-3.5" />
              Photo Required (Min 1)
            </span>
          )}
        </div>
      </div>

      {/* Action buttons (Camera Capture + File Picker) */}
      {!readOnly && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Native Mobile Camera Button */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            Take Photo (Camera)
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Gallery / File selection button */}
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg transition-colors cursor-pointer border border-slate-200"
          >
            <ImageIcon className="w-4 h-4" />
            Select from Gallery
          </button>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = "";
            }}
          />

          <span className="text-[11px] text-slate-400">
            JPG, PNG, HEIC up to 35MB (auto-compressed to WebP)
          </span>
        </div>
      )}

      {/* Photos Grid & Pending Uploads */}
      <div className="mt-3 min-h-[120px]">
        {isLoadingExisting && uploadedPhotos.length === 0 && pendingItems.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-lg p-6 text-center bg-slate-50/50 min-h-[120px] flex items-center justify-center">
            <RefreshCw className="w-4 h-4 animate-spin mr-2 text-slate-400" />
            <span className="text-xs text-slate-400">Loading uploaded photos...</span>
          </div>
        ) : uploadedPhotos.length === 0 && pendingItems.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-lg p-6 text-center bg-slate-50/50 min-h-[120px] flex flex-col items-center justify-center">
            <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-600">
              No photos captured for this movement yet.
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Snap a live camera photo or pick existing images from gallery.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {/* Uploaded photos */}
            {uploadedPhotos.map((photo) => (
              <div
                key={photo.id}
                className="group relative rounded-lg border border-slate-200 overflow-hidden bg-slate-900 aspect-square shadow-xs"
              >
                <img
                  src={photo.view_url}
                  alt={photo.original_filename}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Top badges */}
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-950/80 text-cyan-300 backdrop-blur-xs flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    WebP
                  </span>
                </div>

                {/* Bottom watermark preview bar */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/90 via-slate-950/70 to-transparent p-1.5 text-left">
                  <p className="text-[10px] font-semibold text-white truncate">
                    {photo.movement_number || photo.movement_type.toUpperCase()}
                  </p>
                  <p className="text-[9px] text-cyan-300 flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(photo.server_uploaded_at).toLocaleTimeString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    IST
                  </p>
                </div>

                {/* Overlay hover actions */}
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLightboxPhoto(photo)}
                    className="p-1.5 rounded-full bg-white/90 text-slate-800 hover:bg-white hover:scale-110 transition-transform cursor-pointer"
                    title="View Full Watermarked Photo"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  {photo.download_url && (
                    <a
                      href={photo.download_url}
                      download
                      className="p-1.5 rounded-full bg-white/90 text-slate-800 hover:bg-white hover:scale-110 transition-transform cursor-pointer"
                      title="Download Photo"
                    >
                      <UploadCloud className="w-3.5 h-3.5 rotate-180" />
                    </a>
                  )}
                </div>
              </div>
            ))}

            {/* Pending uploads queue */}
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="relative rounded-lg border border-dashed border-blue-300 overflow-hidden bg-slate-50 aspect-square flex flex-col items-center justify-center p-2 text-center"
              >
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="absolute inset-0 w-full h-full object-cover opacity-40 blur-xs"
                />

                <div className="relative z-10 flex flex-col items-center">
                  {item.status === "uploading" ? (
                    <>
                      <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mb-1" />
                      <span className="text-[10px] font-semibold text-slate-700">
                        Uploading...
                      </span>
                    </>
                  ) : item.status === "error" ? (
                    <>
                      <AlertCircle className="w-6 h-6 text-rose-500 mb-1" />
                      <span className="text-[10px] font-medium text-rose-600 line-clamp-1">
                        {item.errorMessage || "Failed"}
                      </span>
                      <button
                        type="button"
                        onClick={() => uploadSingleItem(item)}
                        className="mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-600 text-white cursor-pointer hover:bg-blue-700"
                      >
                        Retry
                      </button>
                    </>
                  ) : (
                    <>
                      <Clock className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-[10px] font-medium text-slate-500">Queued</span>
                    </>
                  )}
                </div>

                {/* Cancel pending button */}
                <button
                  type="button"
                  onClick={() => {
                    setPendingItems((prev) => {
                      const updated = prev.filter((p) => p.id !== item.id);
                      persistDraft(updated);
                      return updated;
                    });
                  }}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-800/80 text-white hover:bg-rose-600 cursor-pointer transition-colors z-20"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox / High-Precision Document Viewer Modal (Requirement U01) */}
      {lightboxPhoto && (
        <MovementPhotoViewer
          photos={uploadedPhotos}
          currentIndex={Math.max(
            0,
            uploadedPhotos.findIndex((p) => p.id === lightboxPhoto.id)
          )}
          isOpen={Boolean(lightboxPhoto)}
          onClose={() => setLightboxPhoto(null)}
        />
      )}
    </div>
  );
}

