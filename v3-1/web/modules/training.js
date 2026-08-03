export function createTrainingSession(onTick) {
  let timer = null;
  let seconds = 60;

  function emit() { onTick(seconds); }
  function stop() { if (timer) window.clearInterval(timer); timer = null; }
  function start() {
    stop();
    seconds = 60;
    emit();
    timer = window.setInterval(() => {
      seconds = Math.max(0, seconds - 1);
      emit();
      if (seconds === 0) stop();
    }, 1000);
  }

  return { start, stop, reset() { stop(); seconds = 60; emit(); } };
}
