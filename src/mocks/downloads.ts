/**
 * Stub what a file download needs and jsdom lacks: object URLs for jsdom's
 * `Blob`, and an anchor click that would otherwise attempt a navigation jsdom
 * doesn't implement.
 */
export function mockDownloads(): void {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:download");
  vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockReturnValue(undefined);
}
