import { describe, expect, it } from "vitest";
import { sniffImageType } from "@/lib/image-sniff";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe("sniffImageType", () => {
  it("recognises allowed formats by content", () => {
    expect(sniffImageType(bytes([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(sniffImageType(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe("image/png");
    expect(sniffImageType(bytes("RIFF", [0, 0, 0, 0], "WEBP"))?.mime).toBe("image/webp");
    expect(sniffImageType(bytes([0, 0, 0, 0x1c], "ftypavif"))?.mime).toBe("image/avif");
  });

  it("rejects SVG, HTML, executables and disguised files", () => {
    expect(sniffImageType(bytes("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBeNull();
    expect(sniffImageType(bytes("<!doctype html><script>"))).toBeNull();
    expect(sniffImageType(bytes("MZ", [0x90, 0x00]))).toBeNull();
    expect(sniffImageType(bytes("GIF89a"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});
