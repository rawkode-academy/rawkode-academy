import { open, stat } from 'node:fs/promises'
import { Rejection } from './contract.mjs'

const reject = () => { throw new Rejection('Unsupported or externally referenced container') }
/** Only inline data references are accepted; neither aliases nor URL tracks may
 * cause FFmpeg to open another file, even with the network disabled. */
export async function inspectMp4(path) {
  const handle = await open(path, 'r'), { size } = await handle.stat()
  let count = 0, major, moov = -1, mdat = -1
  async function read(offset, length) {
    if (offset + length > size) reject()
    const b = Buffer.alloc(length)
    if ((await handle.read(b, 0, length, offset)).bytesRead !== length) reject()
    return b
  }
  async function boxes(start, end, depth = 0) {
    if (depth > 8) reject()
    for (let offset = start; offset < end;) {
      if (++count > 10000 || end - offset < 8) reject()
      const b = await read(offset, 8), type = b.toString('ascii', 4), n = b.readUInt32BE(0)
      let header = 8, length = n || end - offset
      if (n === 1) { header = 16; length = Number((await read(offset + 8, 8)).readBigUInt64BE()) }
      if (!Number.isSafeInteger(length) || length < header || offset + length > end) reject()
      const data = offset + header, stop = offset + length
      if (depth === 0 && type === 'ftyp') { if (length < header + 8 || major) reject(); major = (await read(data, 4)).toString('ascii') }
      if (depth === 0 && type === 'moov') { if (moov >= 0) reject(); moov = offset }
      if (depth === 0 && type === 'mdat' && mdat < 0) mdat = offset
      if (['moov', 'trak', 'mdia', 'minf', 'dinf'].includes(type)) await boxes(data, stop, depth + 1)
      if (type === 'dref') {
        if (length < header + 8 || length > 65536) reject()
        const refs = await read(data, length - header)
        let at = 8
        const entries = refs.readUInt32BE(4)
        if (entries !== 1) reject()
        for (let i = 0; i < entries; i++) {
          if (at + 12 > refs.length) reject()
          const len = refs.readUInt32BE(at), name = refs.toString('ascii', at + 4, at + 8), flags = refs.readUInt32BE(at + 8)
          if (len !== 12 || name !== 'url ' || flags !== 1) reject()
          at += len
        }
        if (at !== refs.length) reject()
      }
      offset = stop
    }
  }
  try {
    await boxes(0, size)
    if (!major || moov < 0 || mdat < 0 || !(major === 'qt  ' || /^(isom|iso[0-9]|mp4[12]|avc1|dash)$/.test(major))) reject()
    return { contentType: major === 'qt  ' ? 'video/quicktime' : 'video/mp4', fastStart: moov < mdat }
  } finally { await handle.close() }
}
function vint(b, offset, keepMarker = false) {
  if (offset >= b.length || !b[offset]) reject()
  let length = 1, marker = 0x80
  while (!(b[offset] & marker)) { marker >>= 1; length++ }
  if (length > 8 || offset + length > b.length) reject()
  let value = keepMarker ? b[offset] : b[offset] & (marker - 1)
  for (let i = 1; i < length; i++) value = value * 256 + b[offset + i]
  if (!Number.isSafeInteger(value)) reject()
  return { value, length }
}
export async function sourceFormat(path) {
  const handle = await open(path, 'r'), first = Buffer.alloc(4096)
  const { bytesRead } = await handle.read(first, 0, first.length, 0)
  await handle.close()
  const b = first.subarray(0, bytesRead)
  if (b.length < 12) reject()
  if (b.readUInt32BE(0) !== 0x1a45dfa3) return inspectMp4(path)
  const length = vint(b, 4), end = 4 + length.length + length.value
  if (end > b.length) reject()
  let doctype
  for (let at = 4 + length.length; at < end;) {
    const id = vint(b, at, true); at += id.length
    const n = vint(b, at); at += n.length
    if (at + n.value > end) reject()
    if (id.value === 0x4282) doctype = b.toString('ascii', at, at + n.value)
    at += n.value
  }
  if (doctype !== 'webm') reject()
  return { contentType: 'video/webm' }
}
export async function inspectWav(path, durationMs) {
  const h = await open(path, 'r'), { size } = await stat(path)
  try {
    const head = Buffer.alloc(12); await h.read(head, 0, 12, 0)
    if (head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8) !== 'WAVE' || head.readUInt32LE(4) + 8 !== size) reject()
    let format = false, dataBytes = 0
    for (let at = 12; at < size;) {
      const chunk = Buffer.alloc(8)
      if ((await h.read(chunk, 0, 8, at)).bytesRead !== 8) reject()
      const n = chunk.readUInt32LE(4), kind = chunk.toString('ascii', 0, 4)
      if (at + 8 + n > size) reject()
      if (kind === 'fmt ') {
        if (n < 16 || n > 64) reject()
        const f = Buffer.alloc(n); await h.read(f, 0, n, at + 8)
        if (f.readUInt16LE(0) !== 1 || f.readUInt16LE(2) !== 1 || f.readUInt32LE(4) !== 16000 || f.readUInt32LE(8) !== 32000 || f.readUInt16LE(12) !== 2 || f.readUInt16LE(14) !== 16) reject()
        format = true
      }
      if (kind === 'data') { if (dataBytes) reject(); dataBytes = n }
      at += 8 + n + (n & 1)
    }
    if (!format || dataBytes !== durationMs * 32) reject()
  } finally { await h.close() }
}
