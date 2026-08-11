"use client";

import { useMemo, useState } from "react";
import Modal from "./Modal";
import { FoodEntry } from "@/lib/types";
import {
  blobToBase64,
  blobToObjectUrl,
  prepareImageForOcr,
  resizeImageFile,
} from "@/lib/image";
import { scanNutritionLabel } from "@/lib/ocr";
import { fuzzyMatchNames } from "@/lib/fuzzyMatch";
import { COMMON_FOODS, findCommonFood } from "@/lib/commonFoods";

type Mode = "text" | "photo";

export default function AddFoodModal({
  recentFoods,
  foodHistory,
  onClose,
  onSave,
}: {
  recentFoods: FoodEntry[];
  foodHistory: FoodEntry[];
  onClose: () => void;
  onSave: (entry: Omit<FoodEntry, "id" | "dateKey">) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>("text");
  const [itemName, setItemName] = useState("");
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [servings, setServings] = useState("1");
  const [confidenceNote, setConfidenceNote] = useState("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEstimate, setHasEstimate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scannedText, setScannedText] = useState<string | null>(null);
  const [showScannedText, setShowScannedText] = useState(false);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [nameHighlightIndex, setNameHighlightIndex] = useState(0);

  const pastNames = useMemo(
    () => Array.from(new Set(foodHistory.map((f) => f.itemName))),
    [foodHistory]
  );
  const historyNames = useMemo(() => new Set(pastNames), [pastNames]);
  const allFoodNames = useMemo(
    () => Array.from(new Set([...pastNames, ...COMMON_FOODS.map((f) => f.name)])),
    [pastNames]
  );
  const nameSuggestions = useMemo(
    () => fuzzyMatchNames(itemName, allFoodNames, 6, historyNames),
    [itemName, allFoodNames, historyNames]
  );

  // Calories/protein fields hold per-serving values (that's what a label,
  // an AI estimate, or the common-foods db all give you); servings scales
  // that up to what actually gets logged.
  const servingsNum = Number(servings) || 1;
  const totalCalories = Math.round((Number(calories) || 0) * servingsNum);
  const totalProteinG = Math.round((Number(proteinG) || 0) * servingsNum * 10) / 10;

  function selectNameSuggestion(name: string) {
    setShowNameSuggestions(false);
    const pastMatch = foodHistory.find(
      (f) => f.itemName.toLowerCase() === name.toLowerCase()
    );
    if (pastMatch) {
      pickRecent(pastMatch);
      return;
    }
    const common = findCommonFood(name);
    if (common) {
      setItemName(common.name);
      setCalories(String(common.calories));
      setProteinG(String(common.proteinG));
      setServings("1");
      setConfidenceNote(
        `Typical value for ${common.servingHint} — no AI used. Adjust for your actual portion.`
      );
      setHasEstimate(true);
      setError(null);
      return;
    }
    setItemName(name);
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showNameSuggestions || nameSuggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setNameHighlightIndex((i) => Math.min(i + 1, nameSuggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setNameHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectNameSuggestion(nameSuggestions[nameHighlightIndex]);
    } else if (e.key === "Escape") {
      // Modal has its own document-level Escape listener; stop this one
      // from also closing the whole modal (stopPropagation alone doesn't
      // stop a later same-node listener — see LogWorkoutModal for the same fix).
      e.nativeEvent.stopImmediatePropagation();
      setShowNameSuggestions(false);
    }
  }

  async function handlePhotoChange(file: File | undefined) {
    if (!file) return;
    setError(null);
    setScannedText(null);
    setPhotoFile(file);
    const resized = await resizeImageFile(file);
    setPhotoBlob(resized);
    setPhotoPreview(blobToObjectUrl(resized));
    setServings("1");
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
    if (!photoFile) return;
    setError(null);
    setScannedText(null);
    setScanning(true);
    try {
      // Tesseract reads File/Blob objects as raw bytes and never applies
      // EXIF orientation — a phone photo stored as landscape pixels + a
      // "rotate 90°" EXIF flag (the normal case) gets OCR'd sideways and
      // fails silently. Decode through canvas first so the pixels are
      // actually upright, at a size that keeps label text sharp.
      const oriented = await prepareImageForOcr(photoFile);
      const result = await scanNutritionLabel(oriented);
      setScannedText(result.rawText || null);
      if (result.calories == null && result.proteinG == null) {
        throw new Error(
          "Couldn't find calories or protein in that photo. Try a clearer, well-lit, flat-on photo of the label, or use Estimate with AI instead."
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
    setServings("1");
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
    setError(null);
    try {
      const note =
        servingsNum !== 1
          ? `${confidenceNote ? confidenceNote + " " : ""}${servingsNum} servings logged (${
              Number(calories) || 0
            } kcal / ${Number(proteinG) || 0}g protein each).`
          : confidenceNote;
      await onSave({
        timestamp: Date.now(),
        itemName: itemName.trim(),
        calories: totalCalories,
        proteinG: totalProteinG,
        source: mode === "photo" ? "photo" : "typed",
        photoThumbnail: mode === "photo" && photoBlob ? photoBlob : undefined,
        confidenceNote: note || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save — try again.");
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
          {photoPreview && (
            <div className="mb-2 rounded-lg border border-neutral-700 p-2 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoPreview}
                alt="Food preview"
                className="mx-auto max-h-48 rounded-md"
              />
            </div>
          )}
          <div className="flex gap-2">
            <label className="flex-1 cursor-pointer rounded-lg border border-dashed border-neutral-700 py-3 text-center text-sm text-neutral-400 hover:border-emerald-700">
              Take Photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handlePhotoChange(e.target.files?.[0])}
              />
            </label>
            <label className="flex-1 cursor-pointer rounded-lg border border-dashed border-neutral-700 py-3 text-center text-sm text-neutral-400 hover:border-emerald-700">
              Choose from Library
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoChange(e.target.files?.[0])}
              />
            </label>
          </div>
          {photoBlob && (
            <>
              <button
                onClick={runLabelScan}
                disabled={scanning}
                className="mt-2 w-full rounded-lg border border-blue-700 py-2 text-sm font-medium text-blue-400 hover:bg-blue-950 disabled:opacity-40"
              >
                {scanning ? "Reading label…" : "Scan Label (free, no AI)"}
              </button>
              <p className="mt-1 text-center text-xs text-neutral-600">
                Best results: label flat, well-lit, filling the frame
              </p>
            </>
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

        <div className="relative">
          <input
            value={itemName}
            onChange={(e) => {
              setItemName(e.target.value);
              setShowNameSuggestions(true);
              setNameHighlightIndex(0);
            }}
            onFocus={() => setShowNameSuggestions(true)}
            onBlur={() => setShowNameSuggestions(false)}
            onKeyDown={handleNameKeyDown}
            placeholder="Item name (e.g. Grilled chicken breast, banana, egg)"
            autoComplete="off"
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          />
          {mode === "text" && showNameSuggestions && nameSuggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-neutral-700 bg-neutral-900 shadow-lg">
              {nameSuggestions.map((name, i) => {
                const common = findCommonFood(name);
                const past = foodHistory.find(
                  (f) => f.itemName.toLowerCase() === name.toLowerCase()
                );
                return (
                  <li key={name}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectNameSuggestion(name)}
                      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                        i === nameHighlightIndex
                          ? "bg-emerald-950 text-emerald-300"
                          : "text-neutral-200 hover:bg-neutral-800"
                      }`}
                    >
                      <span>{name}</span>
                      {common && (
                        <span className="text-xs text-neutral-500">
                          {common.calories} kcal · {common.servingHint}
                        </span>
                      )}
                      {!common && past && (
                        <span className="text-xs text-neutral-500">
                          {past.calories} kcal · {past.proteinG}g protein
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label className="shrink-0 text-xs font-medium text-neutral-500">
            Servings
          </label>
          <input
            type="number"
            step="0.5"
            min="0.25"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            className="w-20 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100"
          />
        </div>

        {!hasEstimate && (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="Calories per serving (optional)"
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              />
              <input
                type="number"
                value={proteinG}
                onChange={(e) => setProteinG(e.target.value)}
                placeholder="Protein g per serving (optional)"
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              />
            </div>
            {servingsNum !== 1 && (Number(calories) > 0 || Number(proteinG) > 0) && (
              <p className="text-xs font-medium text-emerald-400">
                {servingsNum} servings = {totalCalories} kcal · {totalProteinG}g protein
              </p>
            )}
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
              Estimate (per serving) — edit before saving:
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
            {servingsNum !== 1 && (
              <p className="text-xs font-medium text-emerald-400">
                {servingsNum} servings = {totalCalories} kcal · {totalProteinG}g protein
              </p>
            )}
            {confidenceNote && (
              <p className="text-xs italic text-neutral-500">{confidenceNote}</p>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        {scannedText && (
          <div>
            <button
              type="button"
              onClick={() => setShowScannedText((v) => !v)}
              className="text-xs text-neutral-500 hover:underline"
            >
              {showScannedText ? "Hide" : "View"} scanned text
            </button>
            {showScannedText && (
              <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md bg-neutral-900 p-2 text-xs text-neutral-400">
                {scannedText}
              </pre>
            )}
          </div>
        )}
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
