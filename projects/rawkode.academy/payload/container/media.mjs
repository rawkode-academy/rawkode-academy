import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileDigest, maximumBytes, maximumDurationMs, Rejection } from './contract.mjs'
import { inspectMp4, inspectWav, sourceFormat } from './formats.mjs'

const inputOptions = type => ['-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm', ...(type === 'video/webm' ? [] : ['-enable_drefs', '0', '-use_absolute_path', '0'])]
const common = ['-hide_banner', '-nostdin', '-v', 'error', '-xerror', '-max_alloc', '67108864', '-filter_threads', '1', '-filter_complex_threads', '1']
const input = (path, type) => [...inputOptions(type), '-threads', '1', '-err_detect', 'explode', '-i', path]
/** Child processes never use a shell. A shared request AbortSignal covers upload,
 * every probe/encode, and streaming the response. No stderr is sent to clients. */
export function run(binary, args, signal, watch) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: process.env.PATH, LC_ALL: 'C', TZ: 'UTC' } })
    let output = '', diagnostic = '', failure
    const stop = error => { failure ??= error; child.kill('SIGKILL') }
    const abort = () => stop(new Rejection('Processing aborted', 408))
    signal.addEventListener('abort', abort, { once: true })
    child.stdout.on('data', data => { if (output.length + data.length > 65536) stop(new Rejection('Probe output exceeded its limit')); else output += data })
    child.stderr.on('data', data => { if (diagnostic.length < 16384) diagnostic += data.toString().slice(0, 16384 - diagnostic.length) })
    const timer = watch && setInterval(async () => {
      try { if ((await stat(watch.path)).size > watch.bytes + 1048576) stop(new Rejection('Artifact exceeds its size limit')) } catch { /* File not created yet. */ }
    }, 100)
    const clear = () => { clearInterval(timer); signal.removeEventListener('abort', abort) }
    child.once('error', error => { clear(); reject(new Rejection(`Media executable unavailable: ${error.code ?? 'error'}`, 503)) })
    child.once('close', code => {
      clear()
      if (failure) reject(failure)
      else if (code !== 0) { const error = new Rejection('Media decoding or encoding failed'); error.diagnostic = diagnostic; reject(error) }
      else resolve(output)
    })
  })
}
async function probe(path, context, type) {
  const output = await run(context.ffprobe, ['-v', 'error', '-max_alloc', '67108864', ...inputOptions(type), '-show_format', '-show_streams', '-of', 'json', path], context.signal)
  let result
  try { result = JSON.parse(output) } catch { throw new Rejection('Invalid media probe') }
  const streams = result.streams, video = streams?.filter(s => s.codec_type === 'video'), audio = streams?.filter(s => s.codec_type === 'audio')
  const durationMs = Math.round(Number(result.format?.duration) * 1000)
  if (!Array.isArray(streams) || video.length !== 1 || audio.length > 1 || streams.length !== video.length + audio.length || !Number.isSafeInteger(durationMs) || durationMs < 1 || durationMs > maximumDurationMs) throw new Rejection('Unsupported streams or duration')
  const v = video[0]
  if (![v.width, v.height].every(n => Number.isInteger(n) && n > 0 && n <= 8192) || v.disposition?.attached_pic) throw new Rejection('Unsupported video dimensions')
  const [numerator, denominator] = String(v.avg_frame_rate).split('/').map(Number), fps = numerator / denominator
  if (!Number.isFinite(fps) || fps <= 0 || fps > 120) throw new Rejection('Unsupported video frame rate')
  if (audio.length && (Number(audio[0].sample_rate) > 192000 || audio[0].channels > 8)) throw new Rejection('Unsupported audio layout')
  return { durationMs, video: v, audio: audio[0] }
}
async function fullDecode(path, context, expectedDurationMs, type) {
  const output = await run(context.ffmpeg, [...common, ...input(path, type), '-map', '0:v:0', '-map', '0:a:0?', '-progress', 'pipe:1', '-stats_period', '60', '-threads', '1', '-f', 'null', '-'], context.signal)
  const times = [...output.matchAll(/^out_time_us=(\d+)$/gm)].map(m => Number(m[1]) / 1000)
  const duration = Math.max(...times)
  if (!Number.isFinite(duration) || duration < 1 || duration > maximumDurationMs + 100 || Math.abs(duration - expectedDurationMs) > 1000) throw new Rejection('Decoded duration does not match bounded media')
}
export async function inspectSource(path, job, context) {
  const format = await sourceFormat(path)
  if (format.contentType !== job.contentType) throw new Rejection('Source MIME does not match the actual container')
  const media = await probe(path, context, format.contentType)
  await fullDecode(path, context, media.durationMs, format.contentType)
  return { ...media, contentType: format.contentType }
}
export async function encode(path, directory, media, context) {
  const target = join(directory, 'deliverable.mp4')
  await run(context.ffmpeg, [...common, ...input(path, media.contentType), '-map', '0:v:0', '-map', '0:a:0?', '-map_metadata', '-1', '-map_chapters', '-1',
    '-vf', 'scale=w=min(1280\\,iw):h=min(720\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', '-threads', '1', '-flags:v', '+bitexact',
    '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '48000', '-flags:a', '+bitexact', '-fflags', '+bitexact',
    '-movflags', '+faststart', '-fs', String(maximumBytes + 1), '-f', 'mp4', target], context.signal, { path: target, bytes: maximumBytes })
  const artifact = await fileDigest(target)
  if (!artifact.bytes || artifact.bytes > maximumBytes) throw new Rejection('Encoded output exceeds its size limit')
  const output = await probe(target, context), format = await inspectMp4(target)
  if (output.video.codec_name !== 'h264' || (output.audio && output.audio.codec_name !== 'aac') || Boolean(output.audio) !== Boolean(media.audio) || format.contentType !== 'video/mp4' || !format.fastStart || Math.abs(output.durationMs - media.durationMs) > 250) throw new Rejection('Encoded output failed the delivery contract')
  await fullDecode(target, context, output.durationMs)
  return {
    fields: { durationMs: output.durationMs, videoCodec: 'h264', audioCodec: output.audio ? 'aac' : 'none', width: output.video.width, height: output.video.height, fastStart: true, fullDecode: true },
    artifacts: [{ kind: 'deliverable', index: 0, ...artifact }], files: [target],
  }
}
export async function extractAudio(path, directory, media, context) {
  const artifacts = [], files = []
  if (media.audio) {
    for (let startMs = 0, index = 0; startMs < media.durationMs; startMs += 60000, index++) {
      context.signal.throwIfAborted()
      if (index >= 120) throw new Rejection('Audio exceeds its chunk limit')
      const durationMs = Math.min(60000, media.durationMs - startMs), target = join(directory, `audio-${index}.wav`)
      await run(context.ffmpeg, [...common, ...inputOptions(media.contentType), '-threads', '1', '-err_detect', 'explode', '-ss', String(startMs / 1000), '-i', path,
        '-map', '0:a:0', '-vn', '-map_metadata', '-1', '-map_chapters', '-1', '-af', 'aresample=16000:async=1:first_pts=0,apad',
        '-t', String(durationMs / 1000), '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', '-threads', '1', '-fflags', '+bitexact',
        '-flags:a', '+bitexact', '-fs', '2097153', '-f', 'wav', target], context.signal, { path: target, bytes: 2097152 })
      const artifact = await fileDigest(target)
      if (!artifact.bytes || artifact.bytes > 2097152) throw new Rejection('Audio exceeds its byte limit')
      await inspectWav(target, durationMs)
      artifacts.push({ kind: 'audio', index, ...artifact, startMs, durationMs }); files.push(target)
    }
  }
  return { fields: { durationMs: media.durationMs, noAudio: !media.audio }, artifacts, files }
}
