export interface CanvasRenderLoop {
  queuePaint: () => void;
  stop: () => void;
}

export function useCanvasRenderLoop(
  paint: (timestamp: number) => Promise<void>,
  shouldContinue: () => boolean,
): CanvasRenderLoop {
  let frameRequest = 0;
  let paintQueued = false;
  let paintInProgress = false;
  let paintPending = false;
  let stopped = false;

  function queuePaint(): void {
    if (stopped) {
      return;
    }

    if (paintQueued || paintInProgress) {
      paintPending = true;
      return;
    }

    paintQueued = true;
    frameRequest = requestAnimationFrame(async (timestamp) => {
      paintQueued = false;
      paintInProgress = true;

      try {
        await paint(timestamp);
      } catch (error) {
        console.error("Unable to paint studio canvas", error);
      } finally {
        paintInProgress = false;
      }

      if (!stopped && (paintPending || shouldContinue())) {
        paintPending = false;
        queuePaint();
      }
    });
  }

  function stop(): void {
    stopped = true;
    paintPending = false;
    paintQueued = false;
    cancelAnimationFrame(frameRequest);
  }

  return {
    queuePaint,
    stop,
  };
}
