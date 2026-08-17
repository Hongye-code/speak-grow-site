export function createTrainingSession(onTick) {
  let timer = null;
  let seconds = 60;
  let preparation = 0;

  function emit() { onTick({ seconds, preparation, phase: preparation > 0 ? "preparing" : "training" }); }
  function stop() { if (timer) window.clearInterval(timer); timer = null; }
  function start({ preparationSeconds = 5 } = {}) {
    stop();
    seconds = 60;
    preparation = Math.max(0, Number(preparationSeconds) || 0);
    emit();
    timer = window.setInterval(() => {
      if (preparation > 0) {
        preparation -= 1;
        emit();
        return;
      }
      seconds = Math.max(0, seconds - 1);
      emit();
      if (seconds === 0) stop();
    }, 1000);
  }

  return { start, stop, reset() { stop(); seconds = 60; preparation = 0; emit(); } };
}
