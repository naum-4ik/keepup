// Saves data as a pretty-printed .json file through a Blob URL. Browser only: call it from a click handler.
export function downloadJson(fileName: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked later: some browsers start the download after click() returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
