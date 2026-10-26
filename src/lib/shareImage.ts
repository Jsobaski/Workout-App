// Share a PNG: the phone's share sheet where files are supported, otherwise a download.
export async function shareImage(blob: Blob, filename: string, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" });
  try {
    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title });
      return "shared";
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled"; // user closed the share sheet
    // any other failure: fall back to a download
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
