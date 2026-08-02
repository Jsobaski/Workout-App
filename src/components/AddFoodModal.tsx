"use client";

import { useState } from "react";
import Modal from "./Modal";
import { FoodEntry } from "@/lib/types";
import { blobToBase64, blobToObjectUrl, resizeImageFile } from "@/lib/image";
import { scanNutritionLabel } from "@/lib/ocr";

type Mode = "text" | "photo";

export default function AddFoodModal({
  recentFoods,
  onClose,
  onSave,
}: {
  recentFoods: FoodEntry[];
  onClose: () => void;
  onSave: (entry: Omit<FoodEntry, "id" | "dateKey">) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>("text");
  const [itemName, setItemName] = useState("");
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [confidenceNote, setConfidenceNote] = useState("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEstimate, setHasEstimate] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handlePhotoChange(file: File | undefined) {
    if (!file) return;
    setError(null);
    const resized = await resizeImageFile(file);
    setPhotoBlob(resized);
    setPhotoPreview(blobToObjectUrl(resized));
    setHasEstimate(false);
  }

  async function runEstimate() {
    setError(null);
    setEstimating(true);
    try {
      const body: { itemName?: string; imageBase64?: string; mediaType?: string } = {};
      if (mode === "photo" && photoBlob) {
        body.imageBase64 = await blobToBase64(photoBlob);
        body.mediaType = "image/jpeg";
        if (itemName.trim()) body.itemName = itemName.trim();
      } else {
        body.itemName = itemName.trim();
      }
      const res = await fetch("/api/estimate-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Estimate failed");
      setItemName(data.item || itemName);
      setCalories(String(data.calories ?? ""));
      setProteinG(String(data.protein_g ?? ""));
      setConfidenceNote(data.confidence_note || "");
      setHasEstimate(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not estimate — enter calories/protein manually."
      );
    } finally {
      setEstimating(false);
    }
  }

  async function runLabelScan() {
    if (!photoBlob) return;
    setError(null);
    setScanning(true);
    try {
      const result = await scanNutritionLabel(photoBlob);
      if (result.calories == null && result.proteinG == null) {
        throw new Error(
          "Couldn't read calories or protein from that photo. Try a clearer, well-lit photo of the label, or use Estimate with AI instead."
        );
      }
      if (result.calories != null) setCalories(String(result.calories));
      if (result.proteinG != null) setProteinG(String(result.proteinG));
      setConfidenceNote(
        "Read from the nutrition label on-device — no AI used. Double-check against the label."
      );
      setHasEstimate(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not read that label."
      );
    } finally {
      setScanning(false);
    }
  }

  function pickRecent(entry: FoodEntry) {
    setItemName(entry.itemName);
    setCalories(String(entry.calories));
    setProteinG(String(entry.proteinG));
    setConfidenceNote("");
    setHasEstimate(false);
    setError(null);
  }

  async function handleSave() {
    if (!itemName.trim()) {
      setError("Enter an item name.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        timestamp: Date.now(),
        itemName: itemName.trim(),
        calories: Number(calories) || 0,
        proteinG: Number(proteinG) || 0,
        source: mode === "photo" ? "photo" : "typed",
        photoThumbnail: mode === "photo" && photoBlob ? photoBlob : undefined,
        confidenceNote: confidenceNote || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add Food" onClose={onClose}>
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setMode("text")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${
            mode === "text"
              ? "bg-emerald-600 text-white"
              : "bg-neutral-800 text-neutral-300"
          }`}
        >
          Type it in
        </button>
        <button
          onClick={() => setMode("photo")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${
            mode === "photo"
              ? "bg-emerald-600 text-white"
              : "bg-neutral-800 text-neutral-300"
          }`}
        >
          Photo
        </button>
      </div>

      {mode === "photo" && (
        <div className="mb-3">
          <label className="block cursor-pointer rounded-lg border border-dashed border-neutral-700 p-4 text-center text-sm text-neutral-400 hover:border-emerald-700">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreview}
                alt="Food preview"
                className="mx-auto max-h-48 rounded-md"
              />
            ) : (
              "Tap to take or upload a photo (label or plate)"
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handlePhotoChange(e.target.files?.[0])}
            />
          </label>
          {photoBlob && (
            <button
              onClick={runLabelScan}
              disabled={scanning}
              className="mt-2 w-full rounded-lg border border-blue-700 py-2 text-sm font-medium text-blue-400 hover:bg-blue-950 disabled:opacity-40"
            >
              {scanning ? "Reading label…" : "Scan Label (free, no AI)"}
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {mode === "text" && recentFoods.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-neutral-500">Recent</p>
            <div className="flex flex-wrap gap-1.5">
              {recentFoods.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => pickRecent(f)}
                  className="rounded-full border border-neutral-700 bg-neutral-800/60 px-3 py-1 text-xs text-neutral-300 hover:border-emerald-700 hover:bg-emerald-950/40"
                >
                  {f.itemName} · {f.calories} kcal
                </button>
              ))}
            </div>
          </div>
        )}

        <input
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="Item name (e.g. Grilled chicken breast)"
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
        />

        {mode === "text" && (
          <div className="flex gap-2">
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="Calories (optional)"
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
            <input
              type="number"
              value={proteinG}
              onChange={(e) => setProteinG(e.target.value)}
              placeholder="Protein g (optional)"
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </div>
        )}

        <button
          onClick={runEstimate}
          disabled={
            estimating ||
            (mode === "text" && !itemName.trim()) ||
            (mode === "photo" && !photoBlob)
          }
          className="w-full rounded-lg border border-emerald-700 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-950 disabled:opacity-40"
        >
          {estimating ? "Estimating…" : "Estimate with AI"}
        </button>

        {hasEstimate && (
          <div className="space-y-2 rounded-lg bg-neutral-800/60 p-3">
            <p className="text-xs text-neutral-500">
              Estimate — edit before saving:
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                placeholder="Calories"
              />
              <input
                type="number"
                value={proteinG}
                onChange={(e) => setProteinG(e.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                placeholder="Protein (g)"
              />
            </div>
            {confidenceNote && (
              <p className="text-xs italic text-neutral-500">{confidenceNote}</p>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}
