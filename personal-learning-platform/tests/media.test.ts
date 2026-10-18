import { describe, it, expect } from "vitest";
import { wavDuration, splitSpeech, joinWav } from "../server/media";
import { zipStream } from "../server/archive";
import { streakFor, weekStart } from "../server/growth";
function wav(seconds: number) {
  const bytes = new Uint8Array(44 + 16000 * 2 * seconds),
    v = new DataView(bytes.buffer),
    e = new TextEncoder();
  bytes.set(e.encode("RIFF"));
  v.setUint32(4, bytes.length - 8, true);
  bytes.set(e.encode("WAVEfmt "), 8);
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  bytes.set(e.encode("data"), 36);
  v.setUint32(40, bytes.length - 44, true);
  return bytes;
}
describe("voice containers and playback", () => {
  it("measures real PCM length and rejects a forged client timer", () => {
    expect(wavDuration(wav(60))).toBe(60);
    expect(() => wavDuration(wav(61))).toThrow();
  });
  it("rejects malformed and compressed audio before paid calls", () => {
    const b = wav(2);
    new DataView(b.buffer).setUint16(20, 3, true);
    expect(() => wavDuration(b)).toThrow();
    expect(() => wavDuration(wav(1).slice(0, 50))).toThrow();
  });
  it("merges compatible speech segments without repeating container headers", () => {
    expect(wavDuration(joinWav([wav(1), wav(2)]))).toBe(3);
  });
  it("keeps every character within supported speech segment lengths", () => {
    const input = "hello ".repeat(500) + "你好。".repeat(300);
    const parts = splitSpeech(input);
    expect(parts.join("")).toBe(input);
    expect(parts.every((p) => p.length <= 500)).toBe(true);
  });
});
describe("archive and growth", () => {
  it("streams UTF-8 ZIP entries and correct final directory", async () => {
    async function* entries() {
      yield { name: "笔记.txt", body: new Blob(["my notes"]).stream() };
      yield {
        name: "raw.bin",
        body: new Blob([new Uint8Array([1, 2, 3])]).stream(),
      };
    }
    const bytes = new Uint8Array(
        await new Response(zipStream(entries())).arrayBuffer(),
      ),
      v = new DataView(bytes.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
    expect(v.getUint16(bytes.length - 12, true)).toBe(2);
    expect(new TextDecoder().decode(bytes)).toContain("my notes");
  });
  it("uses calendar days without DST or UTC conversion drift", () => {
    expect(weekStart("2026-10-18")).toBe("2026-10-12");
    expect(streakFor(["2026-10-16", "2026-10-17"], "2026-10-18")).toBe(2);
    expect(streakFor(["2026-10-16"], "2026-10-18")).toBe(0);
  });
});
