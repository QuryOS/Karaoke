/**
 * Karaoke interior acogedor
 * 
 * Detalles: tabletas táctiles que abren el menú del juego, pantallas sincronizadas con la música (letra, portada y progreso), reloj de pared realista sincronizado con la hora del dispositivo, estante de álbumes de vinilo con portadas, almohadas redondeadas en los sofás, escenario con pantalla grande de letras, monitores de apoyo y micrófonos con pedestal y cables, bocinas y subwoofers con rejilla, cabina del presentador con laptop y mezcladora, catálogo de canciones en estantería, barra con frente de listones, taburetes con aro, repisas con botellas de formas distintas, vasos, copas y jarras, refrigerador con latas y puerta de vidrio, caja registradora, menú de pizarra, mesas redondas con sillas de madera completas, tabletas con catálogo, sofás acolchados con patas y cojines, cortinas de terciopelo, paneles acústicos, cuadros y discos de oro, reloj, plantas, puerta con herrajes y letrero de salida, techo con luces empotradas suaves, iluminación cálida y discreta, sin exterior — todo cerrado
 * 
 * Uso:
 *   const karaoke = createKaraoke(THREE);
 *   scene.add(karaoke.group);
 * 
 * Expone:
 *   karaoke.group → Grupo principal
 *   karaoke.group.userData.tablets → mallas de las tabletas (para detectar toques con Raycaster)
 *   karaoke.group.userData.screen.draw(estado) → redibuja todas las pantallas del lugar
 * 
 * Compatible con Three.js r128 o superior.
 */
function createKaraoke(THREE, opts) {
  opts = opts || {};
  
  var colors = {
    floor: opts.floor != null ? opts.floor : 0x3a1828,
    wall: opts.wall != null ? opts.wall : 0x7a3a4e,
    ceiling: opts.ceiling != null ? opts.ceiling : 0xf1ece2,
    accent: opts.accent != null ? opts.accent : 0xd4a24c,
    neon: 0xff4f9a,
    warm: 0xffd9a0
  };

  var group = new THREE.Group();

  // Salón de 18 x 14 m (x -9..9, z -7..7), altura 3.6 m.
  // El escenario está contra la pared -Z y la puerta de entrada en la pared +Z.
  var CH = 3.6;

  // === MATERIALES ===
  // Usa MeshStandardMaterial o MeshBasicMaterial
  // Texturas generadas con canvas, sin archivos externos

  var seed = 4242;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  function css(n, k) {
    var c = new THREE.Color(n);
    c.multiplyScalar(k == null ? 1 : k);
    return '#' + c.getHexString();
  }
  function makeTex(w, h, draw, rx, ry) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function clampTex(t) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; }
  function speckle(g, w, h, n, rgb, a) {
    for (var i = 0; i < n; i++) {
      g.fillStyle = 'rgba(' + rgb + ',' + a + ')';
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
    }
  }

  // Alfombra: patrón de rombos muy sutil (sin líneas brillantes)
  var tCarpet = makeTex(256, 256, function (g, w, h) {
    g.fillStyle = css(colors.floor); g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,200,170,0.07)'; g.lineWidth = 6;
    for (var i = -1; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64 + 128, 128); g.lineTo(i * 64, 256); g.stroke();
      g.beginPath(); g.moveTo(i * 64 + 128, 0); g.lineTo(i * 64, 128); g.lineTo(i * 64 + 128, 256); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (var a = 0; a < 4; a++) for (var b = 0; b < 4; b++) {
      g.beginPath(); g.arc(a * 64 + 32, b * 64 + 32, 5, 0, Math.PI * 2); g.fill();
    }
    speckle(g, w, h, 1200, '0,0,0', 0.2);
    speckle(g, w, h, 500, '255,220,200', 0.05);
  }, 9, 7);

  // Papel tapiz con listones y adornos
  var tWall = makeTex(256, 256, function (g, w, h) {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.09)';
    for (var x = 0; x < w; x += 64) g.fillRect(x, 0, 30, h);
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (var a = 0; a < 4; a++) for (var b = 0; b < 4; b++) {
      var cx = a * 64 + 15, cy = b * 64 + 32;
      g.beginPath(); g.moveTo(cx, cy - 12); g.lineTo(cx + 8, cy); g.lineTo(cx, cy + 12); g.lineTo(cx - 8, cy); g.closePath(); g.fill();
    }
    speckle(g, w, h, 400, '0,0,0', 0.06);
  }, 7, 1);

  var tCeil = makeTex(128, 128, function (g, w, h) {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 500, '0,0,0', 0.1);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 4; g.strokeRect(0, 0, w, h);
  }, 9, 7);

  var tWood = makeTex(256, 256, function (g, w, h) {
    for (var i = 0; i < 8; i++) {
      g.fillStyle = 'hsl(24,' + Math.floor(40 + rnd() * 10) + '%,' + Math.floor(26 + rnd() * 10) + '%)';
      g.fillRect(0, i * 32, w, 32);
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, i * 32, w, 2);
      g.fillStyle = 'rgba(255,200,140,0.07)'; g.fillRect(rnd() * w, i * 32 + 6, 60 + rnd() * 80, 2);
    }
    speckle(g, w, h, 300, '20,10,0', 0.2);
  });

  var tFabric = makeTex(64, 64, function (g, w, h) {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 1;
    for (var i = 0; i < w; i += 4) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke();
    }
  });

  // Rejilla metálica fina de micrófono
  var tGrille = makeTex(64, 64, function (g, w, h) {
    g.fillStyle = '#2a2c30'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a9afb8'; g.lineWidth = 2;
    for (var i = -h; i < w + h; i += 8) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
      g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke();
    }
  }, 3, 2);

  // Frente de bocina de columna (2 woofers + tweeter)
  var tSpkCol = clampTex(makeTex(128, 340, function (g, w, h) {
    g.fillStyle = '#121216'; g.fillRect(0, 0, w, h);
    function driver(cx, cy, r) {
      g.fillStyle = '#050507'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#4a4d55'; g.lineWidth = 3;
      for (var k = r; k > 6; k -= r / 4) { g.beginPath(); g.arc(cx, cy, k, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = '#2b2d33'; g.beginPath(); g.arc(cx, cy, r * 0.25, 0, Math.PI * 2); g.fill();
    }
    driver(64, 250, 44); driver(64, 140, 34); driver(64, 60, 15);
    g.fillStyle = '#d4a24c'; g.fillRect(48, 316, 32, 6);
  }));
  // Frente de subwoofer
  var tSpkSub = clampTex(makeTex(256, 224, function (g, w, h) {
    g.fillStyle = '#121216'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#050507'; g.beginPath(); g.arc(110, 112, 92, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4a4d55'; g.lineWidth = 4;
    for (var k = 92; k > 10; k -= 20) { g.beginPath(); g.arc(110, 112, k, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#2b2d33'; g.beginPath(); g.arc(110, 112, 22, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#000'; g.fillRect(214, 70, 28, 84);
  }));

  // Pantallas de letras: se redibujan con el estado del juego (reposo, canción, letra, progreso)
  var bokeh = [];
  for (var bk0 = 0; bk0 < 18; bk0++) bokeh.push([rnd() * 1024, rnd() * 576, 20 + rnd() * 60, 0.03 + rnd() * 0.06]);
  function fitText(g, text, maxW, px, weight) {
    var size = px;
    do { g.font = (weight || 'bold') + ' ' + size + 'px Arial, sans-serif'; size -= 2; }
    while (g.measureText(text).width > maxW && size > 18);
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(sec / 60), r = sec % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  // st: { title, cover (Image), pos, dur, progress, paused, room, peers, lines:{prev,cur,next,next2,progress}, hint }
  function drawLyrics(g, w, h, st) {
    st = st || {};
    var gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#14143a'); gr.addColorStop(1, '#3a1450');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    bokeh.forEach(function (b) {
      g.fillStyle = 'rgba(255,255,255,' + b[3] + ')';
      g.beginPath(); g.arc(b[0], b[1], b[2], 0, Math.PI * 2); g.fill();
    });
    // Video de la canción como fondo (se recorta para llenar la pantalla) con sombra abajo para leer la letra
    var vid = false;
    if (st.video) {
      try {
        var vw = st.video.videoWidth, vh = st.video.videoHeight;
        if (vw && vh) {
          var sc = Math.max(w / vw, h / vh), dw = vw * sc, dh = vh * sc;
          g.drawImage(st.video, (w - dw) / 2, (h - dh) / 2, dw, dh);
          var sh = g.createLinearGradient(0, 300, 0, h);
          sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.8)');
          g.fillStyle = sh; g.fillRect(0, 300, w, h - 300);
          vid = true;
        }
      } catch (e) { vid = false; }
    }
    g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 0, w, 70);
    g.fillStyle = '#ffd9a0';
    fitText(g, '\u266A  ' + (st.title || 'KARAOKE'), st.room ? w - 420 : w - 60, 34);
    g.fillText('\u266A  ' + (st.title || 'KARAOKE'), 28, 36);
    if (st.room) {
      g.textAlign = 'right'; g.font = '26px Arial, sans-serif';
      g.fillText('Sala ' + st.room + (st.peers > 1 ? '  \u00B7  ' + st.peers + ' conectados' : ''), w - 28, 36);
    }
    g.textAlign = 'center';
    if (!st.title) {
      g.fillStyle = '#ffffff'; g.font = 'bold 78px Arial, sans-serif'; g.fillText('KARAOKE', w / 2, 220);
      g.fillStyle = '#ffd9a0'; g.font = '34px Arial, sans-serif'; g.fillText('Toca una tableta para elegir tu canción', w / 2, 320);
      g.fillStyle = '#9a9ac0'; g.font = '26px Arial, sans-serif'; g.fillText(st.hint || 'Lista  \u00B7  Subir música  \u00B7  Sala', w / 2, 380);
      return;
    }
    var ly = st.lines, hasLy = ly && (ly.cur || ly.next || ly.prev);
    if (st.cover && !vid) {
      try {
        if (hasLy) g.drawImage(st.cover, 28, 392, 110, 110);
        else g.drawImage(st.cover, 70, 110, 330, 330);
      } catch (e) {}
    }
    if (vid) {
      g.textAlign = 'center';
      if (hasLy) {
        var vt = ly.cur || '\u266A';
        fitText(g, vt, w - 100, 58, 'bold');
        var vtw = g.measureText(vt).width, vlx = w / 2 - vtw / 2;
        g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = 'rgba(0,0,0,0.85)';
        g.strokeText(vt, w / 2, 436);
        g.fillStyle = '#ffffff'; g.fillText(vt, w / 2, 436);
        g.save(); g.beginPath(); g.rect(vlx - 4, 380, vtw * (ly.progress || 0) + 8, 110); g.clip();
        g.fillStyle = '#ffcf4a'; g.fillText(vt, w / 2, 436); g.restore();
        fitText(g, ly.next, w - 100, 34, 'bold');
        g.lineWidth = 7; g.strokeText(ly.next, w / 2, 488);
        g.fillStyle = '#e6e6f5'; g.fillText(ly.next, w / 2, 488);
        g.lineWidth = 1;
      }
    } else if (hasLy) {
      g.fillStyle = '#7a7aa0'; fitText(g, ly.prev, w - 100, 40, 'bold'); g.fillText(ly.prev, w / 2, 160);
      fitText(g, ly.cur || '\u266A', w - 100, 66, 'bold');
      var tw = g.measureText(ly.cur || '\u266A').width, lx = w / 2 - tw / 2;
      g.fillStyle = '#ffffff'; g.fillText(ly.cur || '\u266A', w / 2, 250);
      g.save(); g.beginPath(); g.rect(lx - 4, 190, tw * (ly.progress || 0) + 8, 120); g.clip();
      g.fillStyle = '#ffcf4a'; g.fillText(ly.cur || '\u266A', w / 2, 250); g.restore();
      g.fillStyle = '#d9d9ee'; fitText(g, ly.next, w - 100, 50, 'bold'); g.fillText(ly.next, w / 2, 340);
      g.fillStyle = '#8a8ab0'; fitText(g, ly.next2, w - 100, 40, 'bold'); g.fillText(ly.next2, w / 2, 410);
    } else {
      g.textAlign = 'left';
      var tx = st.cover ? 440 : 70;
      g.fillStyle = '#ffffff'; fitText(g, st.title, w - tx - 50, 54, 'bold'); g.fillText(st.title, tx, 200);
      g.fillStyle = '#ffd9a0'; g.font = '30px Arial, sans-serif';
      g.fillText(st.status || (st.paused ? 'En pausa' : 'Reproduciendo'), tx, 270);
      g.fillStyle = '#9a9ac0'; g.font = '26px Arial, sans-serif';
      g.fillText('Esta canción no tiene letra', tx, 330);
    }
    g.textAlign = 'left';
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(150, 530, w - 300, 10);
    g.fillStyle = '#ffcf4a'; g.fillRect(150, 530, (w - 300) * Math.min(1, Math.max(0, st.progress || 0)), 10);
    g.fillStyle = '#ffd9a0'; g.font = '24px Arial, sans-serif';
    g.fillText(fmtTime(st.pos), 60, 535);
    g.textAlign = 'right'; g.fillText(st.dur ? fmtTime(st.dur) : '--:--', w - 60, 535);
    if (st.paused && hasLy) { g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = 'bold 28px Arial, sans-serif'; g.fillText('EN PAUSA', w / 2, vid ? 130 : 480); }
  }
  var tLyrics = clampTex(makeTex(1024, 576, function (g, w, h) { drawLyrics(g, w, h, null); }));

  var tSongs = clampTex(makeTex(512, 512, function (g, w, h) {
    g.fillStyle = '#10131f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d4a24c'; g.fillRect(0, 0, w, 64);
    g.fillStyle = '#10131f'; g.font = 'bold 36px Arial, sans-serif'; g.textBaseline = 'middle';
    g.fillText('CATÁLOGO', 24, 34);
    var names = ['Noche de Estrellas', 'Bailando bajo la luna', 'Camino a casa', 'Verano eterno', 'Corazón de neón',
                 'La última canción', 'Sueños de ciudad', 'Brisa de mar', 'Tiempo de volver', 'Fuego lento', 'Mil caminos', 'Cielo abierto'];
    g.font = '26px Arial, sans-serif';
    for (var i = 0; i < names.length; i++) {
      g.fillStyle = i % 2 ? '#c9cfe6' : '#ffffff';
      g.fillText((101 + i) + '   ' + names[i], 24, 100 + i * 33);
    }
  }));

  var tTablet = clampTex(makeTex(256, 192, function (g, w, h) {
    var gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#1b1230'); gr.addColorStop(1, '#2d1240');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd9a0'; g.font = 'bold 22px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('KARAOKE', w / 2, 28);
    var icons = [['\u266B', 'Lista', '#d4a24c'], ['\u2191', 'Subir', '#2a8a8a'], ['#', 'Sala', '#c85a7a']];
    for (var i = 0; i < 3; i++) {
      var cx = 48 + i * 80;
      g.fillStyle = icons[i][2]; g.beginPath(); g.arc(cx, 98, 28, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#10131f'; g.font = 'bold 30px Arial, sans-serif'; g.fillText(icons[i][0], cx, 99);
      g.fillStyle = '#ffffff'; g.font = '16px Arial, sans-serif'; g.fillText(icons[i][1], cx, 148);
    }
  }));

  var tLaptop = clampTex(makeTex(512, 288, function (g, w, h) {
    g.fillStyle = '#10131f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d4a24c'; g.fillRect(0, 0, w, 40);
    g.fillStyle = '#10131f'; g.font = 'bold 24px Arial, sans-serif';
    g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillText('CATÁLOGO', 16, 21);
    var names = ['Noche de Estrellas', 'Bailando bajo la luna', 'Camino a casa', 'Verano eterno', 'Corazón de neón', 'La última canción'];
    g.font = '20px Arial, sans-serif';
    for (var i = 0; i < names.length; i++) {
      g.fillStyle = i % 2 ? '#c9cfe6' : '#ffffff';
      g.fillText((101 + i) + '   ' + names[i], 16, 66 + i * 32);
    }
    g.fillStyle = '#2f7a3a'; g.fillRect(0, h - 26, w, 26);
    g.fillStyle = '#ffffff'; g.font = '16px Arial, sans-serif';
    g.fillText('\u25CF En línea', 16, h - 13);
  }));

  var tMenu = clampTex(makeTex(512, 384, function (g, w, h) {
    g.fillStyle = '#20261f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e8e2cf'; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#f4efe0'; g.font = 'bold 44px Arial, sans-serif'; g.textAlign = 'center';
    g.fillText('MENÚ', w / 2, 64);
    g.textAlign = 'left'; g.font = '30px Arial, sans-serif';
    var items = [['Cerveza', '3.5'], ['Cóctel de la casa', '6'], ['Refresco', '2'], ['Nachos', '5'], ['Alitas', '7'], ['Papas fritas', '4']];
    for (var i = 0; i < items.length; i++) {
      g.fillText(items[i][0], 44, 120 + i * 42);
      g.textAlign = 'right'; g.fillText(items[i][1], w - 44, 120 + i * 42); g.textAlign = 'left';
    }
  }));

  var tNeon = clampTex(makeTex(512, 160, function (g, w, h) {
    g.shadowColor = css(colors.neon); g.shadowBlur = 18;
    g.strokeStyle = css(colors.neon); g.lineWidth = 8; g.lineJoin = 'round';
    g.font = 'bold 96px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeText('KARAOKE', w / 2, h / 2 + 4);
    g.fillStyle = '#ffd0e4'; g.shadowBlur = 0;
    g.globalAlpha = 0.35; g.fillText('KARAOKE', w / 2, h / 2 + 4);
  }));

  var tFridgeSign = clampTex(makeTex(256, 64, function (g, w, h) {
    g.fillStyle = '#1a2a44'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d4a24c'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#ffffff'; g.font = 'bold 34px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BEBIDAS', w / 2, h / 2 + 2);
  }));

  function posterTex(bgA, bgB, title, sub, icon) {
    return clampTex(makeTex(256, 352, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, bgA); gr.addColorStop(1, bgB);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      if (icon === 0) {
        g.beginPath(); g.arc(w / 2, 130, 44, 0, Math.PI * 2); g.fill();
        g.fillRect(w / 2 - 6, 170, 12, 70); g.fillRect(w / 2 - 36, 236, 72, 10);
      } else if (icon === 1) {
        g.beginPath(); g.arc(w / 2 - 30, 190, 24, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(w / 2 + 40, 170, 24, 0, Math.PI * 2); g.fill();
        g.fillRect(w / 2 - 10, 80, 8, 110); g.fillRect(w / 2 + 60, 60, 8, 110); g.fillRect(w / 2 - 10, 74, 78, 14);
      } else {
        g.beginPath(); g.arc(w / 2, 150, 60, 0, Math.PI * 2); g.fill();
        g.fillStyle = bgB; g.beginPath(); g.arc(w / 2, 150, 20, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.font = 'bold 34px Arial, sans-serif';
      g.fillText(title, w / 2, 290);
      g.font = '22px Arial, sans-serif'; g.fillText(sub, w / 2, 324);
    }));
  }
  var tPoster = [
    posterTex('#d94f70', '#5b1a45', 'KARAOKE', 'Viernes 9 PM', 0),
    posterTex('#2f7bd9', '#1a1f5b', 'TOP HITS', 'Elige tu canción', 1),
    posterTex('#e0a43a', '#6b2a1a', 'ROCK & POP', 'Noche de duetos', 2)
  ];

  var tExit = clampTex(makeTex(256, 96, function (g, w, h) {
    g.fillStyle = '#0a7a35'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#ffffff'; g.font = 'bold 56px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SALIDA', w / 2, h / 2 + 3);
  }));

  // Cara del reloj: números con serifa, marcas de minutos y rótulo
  var tClockFace = clampTex(makeTex(512, 512, function (g, w, h) {
    var c = w / 2, i, a;
    g.fillStyle = '#c9c2b2'; g.fillRect(0, 0, w, h);
    var gr = g.createRadialGradient(c, c - 30, 40, c, c, c);
    gr.addColorStop(0, '#fffdf6'); gr.addColorStop(0.85, '#f1ead8'); gr.addColorStop(1, '#d9d0b8');
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, c - 2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 6;
    g.beginPath(); g.arc(c, c, c - 6, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#2a2420';
    for (i = 0; i < 60; i++) {
      a = i * Math.PI / 30;
      g.lineWidth = i % 5 === 0 ? 7 : 2.5;
      var r1 = i % 5 === 0 ? c - 56 : c - 40;
      g.beginPath();
      g.moveTo(c + Math.sin(a) * r1, c - Math.cos(a) * r1);
      g.lineTo(c + Math.sin(a) * (c - 24), c - Math.cos(a) * (c - 24));
      g.stroke();
    }
    g.fillStyle = '#1e1a16'; g.font = 'bold 58px Georgia, "Times New Roman", serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (i = 1; i <= 12; i++) {
      a = i * Math.PI / 6;
      g.fillText(String(i), c + Math.sin(a) * (c - 98), c - Math.cos(a) * (c - 98) + 3);
    }
    g.font = 'bold 26px Georgia, serif'; g.fillStyle = '#6a1f33';
    g.fillText('KARAOKE', c, c - 100);
    g.font = '18px Arial, sans-serif'; g.fillStyle = '#6b645a';
    g.fillText('QUARTZ', c, c + 110);
  }));
  var tGlare = clampTex(makeTex(256, 256, function (g, w, h) {
    var gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, 'rgba(255,255,255,0.38)');
    gr.addColorStop(0.42, 'rgba(255,255,255,0.08)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0)');
    gr.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }));

  var tBall = makeTex(128, 64, function (g, w, h) {
    for (var x = 0; x < w; x += 8) for (var y = 0; y < h; y += 8) {
      var v = 150 + Math.floor(rnd() * 100);
      g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(x, y, 7, 7);
    }
  });

  function std(o) { return new THREE.MeshStandardMaterial(o); }
  function basic(o) { return new THREE.MeshBasicMaterial(o); }

  var mCarpet = std({ map: tCarpet, roughness: 1 });
  var mWall = std({ map: tWall, color: colors.wall, roughness: 0.85 });
  var mCeil = std({ map: tCeil, color: colors.ceiling, roughness: 0.95 });
  var mWood = std({ map: tWood, roughness: 0.55 });
  var mWoodPlain = std({ color: 0x4d3022, roughness: 0.6 });
  var mWoodLight = std({ color: 0x6b4630, roughness: 0.6 });
  var mTrim = std({ color: 0xf0e8d8, roughness: 0.6 });
  var mGold = std({ color: colors.accent, roughness: 0.35, metalness: 0.7 });
  var mBrass = std({ color: 0xb08a3c, roughness: 0.3, metalness: 0.8 });
  var mMetal = std({ color: 0x3a3d45, roughness: 0.4, metalness: 0.8 });
  var mSteel = std({ color: 0xb8bcc4, roughness: 0.3, metalness: 0.8 });
  var mBlack = std({ color: 0x0f1014, roughness: 0.5, metalness: 0.2 });
  var mSpk = std({ color: 0x17171b, roughness: 0.75 });
  var mSpkCol = std({ map: tSpkCol, roughness: 0.7 });
  var mSpkSub = std({ map: tSpkSub, roughness: 0.7 });
  var mAcoustic = std({ map: tFabric, color: 0x3b5a6a, roughness: 1 });
  var mCurtain = std({ color: 0xffffff, roughness: 1 });
  var mStage = std({ map: tWood, color: 0xd8c0a8, roughness: 0.5 });
  var mStageRug = std({ color: 0x7a1424, roughness: 1 });
  var mLyrics = basic({ map: tLyrics });
  var mSongs = basic({ map: tSongs });
  var mTabletScr = basic({ map: tTablet });
  var mLaptopScr = basic({ map: tLaptop });
  var mHit = new THREE.MeshBasicMaterial({ visible: false });
  var mMenu = basic({ map: tMenu });
  var mNeon = basic({ map: tNeon, transparent: true, depthWrite: false });
  var mExit = basic({ map: tExit });
  var mClockFace = std({ map: tClockFace, roughness: 0.7 });
  var mClockGlass = basic({ map: tGlare, transparent: true, depthWrite: false });
  var mHand = std({ color: 0x15151a, roughness: 0.45, metalness: 0.35 });
  var mHandSec = std({ color: 0xc4262b, roughness: 0.4, metalness: 0.3 });
  var mFridgeSign = basic({ map: tFridgeSign });
  var mWarm = basic({ color: colors.warm });
  var mFlame = basic({ color: 0xffb347 });
  var mLedG = basic({ color: 0x31ff7a });
  var mLedR = basic({ color: 0xff3b3b });
  var mFridgeIn = basic({ color: 0xe3ecf0 });
  var mGlass = std({ color: 0xcfe8f0, transparent: true, opacity: 0.4, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  var mBottleGlass = std({ color: 0xffffff, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
  var mLabel = std({ color: 0xffffff, roughness: 0.8 });
  var mCap = std({ color: 0xffffff, roughness: 0.4, metalness: 0.6 });
  var mBeer = std({ color: 0xd9901a, roughness: 0.3 });
  var mFoam = std({ color: 0xfaf6ea, roughness: 0.9 });
  var mCan = std({ color: 0xffffff, roughness: 0.3, metalness: 0.8 });
  var mMirror = std({ color: 0xb9c4d0, roughness: 0.05, metalness: 0.9 });
  var mGranite = std({ color: 0x24242a, roughness: 0.2, metalness: 0.5 });
  var mBarBody = std({ color: 0x3a2418, roughness: 0.55 });
  var mLeather = [std({ color: 0x6a1f33, roughness: 0.55 }), std({ color: 0x24405e, roughness: 0.55 }), std({ color: 0x3f2a58, roughness: 0.55 })];
  var mCushion = std({ color: 0x2b2330, roughness: 0.9 });
  var mPillow = std({ color: 0xffffff, roughness: 0.95 });
  var mChairSeat = std({ color: colors.accent, roughness: 0.8 });
  var mTable = std({ color: 0x20160f, roughness: 0.3, metalness: 0.3 });
  var mDoor = std({ map: tWood, color: 0xb89a80, roughness: 0.5 });
  var mPot = std({ color: 0x8a4a2a, roughness: 0.8 });
  var mSoil = std({ color: 0x2a1c12, roughness: 1 });
  var mLeaf = std({ color: 0x2f7a3a, roughness: 0.8 });
  var mBall = std({ map: tBall, roughness: 0.15, metalness: 0.9 });
  var mMicHead = std({ map: tGrille, roughness: 0.35, metalness: 0.7 });
  var mExt = std({ color: 0xc1272d, roughness: 0.4, metalness: 0.4 });
  var mBook = std({ color: 0xffffff, roughness: 0.8 });
  var mPaper = std({ color: 0xf2efe8, roughness: 0.9 });
  var mFrame = std({ color: 0x2a1c14, roughness: 0.5 });
  var mCoin = std({ color: 0xe0b040, roughness: 0.3, metalness: 0.8 });

  // === GEOMETRÍAS Y MODELO ===
  // Solo geometrías básicas, sin modelos externos
  // Usa InstancedMesh para objetos repetidos

  var UB = new THREE.BoxGeometry(1, 1, 1);
  var UC = new THREE.CylinderGeometry(1, 1, 1, 18);
  var US = new THREE.SphereGeometry(1, 14, 10);
  var UCone = new THREE.ConeGeometry(1, 1, 8);
  var UPlane = new THREE.PlaneGeometry(1, 1);
  UPlane.rotateX(-Math.PI / 2);
  var UP = new THREE.Vector3(0, 1, 0);
  var dummy = new THREE.Object3D();
  var qFront = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  var qSide = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);

  // Piezas torneadas (LatheGeometry) en tamaño real, en metros: [radio, altura]
  function lathe(pts, seg) {
    return new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 14);
  }
  var GSpirit = lathe([[0, 0], [0.038, 0], [0.04, 0.01], [0.04, 0.19], [0.036, 0.215], [0.018, 0.24], [0.016, 0.29], [0.0185, 0.295], [0.0185, 0.3], [0, 0.3]]);
  var GWine = lathe([[0, 0], [0.036, 0], [0.037, 0.01], [0.037, 0.17], [0.032, 0.2], [0.016, 0.235], [0.014, 0.31], [0.0165, 0.315], [0.0165, 0.32], [0, 0.32]]);
  var GRound = lathe([[0, 0], [0.04, 0], [0.054, 0.02], [0.056, 0.09], [0.046, 0.14], [0.022, 0.17], [0.017, 0.2], [0.02, 0.205], [0, 0.205]]);
  var GTumbler = lathe([[0, 0], [0.026, 0], [0.032, 0.1], [0.029, 0.1], [0.0235, 0.008], [0, 0.008]], 14);
  var GWineGlass = lathe([[0, 0], [0.032, 0], [0.032, 0.004], [0.004, 0.01], [0.004, 0.08], [0.026, 0.105], [0.031, 0.14], [0.028, 0.178],
    [0.02, 0.2], [0.018, 0.2], [0.026, 0.176], [0.029, 0.14], [0.024, 0.108], [0, 0.1]], 14);
  var GMug = lathe([[0, 0], [0.04, 0], [0.043, 0.01], [0.047, 0.13], [0.044, 0.135], [0.041, 0.014], [0, 0.012]], 14);
  var GMugHandle = new THREE.TorusGeometry(0.035, 0.007, 6, 12, Math.PI);
  GMugHandle.rotateZ(-Math.PI / 2);
  GMugHandle.translate(0.045, 0.07, 0);
  var GMicBody = new THREE.CylinderGeometry(0.019, 0.013, 0.15, 12);

  function box(w, h, d, m, x, y, z, p) {
    var o = new THREE.Mesh(UB, m);
    o.scale.set(w, h, d);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    (p || group).add(o);
    return o;
  }
  function cyl(r, h, m, x, y, z, p) {
    var o = new THREE.Mesh(UC, m);
    o.scale.set(r, h, r);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    (p || group).add(o);
    return o;
  }
  function plane(w, h, m, x, y, z, ry) {
    var o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    o.position.set(x, y, z);
    o.rotation.y = ry || 0;
    group.add(o);
    return o;
  }
  function pivot(x, y, z, rot) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot || 0;
    group.add(g);
    return g;
  }
  // list: [x, y, z, sx, sy, sz, ry, quaternion?]
  function inst(geo, mat, list, colorsArr) {
    if (!list.length) return null;
    var im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(function (a, i) {
      dummy.position.set(a[0], a[1], a[2]);
      dummy.scale.set(a[3], a[4], a[5]);
      if (a[7]) dummy.quaternion.copy(a[7]);
      else dummy.rotation.set(0, a[6] || 0, 0);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      if (colorsArr && im.setColorAt) im.setColorAt(i, colorsArr[i % colorsArr.length]);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = true;
    im.receiveShadow = true;
    group.add(im);
    return im;
  }
  function rotOff(x, z, r, ox, oz) {
    return [x + ox * Math.cos(r) + oz * Math.sin(r), z - ox * Math.sin(r) + oz * Math.cos(r)];
  }
  function pc(n) { return new THREE.Color(n); }
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }

  // Reloj de pared realista: aro de madera, cara con numerales, manecillas de
  // forma, segundero con contrapeso y vidrio con reflejo. Marca la hora local
  // del dispositivo: se actualiza solo en cada cuadro que se dibuja.
  function buildClock(x, y, z) {
    var cg = new THREE.Group();
    cg.position.set(x, y, z);
    cg.rotation.y = Math.PI;
    group.add(cg);
    function add(geo, mat, px, py, pz, cast) {
      var m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      m.castShadow = !!cast; m.receiveShadow = true;
      cg.add(m);
      return m;
    }
    var back = add(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 40), mFrame, 0, 0, -0.03, true);
    back.rotation.x = Math.PI / 2;
    add(new THREE.TorusGeometry(0.285, 0.024, 12, 48), mFrame, 0, 0, 0, true);
    add(new THREE.TorusGeometry(0.258, 0.008, 8, 48), mBrass, 0, 0, 0.004);
    var face = add(new THREE.CircleGeometry(0.26, 48), mClockFace, 0, 0, -0.002);
    add(new THREE.CircleGeometry(0.26, 48), mClockGlass, 0, 0, 0.024);
    function handGeo(pts, depth) {
      var sh = new THREE.Shape();
      sh.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
      sh.closePath();
      return new THREE.ExtrudeGeometry(sh, { depth: depth, bevelEnabled: false });
    }
    var hourG = new THREE.Group(), minG = new THREE.Group(), secG = new THREE.Group();
    hourG.position.z = 0.006; minG.position.z = 0.012; secG.position.z = 0.018;
    cg.add(hourG); cg.add(minG); cg.add(secG);
    // Horario: forma de lanza; minutero: largo y cónico; segundero: fino con contrapeso
    hourG.add(new THREE.Mesh(handGeo([[-0.007, -0.035], [0.007, -0.035], [0.008, 0.02], [0.022, 0.06], [0, 0.135], [-0.022, 0.06], [-0.008, 0.02]], 0.004), mHand));
    minG.add(new THREE.Mesh(handGeo([[-0.005, -0.045], [0.005, -0.045], [0.006, 0.0], [0.0025, 0.205], [0, 0.215], [-0.0025, 0.205], [-0.006, 0.0]], 0.004), mHand));
    secG.add(new THREE.Mesh(handGeo([[-0.0015, -0.05], [0.0015, -0.05], [0.0015, 0.215], [-0.0015, 0.215]], 0.003), mHandSec));
    var tail = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.003, 16), mHandSec);
    tail.rotation.x = Math.PI / 2; tail.position.set(0, -0.04, 0.0015); secG.add(tail);
    var capA = add(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 16), mBrass, 0, 0, 0.022);
    capA.rotation.x = Math.PI / 2;
    var capB = add(new THREE.CylinderGeometry(0.005, 0.005, 0.016, 12), mHandSec, 0, 0, 0.026);
    capB.rotation.x = Math.PI / 2;
    function tick() {
      var d = new Date(), sec = d.getSeconds();
      var mn = d.getMinutes() + sec / 60, hr = (d.getHours() % 12) + mn / 60;
      hourG.rotation.z = -hr * Math.PI / 6;
      minG.rotation.z = -mn * Math.PI / 30;
      secG.rotation.z = -sec * Math.PI / 30;
    }
    tick();
    face.onBeforeRender = function () { tick(); cg.updateMatrixWorld(true); };
    group.userData.updateClock = function () { tick(); cg.updateMatrixWorld(true); };
    return cg;
  }

  // ---------- Iluminación cálida y discreta ----------
  group.add(new THREE.HemisphereLight(0xfff1dc, 0x2a1f24, 0.55));
  [[-4.5, 3, 0], [4.5, 3, 0], [0, 3, 4], [-4.5, 3, -4]].forEach(function (p) {
    var pl = new THREE.PointLight(colors.warm, 0.3, 11);
    pl.position.set(p[0], p[1], p[2]);
    group.add(pl);
  });
  var stageSpot = new THREE.SpotLight(0xfff2dd, 0.8, 12, 0.7, 0.7, 1);
  stageSpot.position.set(0, 3.4, -2);
  stageSpot.target.position.set(0, 0.4, -5.6);
  group.add(stageSpot); group.add(stageSpot.target);
  var neonLight = new THREE.PointLight(colors.neon, 0.3, 4);
  neonLight.position.set(-8, 3.0, 4.3);
  group.add(neonLight);

  // ---------- Estructura: piso, paredes, techo y molduras ----------
  box(18, 0.2, 14, mCarpet, 0, -0.1, 0);
  box(18, 0.2, 14, mCeil, 0, CH + 0.1, 0);
  box(18.6, CH, 0.3, mWall, 0, CH / 2, -7.15);
  box(18.6, CH, 0.3, mWall, 0, CH / 2, 7.15);
  box(0.3, CH, 14, mWall, -9.15, CH / 2, 0);
  box(0.3, CH, 14, mWall, 9.15, CH / 2, 0);
  // Zócalo, guardasilla (madera) con listones y moldura de corona
  box(17.9, 1.0, 0.05, mWoodPlain, 0, 0.5, -6.975);
  box(17.9, 1.0, 0.05, mWoodPlain, 0, 0.5, 6.975);
  box(0.05, 1.0, 13.9, mWoodPlain, -8.975, 0.5, 0);
  box(0.05, 1.0, 13.9, mWoodPlain, 8.975, 0.5, 0);
  var stiles = [], sx2, sz2;
  for (sz2 = -6; sz2 <= 6; sz2 += 1.5) stiles.push([8.945, 0.5, sz2, 0.02, 0.84, 0.12, 0]);
  for (sx2 = -8; sx2 <= 8; sx2 += 1.5) stiles.push([sx2, 0.5, 6.945, 0.12, 0.84, 0.02, 0]);
  inst(UB, mWoodLight, stiles);
  box(17.9, 0.12, 0.1, mTrim, 0, 0.06, -6.95);
  box(17.9, 0.12, 0.1, mTrim, 0, 0.06, 6.95);
  box(0.1, 0.12, 13.9, mTrim, -8.95, 0.06, 0);
  box(0.1, 0.12, 13.9, mTrim, 8.95, 0.06, 0);
  box(17.9, 0.06, 0.08, mGold, 0, 1.03, -6.94);
  box(17.9, 0.06, 0.08, mGold, 0, 1.03, 6.94);
  box(0.08, 0.06, 13.9, mGold, -8.94, 1.03, 0);
  box(0.08, 0.06, 13.9, mGold, 8.94, 1.03, 0);
  box(17.9, 0.14, 0.14, mTrim, 0, CH - 0.07, -6.93);
  box(17.9, 0.14, 0.14, mTrim, 0, CH - 0.07, 6.93);
  box(0.14, 0.14, 13.9, mTrim, -8.93, CH - 0.07, 0);
  box(0.14, 0.14, 13.9, mTrim, 8.93, CH - 0.07, 0);
  // Tomacorrientes y apagadores
  var outlets = [];
  [[-6, 6.94], [-1, 6.94], [6, 6.94]].forEach(function (p) { outlets.push([p[0], 0.35, p[1], 0.08, 0.12, 0.02, 0]); });
  [-5, 0, 5].forEach(function (z) { outlets.push([8.94, 0.35, z, 0.02, 0.12, 0.08, 0]); });
  outlets.push([2.55, 1.3, 6.94, 0.08, 0.12, 0.02, 0]);
  outlets.push([2.55, 1.15, 6.94, 0.08, 0.12, 0.02, 0]);
  inst(UB, mTrim, outlets);
  box(0.1, 0.1, 0.03, mTrim, 4.6, 1.5, 6.93);

  // ---------- Techo: luces empotradas, bocinas, ventilas y detectores ----------
  var dl = [], dlRim = [], cs = [], csCone = [], vents = [], gx, gz;
  for (gx = -6; gx <= 6; gx += 3) for (gz = -4.5; gz <= 4.5; gz += 3) {
    dl.push([gx, CH - 0.01, gz, 0.11, 0.02, 0.11, 0]);
    dlRim.push([gx, CH - 0.02, gz, 0.15, 0.02, 0.15, 0]);
  }
  inst(UC, mWarm, dl);
  inst(UC, mTrim, dlRim);
  [-3, 0, 3].forEach(function (z) {
    [-4.5, 4.5].forEach(function (x) {
      cs.push([x, CH - 0.03, z, 0.17, 0.05, 0.17, 0]);
      csCone.push([x, CH - 0.06, z, 0.1, 0.03, 0.1, 0]);
    });
  });
  inst(UC, mSteel, cs);
  inst(UC, mBlack, csCone);
  [[-7, -3], [7, -3], [-7, 3], [7, 3]].forEach(function (p) {
    vents.push([p[0], CH - 0.02, p[1], 0.6, 0.03, 0.3, 0]);
    for (var s = -2; s <= 2; s++) vents.push([p[0] + s * 0.1, CH - 0.04, p[1], 0.02, 0.02, 0.26, 0]);
  });
  inst(UB, mSteel, vents);
  cyl(0.06, 0.03, mTrim, 2, CH - 0.02, 5.5);
  cyl(0.06, 0.03, mTrim, -2, CH - 0.02, -1.5);
  cyl(0.05, 0.02, mLedR, 2, CH - 0.04, 5.5);
  // Bola de espejos pequeña sobre el escenario
  cyl(0.01, 0.55, mMetal, 0, CH - 0.28, -5.6);
  var ball = new THREE.Mesh(US, mBall);
  ball.scale.set(0.3, 0.3, 0.3); ball.position.set(0, 2.78, -5.6);
  ball.castShadow = true; group.add(ball);

  // ---------- Escenario ----------
  box(8, 0.35, 2.4, mStage, 0, 0.175, -5.8);
  box(8.04, 0.06, 0.05, mGold, 0, 0.3, -4.58);
  box(6, 0.012, 1.6, mStageRug, 0, 0.356, -5.8);
  box(0.9, 0.18, 1.2, mStage, 4.45, 0.09, -5.2);
  box(0.9, 0.04, 0.05, mGold, 4.45, 0.18, -4.6);
  // Pantalla grande con letras (marco, soporte, LED de espera y placa)
  box(4.3, 2.45, 0.1, mBlack, 0, 2.15, -6.93);
  plane(4.1, 2.3, mLyrics, 0, 2.15, -6.875, 0);
  box(0.04, 0.04, 0.02, mLedG, 1.9, 0.99, -6.87);
  box(0.4, 0.04, 0.02, mMetal, 0, 0.99, -6.87);
  box(0.5, 0.3, 0.06, mMetal, 0, 3.45, -6.95);
  // Pantallas laterales
  [-6.9, 6.9].forEach(function (x) {
    box(1.8, 1.05, 0.08, mBlack, x, 2.1, -6.94);
    plane(1.7, 0.95, mLyrics, x, 2.1, -6.895, 0);
    box(0.03, 0.03, 0.02, mLedR, x + 0.8, 1.6, -6.89);
    box(0.5, 0.06, 0.1, mMetal, x, 2.7, -6.96);
  });
  // Cortinas de terciopelo (pliegues instanciados), cenefa y recogedores
  var folds = [], foldCol = [];
  [-1, 1].forEach(function (s) {
    for (var k = 0; k < 8; k++) {
      folds.push([s * (2.55 + k * 0.2), 1.9, -6.78 + (k % 2) * 0.12, 0.2, 3.15, 0.16, 0]);
      foldCol.push(pc(k % 2 ? 0x8a1a30 : 0x5e0f20));
    }
    cyl(0.05, 0.12, mGold, s * 3.35, 1.1, -6.62).rotation.z = Math.PI / 2;
  });
  inst(UB, mCurtain, folds, foldCol);
  box(8.6, 0.3, 0.3, std({ color: 0x5e0f20, roughness: 1 }), 0, 3.45, -6.7);
  box(8.6, 0.05, 0.32, mGold, 0, 3.28, -6.7);
  // Bocinas laterales con rejilla, subwoofers con asa y monitores de piso
  [-1, 1].forEach(function (s) {
    box(0.5, 1.7, 0.45, mSpk, s * 5.2, 0.85, -6.3);
    plane(0.46, 1.66, mSpkCol, s * 5.2, 0.85, -6.074, 0);
    box(0.52, 0.04, 0.47, mMetal, s * 5.2, 1.72, -6.3);
    box(0.5, 0.06, 0.45, mMetal, s * 5.2, 0.03, -6.3);
    box(0.8, 0.7, 0.7, mSpk, s * 3.5, 0.7, -6.4);
    plane(0.76, 0.66, mSpkSub, s * 3.5, 0.7, -6.045, 0);
    box(0.22, 0.03, 0.05, mMetal, s * 3.5, 1.06, -6.5);
    box(0.06, 0.06, 0.02, mGold, s * 3.5 + 0.3, 0.45, -6.04);
  });
  [-2.4, 2.4].forEach(function (x) {
    var wg = new THREE.Group();
    wg.position.set(x, 0.57, -4.95);
    wg.rotation.y = Math.PI;               // la cara mira hacia los cantantes (-Z)
    group.add(wg);
    var tilt = new THREE.Group();
    tilt.rotation.x = -0.45;               // la cara se inclina hacia arriba
    wg.add(tilt);
    box(0.7, 0.28, 0.4, mSpk, 0, 0, 0, tilt);
    var wgr = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), mSpkSub);
    wgr.position.set(0, 0, 0.2015);
    tilt.add(wgr);
  });

  // ---------- Micrófonos con pedestal, cable y micrófonos inalámbricos ----------
  var mLegs = [], mCollar = [], mPoleLo = [], mPoleUp = [], mKnob = [], mClip = [];
  var mBodies = [], mHeads = [], mBands = [], mCables = [];
  function addMic(x, y, z, tilt) {
    var d = new THREE.Vector3(0, Math.cos(tilt), Math.sin(tilt));
    var q = new THREE.Quaternion().setFromUnitVectors(UP, d);
    var o = new THREE.Vector3(x, y, z), v;
    mClip.push([x, y + 0.012, z, 0.02, 0.03, 0.02, 0]);
    v = o.clone().add(d.clone().multiplyScalar(0.09)); mBodies.push([v.x, v.y, v.z, 1, 1, 1, 0, q]);
    v = o.clone().add(d.clone().multiplyScalar(0.05)); mBands.push([v.x, v.y, v.z, 0.0215, 0.01, 0.0215, 0, q]);
    v = o.clone().add(d.clone().multiplyScalar(0.19)); mHeads.push([v.x, v.y, v.z, 0.034, 0.034, 0.034, 0]);
  }
  [-1.6, 0, 1.6].forEach(function (x) {
    var z = -5.4, a;
    for (var l = 0; l < 3; l++) {
      a = l * 2.094;
      mLegs.push([x + Math.sin(a) * 0.12, 0.372, z + Math.cos(a) * 0.12, 0.03, 0.02, 0.24, a]);
    }
    mCollar.push([x, 0.39, z, 0.035, 0.06, 0.035, 0]);
    mPoleLo.push([x, 0.69, z, 0.014, 0.6, 0.014, 0]);
    mKnob.push([x, 0.99, z, 0.022, 0.035, 0.022, 0]);
    mPoleUp.push([x, 1.32, z, 0.009, 0.66, 0.009, 0]);
    addMic(x, 1.67, z, 0.3);
    mCables.push([x + 0.025, 1.0, z + 0.01, 0.004, 1.3, 0.004, 0]);
    mCables.push([x + 0.025, 0.364, z - 0.65, 0.004, 1.3, 0.004, 0, qFront]);
  });
  // Micrófonos de mano en soporte sobre la cabina
  addMic(6.94, 0.83, -5.5, 0.15);
  addMic(7.06, 0.83, -5.5, -0.15);
  // Micrófonos inalámbricos sobre la mesita del escenario
  box(0.5, 0.04, 0.5, mTable, 3.0, 0.78, -5.4);
  box(0.04, 0.44, 0.04, mMetal, 3.0, 0.57, -5.4);
  cyl(0.2, 0.02, mMetal, 3.0, 0.36, -5.4);
  mBodies.push([3.0, 0.825, -5.45, 1, 1, 1, 0, qSide]);
  mHeads.push([2.9, 0.825, -5.45, 0.034, 0.034, 0.034, 0]);
  mBands.push([3.045, 0.825, -5.45, 0.0215, 0.01, 0.0215, 0, qSide]);
  mBodies.push([3.1, 0.825, -5.32, 1, 1, 1, 0, qSide]);
  mHeads.push([3.0, 0.825, -5.32, 0.034, 0.034, 0.034, 0]);
  mBands.push([3.145, 0.825, -5.32, 0.0215, 0.01, 0.0215, 0, qSide]);
  inst(UB, mMetal, mLegs);
  inst(UC, mBlack, mCollar);
  inst(UC, mSteel, mPoleLo);
  inst(UC, mSteel, mPoleUp);
  inst(UC, mBlack, mKnob);
  inst(UC, mBlack, mClip);
  inst(GMicBody, mBlack, mBodies);
  inst(UC, mGold, mBands);
  inst(US, mMicHead, mHeads);
  inst(UC, mBlack, mCables);
  // Taburete del cantante
  cyl(0.2, 0.06, mChairSeat, -3.0, 1.0, -5.3);
  cyl(0.025, 0.65, mMetal, -3.0, 0.68, -5.3);
  cyl(0.2, 0.02, mMetal, -3.0, 0.36, -5.3);
  // Monitores de apoyo (letras para el cantante) en soportes
  [-2.8, 2.8].forEach(function (x) {
    cyl(0.2, 0.03, mMetal, x, 0.015, -4.0);
    cyl(0.02, 1.1, mMetal, x, 0.56, -4.0);
    box(0.95, 0.56, 0.05, mBlack, x, 1.3, -4.0);
    plane(0.88, 0.5, mLyrics, x, 1.3, -4.03, Math.PI);
  });

  // ---------- Cabina del presentador (KJ) y rack de amplificadores ----------
  box(2.0, 0.06, 0.85, mWood, 7.0, 0.76, -5.7);
  box(0.06, 0.76, 0.8, mWoodPlain, 6.05, 0.38, -5.7);
  box(0.06, 0.76, 0.8, mWoodPlain, 7.95, 0.38, -5.7);
  box(1.9, 0.5, 0.04, mWoodPlain, 7.0, 0.5, -6.1);
  box(0.5, 0.025, 0.34, mMetal, 6.6, 0.8, -5.65);
  // La tapa y la pantalla comparten un grupo con bisagra: giran juntas y no se desalinean
  var lapG = new THREE.Group();
  lapG.position.set(6.6, 0.8125, -5.8);
  lapG.rotation.x = -0.25;
  group.add(lapG);
  box(0.5, 0.3, 0.015, mBlack, 0, 0.15, 0, lapG);
  var lapScr = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.26), mLaptopScr);
  lapScr.position.set(0, 0.15, 0.0085);
  lapG.add(lapScr);
  box(0.6, 0.08, 0.35, mBlack, 7.4, 0.83, -5.65);
  var knobs = [], fad = [];
  for (var k = 0; k < 6; k++) {
    knobs.push([7.22 + k * 0.07, 0.875, -5.78, 0.016, 0.02, 0.016, 0]);
    fad.push([7.22 + k * 0.07, 0.875, -5.58, 0.012, 0.01, 0.07, 0]);
  }
  inst(UC, mSteel, knobs);
  inst(UB, mSteel, fad);
  box(0.2, 0.2, 0.2, mSpk, 6.25, 0.9, -6.0);
  box(0.2, 0.2, 0.2, mSpk, 7.75, 0.9, -6.0);
  box(0.26, 0.04, 0.1, mBlack, 7.0, 0.81, -5.5);
  // Audífonos y libreta de pedidos sobre la cabina
  var hp = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 14, Math.PI), mBlack);
  hp.position.set(7.55, 0.9, -5.35); hp.rotation.y = 0.4; group.add(hp);
  cyl(0.035, 0.03, mBlack, 7.47, 0.83, -5.32);
  cyl(0.035, 0.03, mBlack, 7.63, 0.83, -5.38);
  box(0.2, 0.012, 0.28, mPaper, 6.2, 0.795, -5.4);
  box(1.0, 1.6, 0.5, mBlack, -7.0, 0.8, -6.5);
  var rackLed = [];
  for (var r = 0; r < 5; r++) {
    box(0.9, 0.2, 0.03, mMetal, -7.0, 0.3 + r * 0.3, -6.22);
    box(0.5, 0.012, 0.01, mSteel, -6.85, 0.3 + r * 0.3, -6.2);
    rackLed.push([-7.35, 0.3 + r * 0.3, -6.19, 0.02, 0.02, 0.01, 0]);
    rackLed.push([-7.25, 0.3 + r * 0.3, -6.19, 0.02, 0.02, 0.01, 0]);
  }
  inst(UB, mLedG, rackLed.filter(function (e, i) { return i % 2 === 0; }));
  inst(UB, mLedR, rackLed.filter(function (e, i) { return i % 2 === 1; }));

  // ---------- Barra: frente de listones, repisas con botellas, vasos y refrigerador ----------
  box(0.8, 1.05, 8, mBarBody, -6.9, 0.525, 1.5);
  var slats = [], slz;
  for (slz = -2.4; slz <= 5.4; slz += 0.2) slats.push([-6.47, 0.5, slz, 0.05, 0.86, 0.1, 0]);
  inst(UB, mWoodLight, slats);
  box(1.15, 0.06, 8.2, mGranite, -6.9, 1.08, 1.5);
  var rail = cyl(0.03, 8, mBrass, -6.3, 0.25, 1.5); rail.rotation.x = Math.PI / 2;
  box(0.8, 1.0, 8.3, mBarBody, -8.55, 0.5, 1.4);
  box(0.85, 0.05, 8.3, mGranite, -8.55, 1.03, 1.4);
  box(0.03, 1.3, 8.2, mMirror, -8.975, 1.7, 1.4);
  box(0.04, 0.05, 8.3, mGold, -8.97, 2.37, 1.4);

  // Botellas con forma (espirituosas, vino, redondas), etiquetas y tapas
  var glassPal = [pc(0x1f5a2a), pc(0x7a4a14), pc(0xdfe8e8), pc(0x1f3f8a), pc(0x7a1a28), pc(0x9fb060)];
  var labelPal = [pc(0xf4efe0), pc(0xe8d9a8), pc(0xc9a227), pc(0xb02a2a), pc(0x2a2a2a)];
  var capPal = [pc(0xd4a24c), pc(0x1a1a1a), pc(0xb02a2a), pc(0xc0c0c8)];
  var bt = [
    { geo: GSpirit, body: [], bodyCol: [], lab: [], labCol: [], cap: [], capCol: [], lr: 0.0415, lh: 0.085, ly: 0.1, cr: 0.0195, cy: 0.296, ch: 0.022 },
    { geo: GWine, body: [], bodyCol: [], lab: [], labCol: [], cap: [], capCol: [], lr: 0.0385, lh: 0.09, ly: 0.1, cr: 0.0175, cy: 0.318, ch: 0.028 },
    { geo: GRound, body: [], bodyCol: [], lab: [], labCol: [], cap: [], capCol: [], lr: 0.0565, lh: 0.06, ly: 0.075, cr: 0.0185, cy: 0.2, ch: 0.02 }
  ];
  var glassTum = [], glassWine = [], bz;
  [1.25, 1.62, 1.99].forEach(function (y, row) {
    box(0.35, 0.04, 8.2, mWood, -8.76, y, 1.4);
    box(0.04, 0.1, 0.04, mBrass, -8.9, y - 0.07, -2.4);
    box(0.04, 0.1, 0.04, mBrass, -8.9, y - 0.07, 5.2);
    for (bz = -2.4; bz <= 5.2; bz += 0.42) {
      var zz = bz + (rnd() - 0.5) * 0.06, by = y + 0.02;
      if (row === 2 && rnd() < 0.4) {
        if (rnd() < 0.5) glassTum.push([-8.76, by, zz, 1, 1, 1, 0]);
        else glassWine.push([-8.76, by, zz, 1, 1, 1, 0]);
      } else {
        var t = bt[Math.floor(rnd() * 3)];
        t.body.push([-8.76, by, zz, 1, 1, 1, 0]); t.bodyCol.push(pick(glassPal));
        t.lab.push([-8.76, by + t.ly, zz, t.lr, t.lh, t.lr, 0]); t.labCol.push(pick(labelPal));
        t.cap.push([-8.76, by + t.cy, zz, t.cr, t.ch, t.cr, 0]); t.capCol.push(pick(capPal));
      }
    }
  });
  bt.forEach(function (t) {
    inst(t.geo, mBottleGlass, t.body, t.bodyCol);
    inst(UC, mLabel, t.lab, t.labCol);
    inst(UC, mCap, t.cap, t.capCol);
  });
  inst(GTumbler, mGlass, glassTum);
  inst(GWineGlass, mGlass, glassWine);

  // Refrigerador de bebidas: carcasa, puerta de vidrio, repisas y latas visibles
  var FX = -8.55, FZ = 6.1;
  box(0.03, 1.9, 0.9, mMetal, FX - 0.385, 0.95, FZ);
  box(0.8, 1.9, 0.03, mMetal, FX, 0.95, FZ - 0.435);
  box(0.8, 1.9, 0.03, mMetal, FX, 0.95, FZ + 0.435);
  box(0.8, 0.04, 0.9, mMetal, FX, 1.92, FZ);
  box(0.8, 0.14, 0.9, mBlack, FX, 0.07, FZ);
  var grill = [];
  for (var gi = 0; gi < 8; gi++) grill.push([FX + 0.401, 0.07, FZ - 0.35 + gi * 0.1, 0.01, 0.08, 0.05, 0]);
  inst(UB, mMetal, grill);
  plane(0.78, 1.55, mFridgeIn, FX - 0.368, 1.0, FZ, Math.PI / 2);
  box(0.04, 0.08, 0.9, mMetal, FX + 0.38, 1.82, FZ);
  box(0.04, 0.08, 0.9, mMetal, FX + 0.38, 0.19, FZ);
  box(0.04, 1.6, 0.04, mMetal, FX + 0.38, 1.0, FZ - 0.43);
  box(0.04, 1.6, 0.04, mMetal, FX + 0.38, 1.0, FZ + 0.43);
  box(0.015, 1.55, 0.82, mGlass, FX + 0.385, 1.0, FZ);
  box(0.03, 1.0, 0.03, mSteel, FX + 0.43, 1.0, FZ + 0.35);
  box(0.06, 0.03, 0.03, mSteel, FX + 0.41, 1.45, FZ + 0.35);
  box(0.06, 0.03, 0.03, mSteel, FX + 0.41, 0.55, FZ + 0.35);
  var cans = [], canCol = [], canPal = [pc(0xc1272d), pc(0x2060b0), pc(0x2f8a3a), pc(0xd0d4da), pc(0xe08a1a), pc(0x7a3aa0)];
  [0.45, 0.8, 1.15, 1.5].forEach(function (y) {
    box(0.68, 0.015, 0.82, mSteel, FX - 0.02, y, FZ);
    for (var cx = 0; cx < 2; cx++) for (var cz = 0; cz < 10; cz++) {
      cans.push([FX + 0.1 + cx * 0.1 - 0.2, y + 0.0075 + 0.06, FZ - 0.36 + cz * 0.08, 0.033, 0.12, 0.033, 0]);
      canCol.push(canPal[(cz + cx * 2) % canPal.length]);
    }
  });
  inst(UC, mCan, cans, canCol);
  plane(0.7, 0.18, mFridgeSign, FX + 0.402, 2.0, FZ, Math.PI / 2);
  box(0.03, 0.22, 0.74, mFrame, FX + 0.395, 2.0, FZ);

  // Caja registradora, grifos de cerveza, jarras, copas y accesorios de la barra
  box(0.4, 0.22, 0.34, mBlack, -7.0, 1.22, 3.3);
  var reg = box(0.38, 0.2, 0.02, mBlack, -7.0, 1.4, 3.15); reg.rotation.x = -0.4;
  box(0.34, 0.05, 0.1, mSteel, -7.0, 1.14, 3.5);
  for (var kk = 0; kk < 4; kk++) for (var kj = 0; kj < 3; kj++) box(0.03, 0.01, 0.03, mSteel, -7.1 + kj * 0.05, 1.335, 3.35 - kk * 0.04);
  box(0.12, 0.25, 0.5, mSteel, -6.95, 1.24, 0.5);
  [0.3, 0.5, 0.7].forEach(function (zz) {
    cyl(0.015, 0.2, mSteel, -6.95, 1.42, zz);
    box(0.02, 0.1, 0.02, mBlack, -6.95, 1.5, zz);
    box(0.04, 0.02, 0.04, mGold, -6.95, 1.36, zz + 0.0);
  });
  var mugs = [], mugBeer = [], mugFoam = [];
  [[-6.7, 1.3], [-6.7, 2.2], [-6.65, 4.4]].forEach(function (p) {
    mugs.push([p[0], 1.11, p[1], 1, 1, 1, 0]);
    mugBeer.push([p[0], 1.11 + 0.07, p[1], 0.04, 0.11, 0.04, 0]);
    mugFoam.push([p[0], 1.11 + 0.135, p[1], 0.041, 0.025, 0.041, 0]);
  });
  inst(GMug, mGlass, mugs);
  inst(GMugHandle, mGlass, mugs);
  inst(UC, mBeer, mugBeer);
  inst(UC, mFoam, mugFoam);
  var barTum = [], barWine = [];
  [-1.4, -0.4, 3.9].forEach(function (zz) { barTum.push([-6.7, 1.11, zz, 1, 1, 1, 0]); });
  [1.7, 2.6].forEach(function (zz) { barWine.push([-7.0, 1.11, zz, 1, 1, 1, 0]); });
  inst(GTumbler, mGlass, barTum);
  inst(GWineGlass, mGlass, barWine);
  // Cubeta de hielo con botella, tarro de propinas y dispensador de servilletas
  var bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.22, 16), mSteel);
  bucket.position.set(-7.0, 1.22, 5.0); bucket.castShadow = true; group.add(bucket);
  var champ = new THREE.Mesh(GWine, mBottleGlass.clone());
  champ.material.color.set(0x1f5a2a); champ.position.set(-7.0, 1.2, 5.0); group.add(champ);
  var champCap = cyl(0.0175, 0.04, mGold, -7.0, 1.52, 5.0);
  var jar = new THREE.Mesh(GTumbler, mGlass); jar.scale.set(1.3, 1.5, 1.3); jar.position.set(-6.75, 1.11, 0.0); group.add(jar);
  for (var cc = 0; cc < 5; cc++) cyl(0.014, 0.004, mCoin, -6.75 + (rnd() - 0.5) * 0.03, 1.12 + cc * 0.006, (rnd() - 0.5) * 0.03);
  box(0.14, 0.12, 0.08, mSteel, -6.95, 1.17, 4.0);
  box(0.12, 0.012, 0.06, mPaper, -6.95, 1.24, 4.0);
  // Menú de pizarra (sobre el espejo) y letrero de neón
  box(3.1, 0.95, 0.05, mFrame, -8.975, 2.9, 0.6);
  plane(3.0, 0.85, mMenu, -8.945, 2.9, 0.6, Math.PI / 2);
  plane(2.0, 0.64, mNeon, -8.945, 2.95, 4.3, Math.PI / 2);

  // Taburetes de barra con aro para los pies
  var stSeat = [], stCush = [], stPost = [], stBase = [], stRing = [], stBack = [];
  function addStool(x, z, h) {
    stSeat.push([x, h, z, 0.2, 0.05, 0.2, 0]);
    stCush.push([x, h + 0.04, z, 0.18, 0.04, 0.18, 0]);
    stPost.push([x, h / 2, z, 0.025, h, 0.025, 0]);
    stBase.push([x, 0.015, z, 0.19, 0.03, 0.19, 0]);
    stRing.push([x, 0.3, z, 0.17, 0.17, 0.17, 0, qFront]);
  }
  [-1.5, -0.2, 1.1, 2.4, 3.7, 5.0].forEach(function (zz) { addStool(-5.8, zz, 0.78); });
  var GRing = new THREE.TorusGeometry(1, 0.07, 6, 18);
  inst(GRing, mBrass, stRing);
  inst(UC, mChairSeat, stSeat);
  inst(UC, mCushion, stCush);
  inst(UC, mSteel, stPost);
  inst(UC, mMetal, stBase);

  // ---------- Mesas redondas con sillas completas y detalles ----------
  var tTop = [], tEdge = [], tPost = [], tBase = [], tFoot = [], tablet = [], tabletScr = [];
  var cups = [], wines = [], candle = [], flame = [], napkin = [];
  var cSeat = [], cCush = [], cLegF = [], cLegB = [], cRail = [], cSlat = [], cStr = [];
  [[-3.2, -0.5], [0, -0.5], [3.2, -0.5], [-1.6, 3], [1.6, 3]].forEach(function (t, ti) {
    var tx = t[0], tz = t[1];
    tTop.push([tx, 0.75, tz, 0.55, 0.04, 0.55, 0]);
    tEdge.push([tx, 0.73, tz, 0.57, 0.03, 0.57, 0]);
    tPost.push([tx, 0.37, tz, 0.05, 0.74, 0.05, 0]);
    tBase.push([tx, 0.02, tz, 0.3, 0.04, 0.3, 0]);
    tFoot.push([tx, 0.05, tz, 0.4, 0.04, 0.05, 0.7]);
    tFoot.push([tx, 0.05, tz, 0.05, 0.04, 0.4, 0.7]);
    tablet.push([tx + 0.18, 0.775, tz + 0.1, 0.3, 0.015, 0.22, 0.4 + ti]);
    tabletScr.push([tx + 0.18, 0.7845, tz + 0.1, 0.27, 1, 0.19, 0.4 + ti]);
    cups.push([tx - 0.2, 0.77, tz + 0.15, 1, 1, 1, 0]);
    wines.push([tx - 0.3, 0.77, tz - 0.1, 1, 1, 1, 0]);
    candle.push([tx, 0.8, tz, 0.03, 0.05, 0.03, 0]);
    flame.push([tx, 0.84, tz, 0.012, 0.018, 0.012, 0]);
    napkin.push([tx + 0.1, 0.8, tz - 0.2, 0.08, 0.07, 0.05, 0.3]);
    for (var c = 0; c < 4; c++) {
      var a = c * Math.PI / 2 + 0.5;
      var cx = tx + Math.cos(a) * 0.82, cz = tz + Math.sin(a) * 0.82;
      var th = Math.atan2(-Math.cos(a), -Math.sin(a)), p;
      cSeat.push([cx, 0.43, cz, 0.44, 0.04, 0.42, th]);
      cCush.push([cx, 0.465, cz, 0.4, 0.04, 0.38, th]);
      [[-0.19, 0.18], [0.19, 0.18]].forEach(function (l) {
        var q = rotOff(cx, cz, th, l[0], l[1]); cLegF.push([q[0], 0.205, q[1], 0.035, 0.41, 0.035, th]);
      });
      [[-0.19, -0.18], [0.19, -0.18]].forEach(function (l) {
        var q = rotOff(cx, cz, th, l[0], l[1]); cLegB.push([q[0], 0.45, q[1], 0.035, 0.9, 0.035, th]);
      });
      p = rotOff(cx, cz, th, 0, -0.18); cRail.push([p[0], 0.86, p[1], 0.4, 0.08, 0.03, th]);
      p = rotOff(cx, cz, th, 0, -0.18); cRail.push([p[0], 0.55, p[1], 0.4, 0.05, 0.03, th]);
      [-0.11, 0, 0.11].forEach(function (sx) {
        var q = rotOff(cx, cz, th, sx, -0.18); cSlat.push([q[0], 0.66, q[1], 0.04, 0.4, 0.028, th]);
      });
      [-0.19, 0.19].forEach(function (sx) {
        var q = rotOff(cx, cz, th, sx, 0); cStr.push([q[0], 0.15, q[1], 0.02, 0.02, 0.36, th]);
      });
    }
  });
  // ---------- Zona de sofás con mesas bajas, patas y cojines ----------
  var buttons = [], sofaLegs = [];
  // Cojín ovalado/redondo (elipsoide) con botón central en ambas caras
  function pillow(g, x, y, z, rx, ry, rz, mat, ex, ey, ez) {
    var pg = new THREE.Group();
    pg.position.set(x, y, z);
    pg.rotation.set(ex || 0, ey || 0, ez || 0);
    var e = new THREE.Mesh(US, mat);
    e.scale.set(rx, ry, rz);
    e.castShadow = e.receiveShadow = true;
    pg.add(e);
    [1, -1].forEach(function (sg) {
      var b = new THREE.Mesh(US, mGold);
      b.scale.set(0.02, 0.02, 0.012);
      b.position.set(0, 0, sg * rz * 0.97);
      pg.add(b);
    });
    g.add(pg);
  }
  function sofa(x, z, rot, len, mat, pil) {
    var g = pivot(x, 0, z, rot);
    box(len, 0.36, 0.95, mat, 0, 0.3, 0, g);
    box(len, 0.7, 0.2, mat, 0, 0.8, -0.38, g);
    box(0.2, 0.55, 0.95, mat, -len / 2 + 0.1, 0.55, 0, g);
    box(0.2, 0.55, 0.95, mat, len / 2 - 0.1, 0.55, 0, g);
    box((len - 0.4) / 2 - 0.02, 0.14, 0.72, mCushion, -(len - 0.4) / 4, 0.55, 0.06, g);
    box((len - 0.4) / 2 - 0.02, 0.14, 0.72, mCushion, (len - 0.4) / 4, 0.55, 0.06, g);
    pillow(g, -len / 4, 0.8, -0.25, 0.27, 0.22, 0.1, mCushion, -0.2, 0, 0);
    pillow(g, len / 4, 0.8, -0.25, 0.27, 0.22, 0.1, mCushion, -0.2, 0, 0);
    pillow(g, -len / 2 + 0.45, 0.74, -0.08, 0.19, 0.19, 0.075, pil[0], -0.3, 0.3, 0.1);
    pillow(g, len / 2 - 0.45, 0.72, -0.08, 0.21, 0.16, 0.075, pil[1], -0.3, -0.3, -0.15);
    box(len + 0.02, 0.025, 0.97, mGold, 0, 0.485, 0, g);
    for (var b = 0; b < 5; b++) {
      var p = rotOff(x, z, rot, -len / 2 + 0.45 + b * (len - 0.9) / 4, -0.27);
      buttons.push([p[0], 0.9, p[1], 0.025, 0.025, 0.025, 0]);
    }
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (l) {
      var q = rotOff(x, z, rot, l[0] * (len / 2 - 0.1), l[1] * 0.4);
      sofaLegs.push([q[0], 0.06, q[1], 0.035, 0.12, 0.035, 0]);
    });
  }
  var pillowMats = [[std({ color: colors.accent, roughness: 0.95 }), std({ color: 0x2a8a8a, roughness: 0.95 })],
                    [std({ color: 0xc85a7a, roughness: 0.95 }), std({ color: colors.accent, roughness: 0.95 })],
                    [std({ color: 0x2a8a8a, roughness: 0.95 }), std({ color: 0xc85a7a, roughness: 0.95 })]];
  [-3.0, 0.2, 3.4].forEach(function (zz, i) {
    sofa(8.3, zz, -Math.PI / 2, 2.8, mLeather[i % 3], pillowMats[i]);
    box(0.7, 0.04, 1.2, mTable, 6.8, 0.45, zz);
    box(0.06, 0.43, 0.06, mMetal, 6.8, 0.22, zz);
    box(0.5, 0.02, 0.9, mTable, 6.8, 0.03, zz);
    tablet.push([6.75, 0.485, zz - 0.2, 0.2, 0.015, 0.28, 0.2]);
    tabletScr.push([6.75, 0.4945, zz - 0.2, 0.17, 1, 0.25, 0.2]);
    cups.push([6.85, 0.47, zz + 0.1, 1, 1, 1, 0]);
    wines.push([6.7, 0.47, zz + 0.35, 1, 1, 1, 0]);
    cyl(0.09, 0.05, mPaper, 6.9, 0.5, zz - 0.35);
    napkin.push([6.65, 0.5, zz + 0.2, 0.08, 0.07, 0.05, 0.3]);
  });
  inst(UC, mBlack, [[6.7, 0.47, 0.05, 0.02, 0.2, 0.02, 0, qSide], [6.8, 0.47, 3.15, 0.02, 0.2, 0.02, 0, qSide]]);
  inst(US, mSteel, buttons);
  inst(UC, mWoodPlain, sofaLegs);

  // ---------- Instanciados de mesas, sillas y accesorios ----------
  inst(UC, mTable, tTop);
  inst(UC, mGold, tEdge);
  inst(UC, mTable, tPost);
  inst(UC, mTable, tBase);
  inst(UB, mTable, tFoot);
  var hitList = tablet.map(function (t) { return [t[0], t[1] + 0.08, t[2], Math.max(t[3], t[5]) + 0.3, 0.18, Math.max(t[3], t[5]) + 0.3, t[6]]; });
  var tabletMeshes = [inst(UB, mBlack, tablet), inst(UPlane, mTabletScr, tabletScr), inst(UB, mHit, hitList)];
  inst(GTumbler, mGlass, cups);
  inst(GWineGlass, mGlass, wines);
  inst(UC, mPaper, candle);
  inst(US, mFlame, flame);
  inst(UB, mSteel, napkin);
  inst(UB, mWoodPlain, cSeat);
  inst(UB, mChairSeat, cCush);
  inst(UB, mWoodPlain, cLegF);
  inst(UB, mWoodPlain, cLegB);
  inst(UB, mWoodPlain, cRail);
  inst(UB, mWoodPlain, cSlat);
  inst(UB, mWoodPlain, cStr);

  // ---------- Estante de álbumes de vinilo, cuadros y detalles de pared ----------
  function albumTex(c1, c2, v, title) {
    return clampTex(makeTex(256, 256, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.strokeStyle = 'rgba(255,255,255,0.8)';
      var i;
      if (v === 0) {
        g.beginPath(); g.arc(128, 105, 52, 0, Math.PI * 2); g.fill();
        for (i = 0; i < 5; i++) g.fillRect(34, 176 + i * 7, 188, 3);
      } else if (v === 1) {
        g.lineWidth = 6;
        for (i = 0; i < 5; i++) { g.beginPath(); g.arc(128, 150, 24 + i * 20, Math.PI, 0); g.stroke(); }
      } else {
        for (i = 0; i < 6; i++) g.fillRect(20 + i * 40, 30, 16, 150 - i * 12);
        g.beginPath(); g.arc(190, 70, 26, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#ffffff'; g.font = 'bold 28px Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(title, w / 2, 222);
    }));
  }
  var CX = 8.7, CZ = 5.9, RH = 1.56;
  box(0.03, RH, 0.96, mWoodPlain, CX + 0.235, RH / 2, CZ);
  box(0.5, RH, 0.03, mWoodPlain, CX, RH / 2, CZ - 0.465);
  box(0.5, RH, 0.03, mWoodPlain, CX, RH / 2, CZ + 0.465);
  [0.02, 0.4, 0.78, 1.16, 1.55].forEach(function (y) { box(0.5, 0.03, 0.96, mWoodPlain, CX, y, CZ); });
  // Fundas de discos de pie (se ve el lomo); algunas sobresalen como si estuvieran escogiendo
  var sleeves = [], sleeveCol = [], spPal = [pc(0x8a1a30), pc(0x2a4a8a), pc(0xc9a227), pc(0x2f7a3a), pc(0x5a2a6a), pc(0xd8d0c0), pc(0x1a1a22), pc(0xd05a2a)];
  [0.035, 0.415, 0.795, 1.175].forEach(function (y) {
    var zz = CZ - 0.43;
    while (zz < CZ + 0.42) {
      var tk = 0.007 + rnd() * 0.009;
      var pull = rnd() < 0.1 ? -0.09 : 0;
      sleeves.push([CX + 0.02 + pull, y + 0.158, zz + tk / 2, 0.31, 0.31, tk, 0]);
      sleeveCol.push(pick(spPal));
      zz += tk + 0.003;
    }
  });
  inst(UB, mBook, sleeves, sleeveCol);
  // Portadas de álbumes exhibidas encima del estante
  [albumTex('#ff7a59', '#4b1d6b', 0, 'ESTRELLAS'), albumTex('#2bd4c8', '#0b2a5b', 1, 'VERANO'), albumTex('#ff4f9a', '#1a1a3a', 2, 'NEÓN')].forEach(function (t, i) {
    var ag = pivot(CX + 0.05, 1.565, CZ - 0.31 + i * 0.31, 0);
    ag.rotation.z = -0.2;
    box(0.012, 0.3, 0.3, mPaper, 0, 0.15, 0, ag);
    var cover = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ map: t }));
    cover.rotation.y = -Math.PI / 2; cover.position.set(-0.008, 0.15, 0);
    ag.add(cover);
  });
  [[-3.0, 0], [0.2, 1], [3.4, 2]].forEach(function (p) {
    box(0.06, 1.3, 1.0, mFrame, 8.94, 2.35, p[0]);
    plane(0.86, 1.2, new THREE.MeshBasicMaterial({ map: tPoster[p[1]] }), 8.9, 2.35, p[0], -Math.PI / 2);
  });
  // Paneles acústicos
  var ac = [];
  [-7.4, -6.2, -5.0].forEach(function (x) { ac.push([x, 2.0, 6.94, 1.1, 0.9, 0.06, 0]); ac.push([x, 3.0, 6.94, 1.1, 0.9, 0.06, 0]); });
  [6.0, 7.2, 8.2].forEach(function (x) { ac.push([x, 2.0, 6.94, 1.0, 0.9, 0.06, 0]); ac.push([x, 3.0, 6.94, 1.0, 0.9, 0.06, 0]); });
  inst(UB, mAcoustic, ac);
  // Reloj y discos de oro enmarcados
  var disc = [], plaque = [], hole = [];
  [-1.1, 0.0, 1.0].forEach(function (x) {
    plaque.push([x, 2.5, 6.94, 0.7, 0.7, 0.04, 0]);
    disc.push([x, 2.5, 6.9, 0.28, 0.02, 0.28, 0, qFront]);
    hole.push([x, 2.5, 6.88, 0.05, 0.02, 0.05, 0, qFront]);
  });
  inst(UB, mFrame, plaque);
  inst(UC, mGold, disc);
  inst(UC, mBlack, hole);
  buildClock(-3.4, 2.7, 6.95);

  // ---------- Puerta de entrada con herrajes, salida y accesorios ----------
  box(1.3, 0.1, 0.1, mFrame, 3.5, 2.28, 6.93);
  box(0.1, 2.3, 0.1, mFrame, 2.9, 1.15, 6.93);
  box(0.1, 2.3, 0.1, mFrame, 4.1, 1.15, 6.93);
  box(1.05, 2.2, 0.06, mDoor, 3.5, 1.1, 6.9);
  box(0.4, 0.8, 0.02, mGlass, 3.5, 1.5, 6.86);
  box(0.46, 0.06, 0.03, mFrame, 3.5, 1.93, 6.87);
  box(0.46, 0.06, 0.03, mFrame, 3.5, 1.07, 6.87);
  box(0.06, 0.86, 0.03, mFrame, 3.27, 1.5, 6.87);
  box(0.06, 0.86, 0.03, mFrame, 3.73, 1.5, 6.87);
  box(0.95, 0.2, 0.02, mBrass, 3.5, 0.15, 6.86);
  box(0.04, 0.04, 0.2, mSteel, 3.15, 1.05, 6.8);
  cyl(0.025, 0.05, mSteel, 3.15, 1.05, 6.86);
  [0.35, 1.1, 1.85].forEach(function (y) { box(0.04, 0.12, 0.05, mBrass, 4.0, y, 6.88); });
  box(0.08, 0.3, 0.06, mMetal, 3.1, 2.2, 6.85);
  plane(0.9, 0.34, mExit, 3.5, 2.6, 6.9, Math.PI);
  box(0.96, 0.4, 0.04, mBlack, 3.5, 2.6, 6.935);
  cyl(0.02, 1.7, mWoodPlain, 5.6, 0.85, 6.5);
  cyl(0.22, 0.03, mWoodPlain, 5.6, 0.015, 6.5);
  [[0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]].forEach(function (h) {
    box(0.04, 0.04, 0.1, mBrass, 5.6 + h[0], 1.65, 6.5 + h[1]);
  });
  // Papelera con tapa y extintor con manguera y soporte
  cyl(0.15, 0.5, mMetal, 2.4, 0.25, 6.6);
  cyl(0.16, 0.03, mSteel, 2.4, 0.52, 6.6);
  box(0.12, 0.04, 0.04, mBlack, 2.4, 0.56, 6.6);
  cyl(0.065, 0.45, mExt, 8.6, 0.3, 6.65);
  cyl(0.03, 0.08, mBlack, 8.6, 0.56, 6.65);
  box(0.04, 0.08, 0.06, mMetal, 8.6, 0.62, 6.65);
  box(0.14, 0.04, 0.04, mBlack, 8.6, 0.12, 6.65);

  // ---------- Plantas decorativas (maceta con tierra, hojas instanciadas) ----------
  var leaves = [], pots = [], soil = [], rims = [];
  [[7.0, 6.4], [-8.3, -4.8], [-5.5, 6.3], [0, 6.4]].forEach(function (p) {
    pots.push([p[0], 0.25, p[1], 0.24, 0.5, 0.24, 0]);
    rims.push([p[0], 0.5, p[1], 0.275, 0.05, 0.275, 0]);
    soil.push([p[0], 0.52, p[1], 0.24, 0.03, 0.24, 0]);
    for (var l = 0; l < 10; l++) {
      var an = rnd() * Math.PI * 2, tilt = 0.2 + rnd() * 0.5, len = 0.7 + rnd() * 0.5;
      var dir = new THREE.Vector3(Math.sin(tilt) * Math.cos(an), Math.cos(tilt), Math.sin(tilt) * Math.sin(an));
      var q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
      leaves.push([p[0] + dir.x * len / 2, 0.52 + dir.y * len / 2, p[1] + dir.z * len / 2, 0.1, len, 0.1, 0, q]);
    }
  });
  inst(UC, mPot, pots);
  inst(UC, mPot, rims);
  inst(UC, mSoil, soil);
  inst(UCone, mLeaf, leaves);

  group.userData.tablets = tabletMeshes.filter(Boolean);
  group.userData.screen = {
    texture: tLyrics,
    draw: function (st) {
      var cv = tLyrics.image;
      drawLyrics(cv.getContext('2d'), cv.width, cv.height, st);
      tLyrics.needsUpdate = true;
    }
  };

  return {
    group: group
  };
}
