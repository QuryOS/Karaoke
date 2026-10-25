/**
 * Calidad gráfica automática del karaoke
 * 
 * Qué hace: elige el nivel de calidad según el teléfono y lo baja solo si el juego va lento (menos de ~24 cuadros por segundo).
 * Lo que ajusta: resolución de dibujo, cuadros por segundo de las pantallas con video y luces. Recuerda el nivel alcanzado
 * y, al reabrir el juego, el modelo se construye directamente en la calidad que ese teléfono aguanta.
 * 
 * Uso (antes de crear el renderer y el karaoke):
 *   const info = krqDetect();                                   // { tier, level, pref, adaptive }
 *   const renderer = new THREE.WebGLRenderer({ antialias: info.tier !== 'low' });
 *   const karaoke = createKaraoke(THREE, { quality: info.tier });
 *   const krq = createKaraokeQuality({ renderer, karaoke: karaoke.group, info });
 *   const ui = createKaraokeUI({ screen: karaoke.group.userData.screen, qualityControl: krq });
 *   krq.setUi(ui);
 *   krq.start();
 */
var KRQ_LEVELS = [
  { pr: 2,    fps: 24, lights: 'full' },
  { pr: 1.5,  fps: 24, lights: 'full' },
  { pr: 1,    fps: 15, lights: 'medium' },
  { pr: 0.85, fps: 12, lights: 'low' },
  { pr: 0.7,  fps: 10, lights: 'low' }
];
var KRQ_PREFS = ['auto', 'high', 'medium', 'low'];
var KRQ_LABEL = { auto: 'Automática', high: 'Alta', medium: 'Media', low: 'Baja' };

function krqRead(k, d) {
  try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; }
}
function krqWrite(k, v) {
  try { localStorage.setItem(k, String(v)); } catch (e) {}
}

// Calidad con la que construir el modelo y nivel inicial de ejecución
function krqDetect(nav) {
  nav = nav || (typeof navigator !== 'undefined' ? navigator : {});
  var pref = krqRead('karaoke.quality.pref', 'auto');
  if (KRQ_PREFS.indexOf(pref) < 0) pref = 'auto';
  if (pref === 'high') return { pref: pref, tier: 'high', level: 0, adaptive: false };
  if (pref === 'medium') return { pref: pref, tier: 'medium', level: 1, adaptive: false };
  if (pref === 'low') return { pref: pref, tier: 'low', level: 3, adaptive: false };
  var saved = parseInt(krqRead('karaoke.quality.level', '-1'), 10);
  var mem = nav.deviceMemory || 4, cores = nav.hardwareConcurrency || 4;
  var guess = (mem <= 2 || cores <= 2) ? 'low' : ((mem >= 6 && cores >= 8) ? 'high' : 'medium');
  var tier = saved >= 2 ? 'low' : (saved === 1 ? 'medium' : guess);
  var level = saved >= 0 ? saved : (guess === 'low' ? 2 : (guess === 'medium' ? 1 : 0));
  return { pref: 'auto', tier: tier, level: level, adaptive: true };
}

function createKaraokeQuality(opts) {
  opts = opts || {};
  var info = opts.info || krqDetect();
  var renderer = opts.renderer || null, karaoke = opts.karaoke || null, ui = opts.ui || null;
  var minFps = opts.minFps || 24;
  var pref = info.pref, level = info.level, adaptive = info.adaptive;
  var samples = [], warm = 3, timer = null, lastFrame = 0;

  function apply() {
    var L = KRQ_LEVELS[level];
    var hasWin = typeof window !== 'undefined';
    if (renderer) {
      renderer.setPixelRatio(Math.min((hasWin && window.devicePixelRatio) || 1, L.pr));
      if (hasWin) renderer.setSize(window.innerWidth, window.innerHeight);
    }
    if (ui && ui.setVideoFps) ui.setVideoFps(L.fps);
    if (karaoke && karaoke.userData && karaoke.userData.setQuality) karaoke.userData.setQuality(L.lights);
  }
  // Recibe los cuadros por segundo medidos cada segundo; baja un nivel si van lentos de forma sostenida
  function onSample(fps) {
    if (!adaptive || level >= KRQ_LEVELS.length - 1) return;
    if (warm > 0) { warm--; return; }
    samples.push(fps);
    if (samples.length > 3) samples.shift();
    if (samples.length < 3) return;
    var avg = (samples[0] + samples[1] + samples[2]) / 3;
    if (avg < minFps) {
      level++;
      krqWrite('karaoke.quality.level', level);
      samples = []; warm = 3;
      apply();
    }
  }
  function poll() {
    if (!renderer || !renderer.info || !renderer.info.render) return;
    var f = renderer.info.render.frame, fps = f - lastFrame;
    lastFrame = f;
    if ((typeof document !== 'undefined' && document.hidden) || fps <= 0) return;
    onSample(fps);
  }
  function start() {
    apply();
    if (renderer && renderer.info && renderer.info.render) lastFrame = renderer.info.render.frame;
    if (!timer) timer = setInterval(poll, 1000);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function cycle() {
    pref = KRQ_PREFS[(KRQ_PREFS.indexOf(pref) + 1) % KRQ_PREFS.length];
    krqWrite('karaoke.quality.pref', pref);
    if (pref === 'auto') { var d = krqDetect(); adaptive = true; level = d.level; }
    else { adaptive = false; level = pref === 'high' ? 0 : (pref === 'medium' ? 1 : 3); }
    samples = []; warm = 3;
    apply();
    return 'Calidad: ' + KRQ_LABEL[pref] + '. Se aplica por completo al reabrir el juego.';
  }
  return {
    start: start, stop: stop, apply: apply, cycle: cycle,
    label: function () { return KRQ_LABEL[pref]; },
    level: function () { return level; },
    tier: info.tier,
    setUi: function (u) { ui = u; apply(); },
    _sample: onSample
  };
}
