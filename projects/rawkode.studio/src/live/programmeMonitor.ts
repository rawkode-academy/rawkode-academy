export interface ProgrammeMonitor {
  close(): void;
  focus(): void;
  isOpen(): boolean;
}

/** A clean local output. This does not start a broadcast or own the studio's audio track. */
export function createProgrammeMonitor(popup: Window): {
  attach(stream: MediaStream): Promise<ProgrammeMonitor>;
  close(): void;
} {
  const document = popup.document;
  document.title = "Rawkode Studio | Programme output";
  const style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; background: #000; color: #fff; font: 14px system-ui, sans-serif; overflow: hidden; }
    video { display: block; width: 100%; height: 100%; object-fit: contain; }
    .controls { position: fixed; bottom: 12px; left: 12px; right: 12px; padding: 12px; background: #171717; border: 1px solid #444; border-radius: 8px; }
    .controls p { margin: 0 0 10px; line-height: 1.5; }
    button { border: 1px solid #777; background: #272727; color: #fff; border-radius: 5px; padding: 8px 12px; margin-right: 8px; cursor: pointer; }
    button:focus-visible { outline: 3px solid #38bdf8; }
    .controls[hidden] { display: none; }
  `;
  document.head.appendChild(style);
  const video = document.createElement("video");
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("aria-label", "Live programme output");
  const controls = document.createElement("section");
  controls.className = "controls";
  const hint = document.createElement("p");
  hint.textContent = "Capture this window in your encoder. Audio is muted to prevent feedback. Use headphones before enabling audio, then configure the encoder's application audio capture. Keep the studio open. Press C to show controls.";
  const audioButton = document.createElement("button");
  audioButton.textContent = "Enable programme audio";
  audioButton.setAttribute("aria-pressed", "false");
  audioButton.onclick = () => {
    video.muted = !video.muted;
    audioButton.textContent = video.muted ? "Enable programme audio" : "Mute programme audio";
    audioButton.setAttribute("aria-pressed", String(!video.muted));
    void video.play().catch(() => {
      hint.textContent = "Playback was blocked. Allow media playback in this window, then retry.";
    });
  };
  const hideButton = document.createElement("button");
  hideButton.textContent = "Hide controls";
  hideButton.onclick = () => { controls.hidden = true; };
  const fullscreenButton = document.createElement("button");
  fullscreenButton.textContent = "Fullscreen";
  fullscreenButton.onclick = () => {
    void document.documentElement.requestFullscreen?.().then(() => {
      controls.hidden = true;
    }).catch(() => {
      hint.textContent = "Fullscreen is unavailable. You can still capture this window in your encoder.";
    });
  };
  for (const element of [hint, audioButton, fullscreenButton, hideButton]) controls.appendChild(element);
  document.body.replaceChildren(video, controls);
  const onKey = (event: KeyboardEvent) => {
    if (event.key.toLowerCase() === "c" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      controls.hidden = !controls.hidden;
    }
  };
  popup.addEventListener("keydown", onKey);
  let closed = false;
  let outputStream: MediaStream | undefined;
  let closeTimer: ReturnType<typeof setInterval> | undefined;
  const close = () => {
    if (closed) return;
    closed = true;
    if (closeTimer !== undefined) clearInterval(closeTimer);
    // Every track attached here is a clone. Never stop capture or programme audio.
    for (const track of outputStream?.getTracks() ?? []) track.stop();
    video.pause();
    video.srcObject = null;
    popup.removeEventListener("keydown", onKey);
    popup.removeEventListener("pagehide", close);
    if (!popup.closed) popup.close();
  };
  popup.addEventListener("pagehide", close, { once: true });
  return {
    close,
    async attach(stream) {
      if (closed || popup.closed) throw new Error("The programme output window was closed.");
      outputStream = stream.clone();
      video.srcObject = outputStream;
      try {
        await video.play();
      } catch {
        close();
        throw new Error("The programme output could not play. Allow browser media playback and try again.");
      }
      if (closed || popup.closed) {
        close();
        throw new Error("The programme output window was closed.");
      }
      closeTimer = setInterval(() => { if (popup.closed) close(); }, 500);
      return { close, focus: () => { if (!closed) popup.focus(); }, isOpen: () => !closed && !popup.closed };
    },
  };
}
