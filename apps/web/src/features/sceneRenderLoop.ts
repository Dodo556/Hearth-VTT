// Static scenes need one frame per change; transient effects can request more.
export function createSceneRenderLoop(
  render: () => void,
  animate: () => boolean,
  schedule: (callback: FrameRequestCallback) => number = requestAnimationFrame,
  cancel: (frame: number) => void = cancelAnimationFrame,
) {
  let frame: number | null = null;
  let disposed = false;
  function invalidate() {
    if (!disposed && frame === null) frame = schedule(draw);
  }
  function draw() {
    frame = null;
    if (disposed) return;
    const moving = animate();
    render();
    if (moving) invalidate();
  }
  return {
    invalidate,
    dispose() {
      disposed = true;
      if (frame !== null) cancel(frame);
      frame = null;
    },
  };
}
