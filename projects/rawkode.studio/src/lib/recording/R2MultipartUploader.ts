export type InitResponse = { uploadId: string; key: string };

type PartRef = { PartNumber: number; ETag: string };

export class R2MultipartUploader {
  private uploadId?: string;
  private parts: PartRef[] = [];
  private partNumber = 1;
  private readonly minPartBytes = 5 * 1024 * 1024; // 5 MiB
  private pending: Uint8Array[] = [];
  private pendingBytes = 0;
  private key?: string;
  private capKbps?: number;
  private windowStart = 0;
  private bytesInWindow = 0;

  constructor(private baseUrl: string, private sessionId: string, private trackId: string, opts?: { capKbps?: number }) {
    this.capKbps = opts?.capKbps;
  }

  setCapKbps(kbps?: number) {
    this.capKbps = kbps;
  }

  async init() {
    const r = await fetch(`${this.baseUrl}/api/uploads/${this.sessionId}/${this.trackId}/init`, { method: "POST" });
    if (!r.ok) throw new Error(`init failed: ${r.status}`);
    const j = (await r.json()) as InitResponse;
    this.uploadId = j.uploadId;
    this.key = j.key;
  }

  async pushChunk(chunk: Uint8Array) {
    this.pending.push(chunk);
    this.pendingBytes += chunk.byteLength;
    if (this.pendingBytes >= this.minPartBytes) {
      await this.flushPart();
    }
  }

  async flush() {
    if (this.pendingBytes > 0) {
      await this.flushPart();
    }
  }

  private async flushPart() {
    if (!this.uploadId) await this.init();
    if (!this.uploadId || !this.key) throw new Error("No uploadId");
    const partNumber = this.partNumber++;
    // concatenate pending into single ArrayBuffer
    const buf = new Uint8Array(this.pendingBytes);
    let offset = 0;
    for (const c of this.pending) {
      buf.set(c, offset);
      offset += c.byteLength;
    }
    this.pending = [];
    this.pendingBytes = 0;

    const sign = await fetch(
      `${this.baseUrl}/api/uploads/${this.sessionId}/${this.trackId}/part?uploadId=${encodeURIComponent(
        this.uploadId
      )}&partNumber=${partNumber}&key=${encodeURIComponent(this.key)}`
    );
    if (!sign.ok) throw new Error(`sign part failed: ${sign.status}`);
    const { url, headers } = (await sign.json()) as { url: string; headers: Record<string, string> };
    await this.maybeThrottle(buf.byteLength);
    const res = await fetch(url, { method: "PUT", headers, body: buf });
    if (!res.ok) throw new Error(`R2 PUT failed: ${res.status}`);
    const etag = (res.headers.get("etag") || "").replace(/\"/g, "");
    this.parts.push({ PartNumber: partNumber, ETag: etag });
  }

  private async maybeThrottle(nextBytes: number) {
    if (!this.capKbps || this.capKbps <= 0) return;
    const now = (globalThis.performance || Date).now();
    if (!this.windowStart) {
      this.windowStart = now as number;
      this.bytesInWindow = 0;
    }
    const elapsedMs = (now as number) - this.windowStart;
    const bytesPerSec = (this.capKbps * 1000) / 8; // bytes/sec
    const allowed = Math.max(0, (elapsedMs / 1000) * bytesPerSec);
    const projected = this.bytesInWindow + nextBytes;
    if (projected > allowed) {
      const waitMs = ((projected - allowed) / bytesPerSec) * 1000;
      await new Promise((r) => setTimeout(r, waitMs));
    }
    // Reset window every 5 seconds
    const after = (globalThis.performance || Date).now() as number;
    if (after - this.windowStart > 5000) {
      this.windowStart = after;
      this.bytesInWindow = 0;
    }
    this.bytesInWindow += nextBytes;
  }

  async complete() {
    await this.flush();
    if (!this.uploadId || !this.key) return;
    const res = await fetch(`${this.baseUrl}/api/uploads/${this.sessionId}/${this.trackId}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uploadId: this.uploadId, parts: this.parts, key: this.key }),
    });
    if (!res.ok) throw new Error(`complete failed: ${res.status}`);
  }
}
