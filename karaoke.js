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
