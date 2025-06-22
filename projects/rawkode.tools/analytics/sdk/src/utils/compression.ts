import pako from 'pako';

export async function compress(data: string): Promise<Uint8Array> {
  try {
    return pako.gzip(data);
  } catch (error) {
    throw new Error(`Compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function decompress(data: Uint8Array): Promise<string> {
  try {
    return pako.ungzip(data, { to: 'string' });
  } catch (error) {
    throw new Error(`Decompression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}