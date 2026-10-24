/**
 * Interfaz de la tableta del karaoke
 * 
 * Opciones: 1) lista de canciones leída de musica/songs.json, 2) subir una canción (Litterbox, archivos temporales), 3) sala con código grupal (P2P)
 * Incluye: aviso de derechos de autor antes de subir y antes de entrar a una sala, reproductor, letra sincronizada (.lrc) en las pantallas del lugar
 * 
 * Uso:
 *   const ui = createKaraokeUI({ screen: karaoke.group.userData.screen });
 *   ui.attachTo(THREE, camera, renderer.domElement, karaoke.group); // tocar una tableta abre el menú
 *   ui.open();                                                     // o abrirlo desde un botón
 * 
 * Opciones (todas opcionales):
 *   catalogUrl, basePath, screen, reportEmail, maxUploadMB, peerOptions, playerName, autoAcceptRequests
 * 
 * Requiere (solo para salas por internet): PeerJS → <script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js">
 * Sin PeerJS las salas funcionan en modo local de pruebas (dos pestañas del mismo navegador).
 */

// ---------- Funciones puras (se pueden probar sin navegador) ----------
var KRK_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function krkMakeCode() {
  var s = '';
  for (var i = 0; i < 5; i++) s += KRK_CODE_CHARS.charAt(Math.floor(Math.random() * KRK_CODE_CHARS.length));
  return s;
}
function krkNormalizeCode(t) {
  return String(t || '').toUpperCase().replace(/^\s*KRK-?/, '').replace(/[^A-Z0-9]/g, '');
}
function krkFmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  var m = Math.floor(sec / 60), r = sec % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}
// ts en milisegundos (o null = sin vencimiento)
function krkExpiryLabel(ts, now) {
  if (!ts) return '';
  var ms = ts - (now || Date.now());
  if (ms <= 0) return 'Expirada';
  if (ms >= 3600000) return 'Expira en ' + Math.floor(ms / 3600000) + ' h';
  return 'Expira en ' + Math.max(1, Math.ceil(ms / 60000)) + ' min';
}
function krkParseExpiry(v) {
  if (v == null || v === '') return null;
  var t = typeof v === 'number' ? v : Date.parse(v);
  return isNaN(t) ? null : t;
}
function krkResolve(base, path) {
  if (!path) return '';
  return /^(https?:|data:|blob:|\/)/i.test(path) ? path : (base || '') + path;
}
// Convierte texto .lrc en [{t: segundos, text}]
function krkParseLRC(text) {
  var out = [], re = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  String(text || '').split(/\r?\n/).forEach(function (line) {
    var stamps = [], m, last = 0;
    re.lastIndex = 0;
    while ((m = re.exec(line))) {
      var frac = m[3] ? parseInt(m[3], 10) / Math.pow(10, m[3].length) : 0;
      stamps.push(parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + frac);
      last = re.lastIndex;
    }
    var txt = line.slice(last).trim();
    stamps.forEach(function (t) { out.push({ t: t, text: txt }); });
  });
  out.sort(function (a, b) { return a.t - b.t; });
  return out;
}
// Línea actual, anterior y siguientes para una posición (segundos)
function krkLineAt(lrc, pos) {
  var lo = 0, hi = lrc.length - 1, idx = -1;
  while (lo <= hi) {
    var mid = (lo + hi) >> 1;
    if (lrc[mid].t <= pos) { idx = mid; lo = mid + 1; } else hi = mid - 1;
  }
  function tx(i) { return i >= 0 && i < lrc.length ? (lrc[i].text || '\u266A') : ''; }
  var progress = 0;
  if (idx >= 0) {
    var t0 = lrc[idx].t, t1 = idx + 1 < lrc.length ? lrc[idx + 1].t : t0 + 4;
    progress = Math.min(1, Math.max(0, (pos - t0) / Math.max(0.2, t1 - t0)));
  }
  return { i: idx, prev: tx(idx - 1), cur: idx >= 0 ? tx(idx) : '', next: tx(idx + 1), next2: tx(idx + 2), progress: progress };
}

var KRK_CSS = [
  '#krk-ui{position:fixed;inset:0;z-index:99999;display:none;background:rgba(8,4,14,.78);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#f4ecdc}',
  '#krk-ui.k-open{display:block}',
  '#krk-ui *{box-sizing:border-box}',
  '#krk-ui .k-sheet{position:absolute;inset:0;max-width:820px;margin:0 auto;display:flex;flex-direction:column;background:linear-gradient(160deg,#1a0f2a,#2a1233 60%,#3a1530)}',
  '#krk-ui .k-top{display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(0,0,0,.35)}',
  '#krk-ui .k-top h2{flex:1;margin:0;font-size:18px;color:#ffd9a0;font-weight:700}',
  '#krk-ui .k-body{flex:1;overflow:auto;padding:14px;-webkit-overflow-scrolling:touch}',
  '#krk-ui .k-screen{display:none}',
  '#krk-ui .k-screen.k-on{display:block}',
  '#krk-ui button{font:inherit;cursor:pointer}',
  '#krk-ui .k-btn{padding:12px 16px;border:0;border-radius:12px;background:#d4a24c;color:#1a1020;font-weight:700;font-size:16px}',
  '#krk-ui .k-btn:disabled{opacity:.4;cursor:default}',
  '#krk-ui .k-ghost{padding:8px 12px;border:1px solid rgba(255,255,255,.25);border-radius:10px;background:transparent;color:#f4ecdc;font-size:16px}',
  '#krk-ui .k-danger{background:#e0566a;color:#fff}',
  '#krk-ui .k-home{display:grid;gap:14px}',
  '#krk-ui .k-tile{display:flex;align-items:center;gap:14px;padding:18px;border-radius:16px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:inherit;font-size:18px;text-align:left;width:100%}',
  '#krk-ui .k-tile b{display:block;font-size:19px}',
  '#krk-ui .k-tile small{color:#b8a9c9;font-size:14px}',
  '#krk-ui .k-ico{flex:none;width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:#10131f}',
  '#krk-ui .k-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:12px}',
  '#krk-ui .k-card{background:rgba(255,255,255,.06);border:0;border-radius:12px;padding:8px;color:inherit;text-align:left}',
  '#krk-ui .k-card.k-off{opacity:.45}',
  '#krk-ui .k-cover{position:relative;aspect-ratio:16/9;border-radius:8px;background:linear-gradient(135deg,#6a1f33,#24405e) center/cover;display:flex;align-items:center;justify-content:center;font-size:34px;color:rgba(255,255,255,.8);overflow:hidden}',
  '#krk-ui .k-badge{position:absolute;right:5px;bottom:5px;background:rgba(0,0,0,.72);font-size:11px;padding:2px 6px;border-radius:6px;color:#fff}',
  '#krk-ui .k-ct{margin:8px 2px 2px;font-weight:700;font-size:15px;line-height:1.2}',
  '#krk-ui .k-cs{margin:0 2px 2px;font-size:12px;color:#b8a9c9}',
  '#krk-ui .k-in{width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.35);color:inherit;font-size:16px}',
  '#krk-ui label{display:block;margin:14px 0 6px;color:#ffd9a0;font-size:14px}',
  '#krk-ui .k-check{display:flex;gap:12px;align-items:flex-start;margin:18px 0}',
  '#krk-ui .k-check input{flex:none;width:24px;height:24px;margin-top:2px}',
  '#krk-ui .k-gate li{margin:10px 0;line-height:1.4}',
  '#krk-ui .k-bar{height:8px;border-radius:4px;background:rgba(255,255,255,.15);overflow:hidden;margin:10px 0}',
  '#krk-ui .k-bar>i{display:block;height:100%;width:0;background:#d4a24c}',
  '#krk-ui .k-code{font-size:34px;letter-spacing:3px;font-weight:800;text-align:center;color:#ffd9a0;padding:14px;border:2px dashed #d4a24c;border-radius:14px;user-select:all;-webkit-user-select:all;margin:12px 0}',
  '#krk-ui .k-row{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}',
  '#krk-ui .k-muted{color:#b8a9c9;font-size:14px}',
  '#krk-ui .k-err{color:#ff8fa0}',
  '#krk-ui .k-sec{padding:14px;margin:12px 0;border-radius:14px;background:rgba(255,255,255,.05)}',
  '#krk-ui .k-sec h3{margin:0 0 6px;font-size:17px;color:#ffd9a0}',
  '#krk-ui .k-big{aspect-ratio:16/9;max-height:34vh;margin:0 auto 12px;font-size:60px}',
  '#krk-ui .k-mini{display:none;align-items:center;gap:10px;padding:10px 12px;background:rgba(0,0,0,.5);border-top:1px solid rgba(255,255,255,.1)}',
  '#krk-ui .k-mini.k-on{display:flex}',
  '#krk-ui .k-mini span{flex:1;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '#krk-ui .k-toast{position:absolute;left:50%;bottom:76px;transform:translateX(-50%);max-width:90%;padding:10px 16px;border-radius:12px;background:rgba(0,0,0,.88);color:#fff;font-size:14px;opacity:0;pointer-events:none;transition:opacity .25s;text-align:center}',
  '#krk-ui .k-toast.k-on{opacity:1}'
].join('\n');

var KRK_GATE = {
  upload: {
    title: 'Antes de subir una canción',
    items: [
      'Sube solo música o videos que sean tuyos o para los que tengas permiso de su autor.',
      'No subas canciones, videos ni letras de otras personas sin autorización.',
      'El archivo se guarda en un servicio temporal y se borra solo (entre 1 y 72 horas). Aquí no se revisa lo que se sube.',
      'Todos los que estén en tu sala podrán escuchar y ver lo que compartas.'
    ],
    check: 'Confirmo que tengo permiso para compartir este contenido.',
    ok: 'Continuar'
  },
  room: {
    title: 'Antes de entrar a la sala',
    items: [
      'Lo que se reproduzca en la sala lo escucharán y verán todos los conectados.',
      'Comparte solo contenido propio o con permiso de su autor.',
      'Si ves algo que no debería estar aquí, usa el botón «Reportar contenido».',
      'Los archivos temporales desaparecen solos cuando termina su tiempo.'
    ],
    check: 'Entiendo y acepto estas reglas.',
    ok: 'Entrar'
  }
};

function createKaraokeUI(opts) {
  opts = opts || {};
  var cfg = {
    catalogUrl: opts.catalogUrl || 'musica/songs.json',
    basePath: opts.basePath != null ? opts.basePath : 'musica/',
    screen: opts.screen || null,
    reportEmail: opts.reportEmail || '',
    uploadUrl: opts.uploadUrl || 'https://litterbox.catbox.moe/resources/internals/api.php',
    maxUploadMB: opts.maxUploadMB || 100,
    peerOptions: opts.peerOptions || {},
    tapRange: opts.tapRange || 12,
    autoAcceptRequests: opts.autoAcceptRequests !== false,
    playerName: opts.playerName || ('Invitado ' + Math.floor(100 + Math.random() * 900))
  };
  var STORE_KEY = 'karaoke.uploads.v1';

  // ---------- Estado ----------
  var catalog = [], mine = [], catalogError = '';
  var cur = null;        // { song, lrc, cover, startedAt }
  var room = null;       // { code, role, tr, peers:{id:name}, myId, connected }
  var clockOffset = 0;   // ms que hay que sumar a la hora local para obtener la del anfitrión
  var stack = ['home'];
  var gateOk = null;
  var audio = new Audio();
  audio.preload = 'auto';
  var timers = [];
  var attached = null;
  var destroyed = false;

  function noop() {}
  function isHost() { return !!room && room.role === 'host'; }
  function isGuest() { return !!room && room.role === 'guest'; }

  // ---------- DOM ----------
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k === 'value' || k === 'checked' || k === 'disabled') e[k] = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) {
      if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  var styleEl = el('style', { text: KRK_CSS });
  document.head.appendChild(styleEl);

  var root = el('div', { id: 'krk-ui', role: 'dialog', 'aria-label': 'Menú del karaoke' });
  var sheet = el('div', { class: 'k-sheet' });
  var titleEl = el('h2', { text: 'Karaoke' });
  var backBtn = el('button', { class: 'k-ghost', 'aria-label': 'Volver', text: '\u2190', onclick: function () { back(); } });
  var closeBtn = el('button', { class: 'k-ghost', 'aria-label': 'Cerrar', text: '\u2715', onclick: function () { close(); } });
  var body = el('div', { class: 'k-body' });
  var toastEl = el('div', { class: 'k-toast' });
  sheet.appendChild(el('div', { class: 'k-top' }, [backBtn, titleEl, closeBtn]));
  sheet.appendChild(body);

  var screens = {};
  ['home', 'gate', 'list', 'upload', 'room', 'player'].forEach(function (n) {
    screens[n] = el('div', { class: 'k-screen' });
    body.appendChild(screens[n]);
  });

  // Mini reproductor
  var miniTitle = el('span', { text: '' });
  var miniBtn = el('button', { class: 'k-ghost', text: '\u23EF', 'aria-label': 'Pausar o reanudar', onclick: function () { togglePlay(); } });
  var mini = el('div', { class: 'k-mini' }, [
    el('button', { class: 'k-ghost', text: '\u266B', 'aria-label': 'Abrir reproductor', onclick: function () { go('player'); } }),
    miniTitle, miniBtn
  ]);
  sheet.appendChild(mini);
  sheet.appendChild(toastEl);
  root.appendChild(sheet);
  document.body.appendChild(root);

  var titles = { home: 'Karaoke', gate: 'Aviso', list: 'Lista de canciones', upload: 'Subir una canción', room: 'Sala', player: 'Reproductor' };
  function go(name, noPush) {
    if (!noPush && stack[stack.length - 1] !== name) stack.push(name);
    Object.keys(screens).forEach(function (k) { screens[k].classList.toggle('k-on', k === name); });
    titleEl.textContent = titles[name] || 'Karaoke';
    backBtn.style.visibility = stack.length > 1 ? 'visible' : 'hidden';
    if (name === 'list') renderList();
    if (name === 'player') renderPlayer();
    if (name === 'room') renderRoom();
    body.scrollTop = 0;
  }
  function back() {
    if (stack.length > 1) stack.pop();
    go(stack[stack.length - 1], true);
  }
  function open() { root.classList.add('k-open'); go(stack[stack.length - 1], true); }
  function close() { root.classList.remove('k-open'); }
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('k-on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('k-on'); }, 2800);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);

  // ---------- Pantalla: inicio ----------
  function tile(color, icon, title, sub, fn) {
    return el('button', { class: 'k-tile', onclick: fn }, [
      el('span', { class: 'k-ico', style: 'background:' + color, text: icon }),
      el('span', {}, [el('b', { text: title }), el('small', { text: sub })])
    ]);
  }
  screens.home.appendChild(el('div', { class: 'k-home' }, [
    tile('#d4a24c', '\u266B', 'Lista de canciones', 'Elige una canción y canta', function () { go('list'); }),
    tile('#2a8a8a', '\u2191', 'Subir una canción', 'Archivo temporal de 1 a 72 horas', function () { openGate('upload', function () { go('upload'); }); }),
    tile('#c85a7a', '#', 'Sala con código', 'Canta con tus amigos', function () { openGate('room', function () { go('room'); }); })
  ]));

  // ---------- Pantalla: aviso de derechos ----------
  var gateTitle = el('h3', { style: 'margin:0 0 6px;color:#ffd9a0;font-size:20px' });
  var gateList = el('ul', { class: 'k-gate', style: 'padding-left:20px' });
  var gateCheck = el('input', { type: 'checkbox', id: 'krk-gate-check' });
  var gateLabel = el('label', { for: 'krk-gate-check', style: 'margin:0;color:inherit;font-size:16px' });
  var gateBtn = el('button', { class: 'k-btn', disabled: true, onclick: function () {
    if (!gateCheck.checked) return;
    var fn = gateOk; gateOk = null;
    stack.pop();
    if (fn) fn();
  } });
  gateCheck.addEventListener('change', function () { gateBtn.disabled = !gateCheck.checked; });
  var reportBtn = el('button', { class: 'k-ghost', text: 'Reportar contenido', onclick: function () { report(); } });
  screens.gate.appendChild(gateTitle);
  screens.gate.appendChild(gateList);
  screens.gate.appendChild(el('div', { class: 'k-check' }, [gateCheck, gateLabel]));
  screens.gate.appendChild(el('div', { class: 'k-row' }, [gateBtn, reportBtn]));

  function openGate(kind, onOk) {
    var g = KRK_GATE[kind];
    gateTitle.textContent = g.title;
    clear(gateList);
    g.items.forEach(function (t) { gateList.appendChild(el('li', { text: t })); });
    gateLabel.textContent = g.check;
    gateBtn.textContent = g.ok;
    gateCheck.checked = false;
    gateBtn.disabled = true;
    gateOk = onOk;
    go('gate');
  }
  function report() {
    if (cfg.reportEmail) {
      var subj = encodeURIComponent('Reporte de contenido - Karaoke');
      var bodyTxt = encodeURIComponent('Sala: ' + (room ? room.code : '-') + '\nCanción: ' + (cur ? cur.song.titulo + ' (' + cur.song.audio + ')' : '-') + '\n\nMotivo:');
      window.location.href = 'mailto:' + cfg.reportEmail + '?subject=' + subj + '&body=' + bodyTxt;
    } else {
      toast('Aún no hay un correo de reportes configurado (opción reportEmail).');
    }
  }

  // ---------- Catálogo y subidas propias ----------
  function loadMine() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      mine = raw ? JSON.parse(raw) : [];
    } catch (e) { mine = []; }
    var limit = Date.now() - 24 * 3600000;
    mine = mine.filter(function (s) { return !s.expira || s.expira > limit; });
  }
  function saveMine() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(mine)); }
    catch (e) {
      mine.forEach(function (s) { s.portada = null; });
      try { localStorage.setItem(STORE_KEY, JSON.stringify(mine)); } catch (e2) { toast('No se pudo guardar tu lista en este dispositivo.'); }
    }
  }
  function loadCatalog() {
    catalogError = '';
    return fetch(cfg.catalogUrl, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (list) {
        catalog = (Array.isArray(list) ? list : []).filter(function (s) { return s && s.titulo && s.audio; }).map(function (s) {
          return { id: String(s.id || s.titulo), titulo: String(s.titulo), artista: s.artista || '', audio: s.audio, portada: s.portada || null, letra: s.letra || null, expira: krkParseExpiry(s.expira), propia: false };
        });
        renderList();
      })
      .catch(function (e) {
        catalog = [];
        catalogError = 'No se pudo leer ' + cfg.catalogUrl + ' (' + (e && e.message || e) + '). Abre el juego desde un servidor, no como archivo local.';
        renderList();
      });
  }
  function allSongs() { return mine.concat(catalog); }
  function isExpired(s) { return !!s.expira && s.expira <= Date.now(); }

  // ---------- Pantalla: lista (estilo YouTube) ----------
  var searchIn = el('input', { class: 'k-in', type: 'search', placeholder: 'Buscar canción...', 'aria-label': 'Buscar' });
  searchIn.addEventListener('input', function () { renderList(); });
  var gridEl = el('div', { class: 'k-grid' });
  var listMsg = el('p', { class: 'k-muted' });
  screens.list.appendChild(searchIn);
  screens.list.appendChild(listMsg);
  screens.list.appendChild(gridEl);

  function coverNode(song, cls) {
    var c = el('div', { class: 'k-cover ' + (cls || '') });
    if (song.portada) c.style.backgroundImage = 'url("' + String(krkResolve(cfg.basePath, song.portada)).replace(/"/g, '%22') + '")';
    else c.textContent = '\u266A';
    return c;
  }
  function renderList() {
    clear(gridEl);
    var q = searchIn.value.trim().toLowerCase();
    var list = allSongs().filter(function (s) { return !q || (s.titulo + ' ' + (s.artista || '')).toLowerCase().indexOf(q) >= 0; });
    listMsg.textContent = catalogError || (list.length ? '' : (q ? 'Sin resultados.' : 'Todavía no hay canciones. Agrega entradas a ' + cfg.catalogUrl + ' o sube una.'));
    listMsg.className = catalogError ? 'k-err' : 'k-muted';
    list.forEach(function (s) {
      var off = isExpired(s);
      var cv = coverNode(s);
      var lab = krkExpiryLabel(s.expira);
      if (lab) cv.appendChild(el('span', { class: 'k-badge', text: lab }));
      var card = el('button', { class: 'k-card' + (off ? ' k-off' : ''), onclick: function () { chooseSong(s); } }, [
        cv,
        el('p', { class: 'k-ct', text: s.titulo }),
        el('p', { class: 'k-cs', text: s.propia ? 'Tu subida' : (s.artista || '') })
      ]);
      gridEl.appendChild(card);
    });
  }

  // ---------- Pantalla: subir ----------
  var fileIn = el('input', { class: 'k-in', type: 'file', accept: 'audio/*,video/*' });
  var nameIn = el('input', { class: 'k-in', type: 'text', maxlength: '80', placeholder: 'Nombre de la canción' });
  var timeSel = el('select', { class: 'k-in' }, [
    el('option', { value: '1', text: '1 hora' }), el('option', { value: '12', text: '12 horas' }),
    el('option', { value: '24', text: '24 horas', selected: 'selected' }), el('option', { value: '72', text: '72 horas' })
  ]);
  timeSel.value = '24';
  var linkIn = el('input', { class: 'k-in', type: 'url', placeholder: 'https://... (enlace directo a un mp3/mp4)' });
  var upBar = el('i');
  var upBarWrap = el('div', { class: 'k-bar', style: 'display:none' }, [upBar]);
  var upMsg = el('p', { class: 'k-muted' });
  var upBtn = el('button', { class: 'k-btn', text: 'Subir', onclick: function () { doUpload(); } });
  fileIn.addEventListener('change', function () {
    var f = fileIn.files && fileIn.files[0];
    if (f && !nameIn.value) nameIn.value = f.name.replace(/\.[^.]+$/, '').slice(0, 80);
  });
  [
    el('label', { text: 'Archivo de audio o video' }), fileIn,
    el('label', { text: 'Nombre' }), nameIn,
    el('label', { text: 'Duración del archivo en el servicio' }), timeSel,
    el('label', { text: 'O pega un enlace directo (si la subida falla)' }), linkIn,
    el('div', { class: 'k-row' }, [upBtn]), upBarWrap, upMsg,
    el('p', { class: 'k-muted', text: 'Tamaño máximo en este juego: ' + cfg.maxUploadMB + ' MB. El servicio borra el archivo cuando termina el tiempo elegido.' })
  ].forEach(function (n) { screens.upload.appendChild(n); });

  function uploadFile(file, hours, onProgress, cb) {
    var fd = new FormData();
    fd.append('reqtype', 'fileupload');
    fd.append('time', hours + 'h');
    fd.append('fileToUpload', file, file.name);
    var xhr = new XMLHttpRequest();
    xhr.open('POST', cfg.uploadUrl);
    xhr.upload.onprogress = function (e) { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = function () {
      var t = String(xhr.responseText || '').trim();
      if (xhr.status >= 200 && xhr.status < 300 && /^https?:\/\//i.test(t)) cb(null, t);
      else cb(new Error(t.slice(0, 120) || ('HTTP ' + xhr.status)));
    };
    xhr.onerror = function () { cb(new Error('No se pudo conectar (sin internet o el servicio bloqueó la petición).')); };
    xhr.send(fd);
  }
  function makeThumb(file, cb) {
    if (!file || !/^video\//.test(file.type || '')) return cb(null);
    var done = false, url = null;
    function fin(v) { if (done) return; done = true; if (url) { try { URL.revokeObjectURL(url); } catch (e) {} } cb(v); }
    try {
      var v = document.createElement('video');
      v.muted = true; v.preload = 'metadata';
      url = URL.createObjectURL(file);
      v.onloadeddata = function () { try { v.currentTime = Math.min(1, (v.duration || 2) / 2); } catch (e) { fin(null); } };
      v.onseeked = function () {
        try {
          var c = document.createElement('canvas'); c.width = 320; c.height = 180;
          c.getContext('2d').drawImage(v, 0, 0, 320, 180);
          fin(c.toDataURL('image/jpeg', 0.6));
        } catch (e) { fin(null); }
      };
      v.onerror = function () { fin(null); };
      v.src = url;
      setTimeout(function () { fin(null); }, 5000);
    } catch (e) { fin(null); }
  }
  function addMine(song) {
    mine.unshift(song);
    saveMine();
    renderList();
    upMsg.className = 'k-muted';
    upMsg.textContent = 'Lista: "' + song.titulo + '" ' + (krkExpiryLabel(song.expira) ? '(' + krkExpiryLabel(song.expira).toLowerCase() + ')' : '') + '.';
    upBtn.disabled = false;
    toast('Canción agregada a tu lista');
    clear(upBarWrap); upBarWrap.style.display = 'none';
    upBarWrap.appendChild(upBar);
    var go1 = el('button', { class: 'k-btn', text: 'Reproducir ahora', onclick: function () { chooseSong(song); } });
    var go2 = el('button', { class: 'k-ghost', text: 'Ver lista', onclick: function () { go('list'); } });
    upMsg.appendChild(el('div', { class: 'k-row' }, [go1, go2]));
  }
  function doUpload() {
    var title = (nameIn.value || '').trim().slice(0, 80);
    var link = (linkIn.value || '').trim();
    var file = fileIn.files && fileIn.files[0];
    var hours = parseInt(timeSel.value, 10) || 24;
    upMsg.className = 'k-muted'; upMsg.textContent = '';
    if (link) {
      if (!/^https?:\/\//i.test(link)) { upMsg.className = 'k-err'; upMsg.textContent = 'El enlace debe empezar con http:// o https://'; return; }
      addMine({ id: 'u-' + Date.now(), titulo: title || 'Canción', artista: '', audio: link, portada: null, letra: null, expira: null, propia: true });
      linkIn.value = ''; nameIn.value = '';
      return;
    }
    if (!file) { upMsg.className = 'k-err'; upMsg.textContent = 'Elige un archivo o pega un enlace.'; return; }
    if (file.size > cfg.maxUploadMB * 1048576) { upMsg.className = 'k-err'; upMsg.textContent = 'El archivo pesa más de ' + cfg.maxUploadMB + ' MB.'; return; }
    upBtn.disabled = true;
    upBarWrap.style.display = 'block'; upBar.style.width = '0%';
    upMsg.textContent = 'Subiendo...';
    uploadFile(file, hours, function (p) { upBar.style.width = Math.round(p * 100) + '%'; }, function (err, url) {
      if (err) { upBtn.disabled = false; upBarWrap.style.display = 'none'; upMsg.className = 'k-err'; upMsg.textContent = 'No se pudo subir: ' + err.message; return; }
      makeThumb(file, function (thumb) {
        addMine({ id: 'u-' + Date.now(), titulo: title || file.name, artista: '', audio: url, portada: thumb, letra: null, expira: Date.now() + hours * 3600000, propia: true });
        fileIn.value = ''; nameIn.value = '';
      });
    });
  }

  // ---------- Reproductor y pantallas del lugar ----------
  function pub(song) {
    var p = song.portada;
    if (p && /^data:/.test(p) && p.length > 40000) p = null;
    return { id: song.id, titulo: song.titulo, artista: song.artista || '', audio: song.audio, portada: p, letra: song.letra || null, expira: song.expira || null, propia: !!song.propia };
  }
  function loadSong(song) {
    var me = { song: song, lrc: [], cover: null, startedAt: 0 };
    cur = me;
    audio.src = krkResolve(cfg.basePath, song.audio);
    if (song.letra) {
      fetch(krkResolve(cfg.basePath, song.letra))
        .then(function (r) { return r.ok ? r.text() : ''; })
        .then(function (t) { if (cur === me) me.lrc = krkParseLRC(t); })
        .catch(noop);
    }
    if (song.portada) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () { if (cur === me) me.cover = img; };
      img.onerror = noop;
      img.src = krkResolve(cfg.basePath, song.portada);
    }
    return me;
  }
  function playLocal(song) {
    loadSong(song);
    cur.startedAt = Date.now();
    var p = audio.play();
    if (p && p.catch) p.catch(function () { toast('Toca \u25B6 para iniciar el audio'); });
    refresh();
  }
  function chooseSong(song) {
    if (isExpired(song)) { toast('Esta canción ya expiró'); return; }
    if (isGuest()) {
      room.tr.send({ t: 'req', song: pub(song), name: cfg.playerName });
      toast('Propuesta enviada al anfitrión');
      return;
    }
    playLocal(song);
    if (isHost()) room.tr.send({ t: 'play', song: pub(song), startedAt: cur.startedAt });
    go('player');
  }
  function remoteStart(song, startedAt, paused, pos) {
    var me = loadSong(song);
    me.startedAt = startedAt;
    function begin() {
      var p = paused ? (pos || 0) : Math.max(0, (Date.now() + clockOffset - startedAt) / 1000);
      try { audio.currentTime = p; } catch (e) {}
      if (paused) audio.pause();
      else { var pr = audio.play(); if (pr && pr.catch) pr.catch(function () { toast('Toca \u25B6 para activar el audio'); }); }
      refresh();
    }
    if (audio.readyState >= 1) begin();
    else {
      var once = function () { audio.removeEventListener('loadedmetadata', once); if (cur === me) begin(); };
      audio.addEventListener('loadedmetadata', once);
    }
    refresh();
  }
  function togglePlay() {
    if (!cur) return;
    if (isGuest()) { toast('Lo controla el anfitrión'); return; }
    if (audio.paused) {
      cur.startedAt = Date.now() - audio.currentTime * 1000;
      var p = audio.play(); if (p && p.catch) p.catch(noop);
      if (isHost()) room.tr.send({ t: 'resume', startedAt: cur.startedAt });
    } else {
      audio.pause();
      if (isHost()) room.tr.send({ t: 'pause', pos: audio.currentTime });
    }
    refresh();
  }
  function stopPlayback(broadcast) {
    audio.pause();
    cur = null;
    try { audio.removeAttribute('src'); audio.load(); } catch (e) {}
    if (broadcast && isHost()) room.tr.send({ t: 'stop' });
    refresh();
  }
  audio.addEventListener('ended', function () { if (isHost()) stopPlayback(true); else if (!isGuest()) stopPlayback(false); });
  audio.addEventListener('error', function () { if (cur) toast('No se pudo cargar el audio (enlace roto o expirado)'); });
  audio.addEventListener('playing', function () {
    // El anfitrión vuelve a marcar la hora de inicio cuando el audio realmente empieza (después de cargar)
    if (cur && isHost()) { cur.startedAt = Date.now() - audio.currentTime * 1000; room.tr.send({ t: 'resume', startedAt: cur.startedAt }); }
  });
  audio.addEventListener('play', function () { refresh(); });
  audio.addEventListener('pause', function () { refresh(); });

  function screenState() {
    var st = { room: room && room.connected ? room.code : null, peers: room ? roomNames().length : 0 };
    if (!cur) return st;
    var pos = audio.currentTime || 0, dur = audio.duration && isFinite(audio.duration) ? audio.duration : 0;
    st.title = cur.song.titulo; st.cover = cur.cover; st.pos = pos; st.dur = dur;
    st.progress = dur ? pos / dur : 0; st.paused = audio.paused;
    if (cur.lrc.length) {
      var l = krkLineAt(cur.lrc, pos);
      st.lines = { prev: l.prev, cur: l.cur, next: l.next, next2: l.next2, progress: l.progress };
    }
    return st;
  }
  function drawScreen() {
    if (!cfg.screen) return;
    try { cfg.screen.draw(screenState()); } catch (e) {}
  }

  // ---------- Pantalla: reproductor ----------
  var plCover = el('div', { class: 'k-cover k-big' });
  var plTitle = el('h3', { style: 'margin:6px 0;font-size:20px;text-align:center' });
  var plSub = el('p', { class: 'k-muted', style: 'text-align:center;margin:0 0 8px' });
  var plBar = el('i');
  var plBarWrap = el('div', { class: 'k-bar' }, [plBar]);
  var plTime = el('p', { class: 'k-muted', style: 'text-align:center;margin:0' });
  var plLine = el('p', { style: 'text-align:center;font-size:20px;color:#ffcf4a;min-height:28px;margin:12px 0' });
  var plPlay = el('button', { class: 'k-btn', text: 'Pausar', onclick: function () { togglePlay(); } });
  var plStop = el('button', { class: 'k-btn k-danger', text: 'Detener', onclick: function () { if (isGuest()) toast('Lo controla el anfitrión'); else stopPlayback(true); } });
  var plPick = el('button', { class: 'k-ghost', text: 'Elegir otra', onclick: function () { go('list'); } });
  [plCover, plTitle, plSub, plBarWrap, plTime, plLine, el('div', { class: 'k-row', style: 'justify-content:center' }, [plPlay, plStop, plPick])]
    .forEach(function (n) { screens.player.appendChild(n); });

  function renderPlayer() {
    if (!cur) {
      plCover.style.backgroundImage = ''; plCover.textContent = '\u266A';
      plTitle.textContent = 'Nada en reproducción';
      plSub.textContent = 'Elige una canción de la lista.';
      plBar.style.width = '0%'; plTime.textContent = ''; plLine.textContent = '';
      plPlay.style.display = 'none'; plStop.style.display = 'none';
      return;
    }
    var s = cur.song;
    if (s.portada) { plCover.textContent = ''; plCover.style.backgroundImage = 'url("' + String(krkResolve(cfg.basePath, s.portada)).replace(/"/g, '%22') + '")'; }
    else { plCover.style.backgroundImage = ''; plCover.textContent = '\u266A'; }
    plTitle.textContent = s.titulo;
    plSub.textContent = (room ? (isHost() ? 'Eres el anfitrión · ' : 'Controla el anfitrión · ') : '') + (audio.paused ? 'En pausa' : 'Reproduciendo');
    var dur = audio.duration && isFinite(audio.duration) ? audio.duration : 0;
    plBar.style.width = dur ? Math.round((audio.currentTime / dur) * 100) + '%' : '0%';
    plTime.textContent = krkFmtTime(audio.currentTime) + ' / ' + (dur ? krkFmtTime(dur) : '--:--');
    plLine.textContent = cur.lrc.length ? krkLineAt(cur.lrc, audio.currentTime).cur : '';
    plPlay.textContent = audio.paused ? 'Reanudar' : 'Pausar';
    plPlay.style.display = isGuest() ? 'none' : '';
    plStop.style.display = isGuest() ? 'none' : '';
  }
  function renderMini() {
    mini.classList.toggle('k-on', !!cur);
    if (cur) { miniTitle.textContent = cur.song.titulo; miniBtn.textContent = audio.paused ? '\u25B6' : '\u275A\u275A'; }
  }
  function refresh() {
    renderMini();
    if (screens.player.classList.contains('k-on')) renderPlayer();
    drawScreen();
  }

  // ---------- Sala con código (P2P) ----------
  var roomStatus = el('p', { class: 'k-muted' });
  var nameField = el('input', { class: 'k-in', type: 'text', maxlength: '24', value: cfg.playerName, 'aria-label': 'Tu nombre' });
  nameField.addEventListener('input', function () { cfg.playerName = nameField.value.trim().slice(0, 24) || cfg.playerName; });
  var createBtn = el('button', { class: 'k-btn', text: 'Generar código', onclick: function () { createRoom(); } });
  var codeIn = el('input', { class: 'k-in', type: 'text', placeholder: 'Código de la sala', autocapitalize: 'characters', maxlength: '12', 'aria-label': 'Código de la sala' });
  var joinBtn = el('button', { class: 'k-btn', text: 'Conectar', onclick: function () { joinRoom(codeIn.value); } });
  var secCreate = el('div', { class: 'k-sec' }, [
    el('h3', { text: 'Crear una sala' }),
    el('p', { class: 'k-muted', text: 'Genera un código y pásalo a tus amigos. Todos usan el mismo.' }), createBtn
  ]);
  var secJoin = el('div', { class: 'k-sec' }, [
    el('h3', { text: 'Unirme a una sala' }), codeIn, el('div', { class: 'k-row' }, [joinBtn])
  ]);
  var codeBox = el('div', { class: 'k-code', text: '' });
  var peersEl = el('p', { class: 'k-muted' });
  var copyBtn = el('button', { class: 'k-btn', text: 'Copiar código', onclick: function () { copyCode(); } });
  var leaveBtn = el('button', { class: 'k-btn k-danger', text: 'Salir de la sala', onclick: function () { leaveRoom(); } });
  var secLive = el('div', { class: 'k-sec' }, [
    el('h3', { text: 'Sala activa' }), codeBox, peersEl,
    el('div', { class: 'k-row' }, [copyBtn, el('button', { class: 'k-ghost', text: 'Elegir canción', onclick: function () { go('list'); } }), leaveBtn])
  ]);
  var reportBtn2 = el('button', { class: 'k-ghost', text: 'Reportar contenido', onclick: function () { report(); } });
  [el('label', { text: 'Tu nombre' }), nameField, secCreate, secJoin, secLive, roomStatus, el('div', { class: 'k-row' }, [reportBtn2])]
    .forEach(function (n) { screens.room.appendChild(n); });

  function roomNames() {
    if (!room) return [];
    var list = [room.role === 'host' ? cfg.playerName : (room.hostName || 'Anfitrión')];
    if (room.role === 'host') Object.keys(room.peers).forEach(function (id) { list.push(room.peers[id]); });
    else list = room.names && room.names.length ? room.names : [cfg.playerName];
    return list;
  }
  function renderRoom() {
    var live = !!room && room.connected;
    secCreate.style.display = room ? 'none' : '';
    secJoin.style.display = room ? 'none' : '';
    secLive.style.display = room ? '' : 'none';
    if (room) {
      codeBox.textContent = 'KRK-' + room.code;
      peersEl.textContent = live ? ('Conectados (' + roomNames().length + '): ' + roomNames().join(', ')) : 'Conectando...';
    }
    nameField.disabled = !!room;
  }
  function setRoomStatus(msg, isErr) { roomStatus.textContent = msg || ''; roomStatus.className = isErr ? 'k-err' : 'k-muted'; }
  function copyCode() {
    if (!room) return;
    var text = 'KRK-' + room.code;
    try { navigator.clipboard.writeText(text).then(function () { toast('Código copiado'); }, function () { toast('Copia el código a mano'); }); }
    catch (e) { toast('Copia el código a mano'); }
  }

  // Transporte con PeerJS (anfitrión = centro de la sala, todos usan el mismo código)
  function openPeerRoom(role, code, h) {
    var peerId = 'karaoke-krk-' + code.toLowerCase();
    var peer, conns = {}, conn = null, tr;
    function errText(e) { return 'Error de conexión: ' + ((e && e.type) || e); }
    if (role === 'host') {
      peer = new Peer(peerId, cfg.peerOptions);
      peer.on('open', function () { h.open(); });
      peer.on('connection', function (c) {
        c.on('open', function () { conns[c.peer] = c; });
        c.on('data', function (m) { h.msg(m, c.peer); });
        c.on('close', function () { delete conns[c.peer]; h.leave(c.peer); });
      });
      peer.on('error', function (e) { h.err(e && e.type === 'unavailable-id' ? 'Ese código ya está en uso. Genera otro.' : errText(e)); });
      tr = {
        send: function (m) { Object.keys(conns).forEach(function (k) { try { conns[k].send(m); } catch (e) {} }); },
        sendTo: function (id, m) { if (conns[id]) { try { conns[id].send(m); } catch (e) {} } },
        close: function () { try { peer.destroy(); } catch (e) {} }
      };
    } else {
      peer = new Peer(cfg.peerOptions);
      peer.on('open', function () {
        conn = peer.connect(peerId, { reliable: true });
        conn.on('open', function () { h.open(); });
        conn.on('data', function (m) { h.msg(m, 'host'); });
        conn.on('close', function () { h.closed(); });
        conn.on('error', function () { h.err('Se perdió la conexión con la sala.'); });
      });
      peer.on('error', function (e) { h.err(e && e.type === 'peer-unavailable' ? 'No existe una sala con ese código.' : errText(e)); });
      tr = {
        send: function (m) { if (conn && conn.open) { try { conn.send(m); } catch (e) {} } },
        sendTo: function (id, m) { tr.send(m); },
        close: function () { try { peer.destroy(); } catch (e) {} }
      };
    }
    return tr;
  }
  // Transporte local de pruebas (BroadcastChannel: dos pestañas del mismo navegador)
  function openLocalRoom(role, code, h, myId) {
    if (typeof BroadcastChannel !== 'function') {
      setTimeout(function () { h.err('Este navegador no soporta salas locales ni tiene PeerJS cargado.'); }, 0);
      return { send: noop, sendTo: noop, close: noop };
    }
    var bc = new BroadcastChannel('karaoke-krk-' + code);
    bc.onmessage = function (e) {
      var m = e.data;
      if (!m || m.from === myId || (m.to && m.to !== myId)) return;
      h.msg(m, m.from);
    };
    var tr = {
      send: function (m) { m.from = myId; bc.postMessage(m); },
      sendTo: function (id, m) { m.to = id; tr.send(m); },
      close: function () { bc.close(); }
    };
    setTimeout(function () { h.open(); }, 0);
    return tr;
  }
  function makeRoom(role, code) {
    var myId = 'u' + Math.random().toString(36).slice(2, 10);
    var r = { code: code, role: role, myId: myId, peers: {}, names: [], hostName: '', connected: false, tr: null, welcomeTimer: null };
    var h = {
      open: function () {
        if (room !== r) return;
        if (role === 'host') { r.connected = true; setRoomStatus('Sala lista. Comparte el código.'); }
        else {
          r.tr.send({ t: 'hello', name: cfg.playerName });
          r.welcomeTimer = setTimeout(function () {
            if (room === r && !r.connected) { setRoomStatus('No existe una sala con ese código.', true); leaveRoom(true); }
          }, 4000);
        }
        renderRoom(); drawScreen();
      },
      msg: function (m, from) { if (room === r) onRoomMsg(m, from); },
      leave: function (id) {
        if (room !== r) return;
        var nm = r.peers[id]; delete r.peers[id];
        broadcastPeers(); renderRoom(); drawScreen();
        if (nm) toast(nm + ' salió');
      },
      closed: function () { if (room === r) { toast('El anfitrión cerró la sala'); setRoomStatus('La sala se cerró.', true); leaveRoom(true); } },
      err: function (text) { if (room === r) { setRoomStatus(text, true); leaveRoom(true); } }
    };
    var usePeer = typeof Peer === 'function';
    r.tr = usePeer ? openPeerRoom(role, code, h) : openLocalRoom(role, code, h, myId);
    r.mode = usePeer ? 'internet' : 'local';
    return r;
  }
  function createRoom() {
    if (room) return;
    room = makeRoom('host', krkMakeCode());
    setRoomStatus(room.mode === 'local' ? 'Modo local de pruebas (PeerJS no está cargado).' : 'Creando sala...');
    renderRoom();
  }
  function joinRoom(text) {
    if (room) return;
    var code = krkNormalizeCode(text);
    if (code.length !== 5) { setRoomStatus('El código tiene 5 letras o números (por ejemplo KRK-7QX2M).', true); return; }
    room = makeRoom('guest', code);
    setRoomStatus('Conectando...');
    renderRoom();
  }
  function leaveRoom(keepMsg) {
    if (!room) return;
    var r = room;
    room = null;
    if (r.welcomeTimer) clearTimeout(r.welcomeTimer);
    try { r.tr.close(); } catch (e) {}
    if (r.role === 'guest' && cur) stopPlayback(false);
    if (!keepMsg) setRoomStatus('');
    renderRoom(); refresh();
  }
  function broadcastPeers() {
    if (isHost()) room.tr.send({ t: 'peers', list: roomNames() });
  }
  function sendStateTo(id) {
    if (!isHost() || !cur) return;
    if (audio.paused) room.tr.sendTo(id, { t: 'play', song: pub(cur.song), startedAt: cur.startedAt, paused: true, pos: audio.currentTime });
    else room.tr.sendTo(id, { t: 'play', song: pub(cur.song), startedAt: cur.startedAt });
  }
  function startClockSync() {
    var best = null, n = 0;
    var t = setInterval(function () {
      if (!isGuest() || n >= 5) { clearInterval(t); return; }
      n++;
      room.tr.send({ t: 'ping', t0: Date.now() });
    }, 350);
    timers.push(t);
    room.pingBest = function (m) {
      var now = Date.now(), rtt = now - m.t0, off = m.th + rtt / 2 - now;
      if (!best || rtt < best.rtt) { best = { rtt: rtt, off: off }; clockOffset = off; }
    };
  }
  function onRoomMsg(m, from) {
    if (!m || !m.t || !room) return;
    if (room.role === 'host') {
      if (m.t === 'hello') {
        room.peers[from] = String(m.name || 'Invitado').slice(0, 24);
        room.tr.sendTo(from, { t: 'welcome', host: cfg.playerName, peers: roomNames() });
        broadcastPeers(); sendStateTo(from); renderRoom(); drawScreen();
        toast(room.peers[from] + ' se unió');
      } else if (m.t === 'ping') {
        room.tr.sendTo(from, { t: 'pong', t0: m.t0, th: Date.now() });
      } else if (m.t === 'req' && m.song && m.song.audio) {
        if (cfg.autoAcceptRequests) {
          toast((m.name || 'Alguien') + ' eligió "' + m.song.titulo + '"');
          playLocal(m.song);
          room.tr.send({ t: 'play', song: pub(m.song), startedAt: cur.startedAt });
        }
      }
      return;
    }
    switch (m.t) {
      case 'welcome':
        room.connected = true; room.hostName = m.host || 'Anfitrión'; room.names = m.peers || [];
        if (room.welcomeTimer) clearTimeout(room.welcomeTimer);
        setRoomStatus('Conectado a la sala.');
        startClockSync(); renderRoom(); drawScreen();
        break;
      case 'peers': room.names = m.list || []; renderRoom(); drawScreen(); break;
      case 'pong': if (room.pingBest) room.pingBest(m); break;
      case 'play': if (m.song && m.song.audio) { remoteStart(m.song, m.startedAt, !!m.paused, m.pos); if (!root.classList.contains('k-open')) toast('Suena: ' + m.song.titulo); } break;
      case 'pause': audio.pause(); try { audio.currentTime = m.pos || 0; } catch (e) {} refresh(); break;
      case 'resume':
        if (cur) {
          cur.startedAt = m.startedAt;
          try { audio.currentTime = Math.max(0, (Date.now() + clockOffset - m.startedAt) / 1000); } catch (e) {}
          var pr = audio.play(); if (pr && pr.catch) pr.catch(noop);
        }
        refresh(); break;
      case 'stop': stopPlayback(false); break;
    }
  }

  // ---------- Bucle: pantallas, progreso y corrección de desfase ----------
  var driftTick = 0;
  timers.push(setInterval(function () {
    if (destroyed) return;
    if (cur && !audio.paused) {
      drawScreen();
      if (screens.player.classList.contains('k-on')) renderPlayer();
      if (isGuest() && ++driftTick % 20 === 0 && cur.startedAt) {
        var expected = (Date.now() + clockOffset - cur.startedAt) / 1000;
        if (Math.abs((audio.currentTime || 0) - expected) > 0.4) { try { audio.currentTime = Math.max(0, expected); } catch (e) {} }
      }
    }
  }, 100));

  // ---------- Detectar toques sobre las tabletas del lugar 3D ----------
  function attachTo(THREE, camera, domElement, rootObj) {
    detach();
    var ray = new THREE.Raycaster(), v = new THREE.Vector2(), down = null;
    function meshes() { return (rootObj && rootObj.userData && rootObj.userData.tablets) || []; }
    function onDown(e) { down = { x: e.clientX, y: e.clientY, t: Date.now() }; }
    function onUp(e) {
      if (!down) return;
      var moved = Math.sqrt(Math.pow(e.clientX - down.x, 2) + Math.pow(e.clientY - down.y, 2)), dt = Date.now() - down.t;
      down = null;
      if (moved > 8 || dt > 600 || root.classList.contains('k-open')) return;
      var rc = domElement.getBoundingClientRect();
      v.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
      ray.setFromCamera(v, camera);
      var hits = ray.intersectObjects(meshes(), false);
      if (hits.length && hits[0].distance <= cfg.tapRange) open();
    }
    domElement.addEventListener('pointerdown', onDown);
    domElement.addEventListener('pointerup', onUp);
    attached = { el: domElement, down: onDown, up: onUp };
  }
  function detach() {
    if (!attached) return;
    attached.el.removeEventListener('pointerdown', attached.down);
    attached.el.removeEventListener('pointerup', attached.up);
    attached = null;
  }
  function destroy() {
    destroyed = true;
    detach(); leaveRoom();
    timers.forEach(function (t) { clearInterval(t); });
    try { audio.pause(); audio.removeAttribute('src'); } catch (e) {}
    document.removeEventListener('keydown', onKey);
    if (root.parentNode) root.parentNode.removeChild(root);
    if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
  }

  // ---------- Inicio ----------
  loadMine();
  go('home', true);
  loadCatalog();
  drawScreen();

  return {
    open: open,
    close: close,
    attachTo: attachTo,
    detach: detach,
    destroy: destroy,
    setScreen: function (s) { cfg.screen = s; drawScreen(); },
    reload: loadCatalog,
    state: function () { return { song: cur && cur.song, room: room && { code: room.code, role: room.role, connected: room.connected, mode: room.mode } }; }
  };
}

createKaraokeUI.utils = {
  parseLRC: krkParseLRC, lineAt: krkLineAt, fmtTime: krkFmtTime, expiryLabel: krkExpiryLabel,
  makeCode: krkMakeCode, normalizeCode: krkNormalizeCode, resolve: krkResolve, parseExpiry: krkParseExpiry
};
