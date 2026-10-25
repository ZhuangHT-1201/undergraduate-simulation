const FONT_STACK = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';

export const TYPE = {
  display: 36,
  title: 24,
  heading: 19,
  body: 15,
  label: 13,
  caption: 11,
};

export const COLORS = {
  ink: '#F5F1E8',
  inkMuted: 'rgba(225, 228, 229, 0.66)',
  inkFaint: 'rgba(225, 228, 229, 0.42)',
  night: '#101827',
  nightDeep: '#0A111D',
  glass: 'rgba(25, 34, 51, 0.86)',
  glassStrong: 'rgba(18, 27, 43, 0.96)',
  line: 'rgba(255, 255, 255, 0.12)',
  paper: '#F4EDE2',
  paperInk: '#263041',
  coral: '#FF8A6B',
  coralDeep: '#E9694D',
  gold: '#EBC779',
  jade: '#76CDA1',
  sky: '#84BFE8',
  warning: '#F3B55B',
  danger: '#ED7A76',
};

export const SCENE_LABELS = {
  menu: 'FOUR YEARS',
  create_role: 'NEW CHAPTER',
  school: 'CAMPUS',
  major: 'DIRECTION',
  play: 'SEMESTER',
  ending: 'EPILOGUE',
  gallery: 'ENDINGS',
  achievements: 'MILESTONES',
  cg_gallery: 'MOMENTS',
  bgm_gallery: 'SOUNDTRACK',
  settings: 'SETTINGS',
  inventory: 'POCKET',
  run_log: 'JOURNAL',
  relations: 'CONNECTIONS',
};

export function font(size, weight = 400) {
  return `${weight} ${Math.round(size)}px ${FONT_STACK}`;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function easeOutCubic(t) {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

export function alpha(hex, value) {
  const source = String(hex || '').replace('#', '');
  if (source.length !== 6) return `rgba(255,255,255,${value})`;
  const n = Number.parseInt(source, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${value})`;
}

export function roundRectPath(ctx, x, y, w, h, radius = 12) {
  const r = Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function fillRoundRect(ctx, x, y, w, h, radius, fillStyle) {
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

export function strokeRoundRect(ctx, x, y, w, h, radius, strokeStyle, lineWidth = 1) {
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

export function drawGlassPanel(ctx, x, y, w, h, options = {}) {
  const radius = options.radius == null ? 18 : options.radius;
  const strength = options.strong ? COLORS.glassStrong : COLORS.glass;
  ctx.save();
  ctx.shadowColor = options.shadow === false ? 'transparent' : 'rgba(0, 0, 0, 0.24)';
  ctx.shadowBlur = options.shadow === false ? 0 : 18;
  ctx.shadowOffsetY = options.shadow === false ? 0 : 8;
  fillRoundRect(ctx, x, y, w, h, radius, options.fill || strength);
  ctx.shadowColor = 'transparent';
  roundRectPath(ctx, x, y, w, h, radius);
  const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
  gradient.addColorStop(0, options.stroke || 'rgba(255,255,255,0.15)');
  gradient.addColorStop(1, 'rgba(255,255,255,0.025)');
  ctx.strokeStyle = gradient;
  ctx.lineWidth = options.lineWidth || 1;
  ctx.stroke();
  ctx.restore();
}

export function drawPaperPanel(ctx, x, y, w, h, options = {}) {
  const radius = options.radius == null ? 18 : options.radius;
  ctx.save();
  ctx.shadowColor = options.shadow === false ? 'transparent' : 'rgba(3, 8, 17, 0.3)';
  ctx.shadowBlur = options.shadow === false ? 0 : 20;
  ctx.shadowOffsetY = options.shadow === false ? 0 : 10;
  fillRoundRect(ctx, x, y, w, h, radius, options.fill || COLORS.paper);
  ctx.shadowColor = 'transparent';
  strokeRoundRect(ctx, x, y, w, h, radius, options.stroke || 'rgba(65, 59, 49, 0.11)', 1);
  ctx.restore();
}

export function drawSceneKicker(ctx, x, y, label, tone = COLORS.gold) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = font(TYPE.caption, 700);
  ctx.fillStyle = tone;
  ctx.fillText(String(label || '').toUpperCase(), x + 17, y);
  ctx.fillStyle = tone;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(x, y - 1, 10, 2);
  ctx.restore();
}

export function drawChevron(ctx, x, y, size, color, direction = 'right') {
  const s = size / 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.4, size * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (direction === 'right') {
    ctx.moveTo(x - s * 0.22, y - s * 0.7);
    ctx.lineTo(x + s * 0.32, y);
    ctx.lineTo(x - s * 0.22, y + s * 0.7);
  } else if (direction === 'left') {
    ctx.moveTo(x + s * 0.22, y - s * 0.7);
    ctx.lineTo(x - s * 0.32, y);
    ctx.lineTo(x + s * 0.22, y + s * 0.7);
  } else if (direction === 'up') {
    ctx.moveTo(x - s * 0.7, y + s * 0.22);
    ctx.lineTo(x, y - s * 0.32);
    ctx.lineTo(x + s * 0.7, y + s * 0.22);
  } else {
    ctx.moveTo(x - s * 0.7, y - s * 0.22);
    ctx.lineTo(x, y + s * 0.32);
    ctx.lineTo(x + s * 0.7, y - s * 0.22);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawIcon(ctx, name, x, y, size, color = COLORS.ink) {
  const s = size;
  const cx = x + s / 2;
  const cy = y + s / 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.35, s * 0.075);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (name === 'back') {
    drawChevron(ctx, x + s * 0.52, cy, s * 0.58, color, 'left');
    ctx.beginPath();
    ctx.moveTo(x + s * 0.74, cy);
    ctx.lineTo(x + s * 0.2, cy);
    ctx.stroke();
  } else if (name === 'people') {
    ctx.beginPath();
    ctx.arc(cx - s * 0.12, y + s * 0.32, s * 0.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + s * 0.2, y + s * 0.38, s * 0.095, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + s * 0.14, y + s * 0.76);
    ctx.quadraticCurveTo(x + s * 0.22, y + s * 0.5, x + s * 0.48, y + s * 0.54);
    ctx.quadraticCurveTo(x + s * 0.64, y + s * 0.58, x + s * 0.66, y + s * 0.76);
    ctx.stroke();
  } else if (name === 'book') {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.12, y + s * 0.26);
    ctx.quadraticCurveTo(x + s * 0.3, y + s * 0.18, cx, y + s * 0.3);
    ctx.quadraticCurveTo(x + s * 0.7, y + s * 0.18, x + s * 0.88, y + s * 0.26);
    ctx.lineTo(x + s * 0.88, y + s * 0.76);
    ctx.quadraticCurveTo(x + s * 0.7, y + s * 0.68, cx, y + s * 0.8);
    ctx.quadraticCurveTo(x + s * 0.3, y + s * 0.68, x + s * 0.12, y + s * 0.76);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, y + s * 0.3);
    ctx.lineTo(cx, y + s * 0.8);
    ctx.stroke();
  } else if (name === 'bag') {
    roundRectPath(ctx, x + s * 0.17, y + s * 0.3, s * 0.66, s * 0.52, s * 0.12);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, y + s * 0.35, s * 0.19, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + s * 0.3, y + s * 0.56);
    ctx.lineTo(x + s * 0.7, y + s * 0.56);
    ctx.stroke();
  } else if (name === 'home') {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.13, y + s * 0.48);
    ctx.lineTo(cx, y + s * 0.17);
    ctx.lineTo(x + s * 0.87, y + s * 0.48);
    ctx.moveTo(x + s * 0.23, y + s * 0.44);
    ctx.lineTo(x + s * 0.23, y + s * 0.84);
    ctx.lineTo(x + s * 0.77, y + s * 0.84);
    ctx.lineTo(x + s * 0.77, y + s * 0.44);
    ctx.stroke();
  } else if (name === 'trophy') {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.3, y + s * 0.18);
    ctx.lineTo(x + s * 0.7, y + s * 0.18);
    ctx.lineTo(x + s * 0.66, y + s * 0.48);
    ctx.quadraticCurveTo(cx, y + s * 0.68, x + s * 0.34, y + s * 0.48);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, y + s * 0.65);
    ctx.lineTo(cx, y + s * 0.82);
    ctx.moveTo(x + s * 0.34, y + s * 0.84);
    ctx.lineTo(x + s * 0.66, y + s * 0.84);
    ctx.stroke();
  } else if (name === 'image') {
    roundRectPath(ctx, x + s * 0.13, y + s * 0.18, s * 0.74, s * 0.64, s * 0.09);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + s * 0.36, y + s * 0.38, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + s * 0.2, y + s * 0.72);
    ctx.lineTo(x + s * 0.43, y + s * 0.48);
    ctx.lineTo(x + s * 0.6, y + s * 0.64);
    ctx.lineTo(x + s * 0.72, y + s * 0.5);
    ctx.lineTo(x + s * 0.84, y + s * 0.72);
    ctx.stroke();
  } else if (name === 'music') {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.58, y + s * 0.2);
    ctx.lineTo(x + s * 0.82, y + s * 0.14);
    ctx.lineTo(x + s * 0.82, y + s * 0.64);
    ctx.moveTo(x + s * 0.58, y + s * 0.2);
    ctx.lineTo(x + s * 0.58, y + s * 0.68);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + s * 0.47, y + s * 0.7, s * 0.12, s * 0.08, -0.3, 0, Math.PI * 2);
    ctx.ellipse(x + s * 0.71, y + s * 0.66, s * 0.12, s * 0.08, -0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (name === 'settings') {
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * s * 0.29, cy + Math.sin(a) * s * 0.29);
      ctx.lineTo(cx + Math.cos(a) * s * 0.4, cy + Math.sin(a) * s * 0.4);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function drawBuilding(ctx, x, y, w, h, color, windowColor, random, litRatio = 0.52) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = windowColor;
  const cols = Math.max(2, Math.floor(w / 13));
  const rows = Math.max(3, Math.floor(h / 14));
  const gapX = w / cols;
  const gapY = h / rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (random() > litRatio) continue;
      const ww = Math.max(2, gapX * 0.36);
      const wh = Math.max(2, gapY * 0.3);
      ctx.globalAlpha = 0.26 + random() * 0.52;
      ctx.fillRect(x + col * gapX + gapX * 0.32, y + row * gapY + gapY * 0.3, ww, wh);
    }
  }
  ctx.globalAlpha = 1;
}

function drawTree(ctx, x, groundY, scale, color, highlight, random) {
  ctx.save();
  ctx.strokeStyle = '#273038';
  ctx.lineWidth = Math.max(2, 5 * scale);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.quadraticCurveTo(x + 3 * scale, groundY - 35 * scale, x - 2 * scale, groundY - 72 * scale);
  ctx.stroke();
  ctx.strokeStyle = '#303B3D';
  ctx.lineWidth = Math.max(1, 2.5 * scale);
  ctx.beginPath();
  ctx.moveTo(x, groundY - 35 * scale);
  ctx.lineTo(x - 22 * scale, groundY - 55 * scale);
  ctx.moveTo(x + 2 * scale, groundY - 49 * scale);
  ctx.lineTo(x + 20 * scale, groundY - 65 * scale);
  ctx.stroke();
  for (let i = 0; i < 13; i++) {
    const a = random() * Math.PI * 2;
    const r = random() * 26 * scale;
    const cx = x + Math.cos(a) * 24 * scale + (random() - 0.5) * 10 * scale;
    const cy = groundY - 78 * scale + Math.sin(a) * 18 * scale;
    ctx.fillStyle = i % 4 === 0 ? highlight : color;
    ctx.globalAlpha = 0.72 + random() * 0.2;
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.12, (8 + random() * 9) * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBackdropArt(ctx, w, h, scene, themeMode, semesterIndex, weekIndex) {
  const light = themeMode === 'light';
  const random = seeded(173 + scene.length * 31 + semesterIndex * 97 + weekIndex * 13);
  const sky = ctx.createLinearGradient(0, 0, w * 0.22, h);
  if (light) {
    sky.addColorStop(0, '#F6EBDD');
    sky.addColorStop(0.46, '#DDEAF0');
    sky.addColorStop(1, '#91A9B2');
  } else {
    sky.addColorStop(0, '#18233A');
    sky.addColorStop(0.42, '#283349');
    sky.addColorStop(0.76, '#45505A');
    sky.addColorStop(1, '#1C2731');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.78, h * 0.18, 8, w * 0.78, h * 0.18, w * 0.62);
  glow.addColorStop(0, light ? 'rgba(255, 226, 174, 0.8)' : 'rgba(235, 183, 124, 0.32)');
  glow.addColorStop(0.48, light ? 'rgba(255, 219, 175, 0.18)' : 'rgba(190, 127, 103, 0.08)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  if (!light) {
    ctx.fillStyle = 'rgba(245, 235, 210, 0.52)';
    for (let i = 0; i < 24; i++) {
      const sx = random() * w;
      const sy = random() * h * 0.42;
      ctx.globalAlpha = 0.12 + random() * 0.45;
      ctx.fillRect(sx, sy, random() > 0.9 ? 1.7 : 1, random() > 0.9 ? 1.7 : 1);
    }
    ctx.globalAlpha = 1;
  }

  const distant = light ? 'rgba(100, 122, 129, 0.18)' : 'rgba(19, 28, 41, 0.5)';
  ctx.fillStyle = distant;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.47);
  ctx.lineTo(w * 0.18, h * 0.35);
  ctx.lineTo(w * 0.35, h * 0.47);
  ctx.lineTo(w * 0.55, h * 0.3);
  ctx.lineTo(w * 0.78, h * 0.45);
  ctx.lineTo(w, h * 0.34);
  ctx.lineTo(w, h * 0.58);
  ctx.lineTo(0, h * 0.58);
  ctx.closePath();
  ctx.fill();

  const groundY = h * 0.69;
  const buildingDark = light ? 'rgba(80, 102, 108, 0.48)' : 'rgba(17, 25, 37, 0.82)';
  const windowLight = light ? 'rgba(255, 243, 208, 0.85)' : 'rgba(255, 218, 154, 0.82)';

  drawBuilding(ctx, w * 0.06, h * 0.22, w * 0.25, h * 0.48, buildingDark, windowLight, random, 0.42);
  drawBuilding(ctx, w * 0.7, h * 0.25, w * 0.24, h * 0.44, buildingDark, windowLight, random, 0.47);

  const towerX = w * 0.51;
  const towerW = w * 0.22;
  const towerTop = h * 0.16;
  ctx.fillStyle = light ? 'rgba(92, 110, 113, 0.62)' : 'rgba(18, 26, 38, 0.92)';
  ctx.fillRect(towerX, towerTop + 24, towerW, h * 0.52);
  ctx.beginPath();
  ctx.moveTo(towerX - 12, towerTop + 26);
  ctx.lineTo(towerX + towerW / 2, towerTop - 5);
  ctx.lineTo(towerX + towerW + 12, towerTop + 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = light ? 'rgba(108, 126, 128, 0.72)' : 'rgba(27, 37, 49, 0.96)';
  ctx.fillRect(towerX + towerW * 0.46, towerTop - 29, towerW * 0.08, 31);
  ctx.beginPath();
  ctx.arc(towerX + towerW * 0.5, towerTop + 108, 20, 0, Math.PI * 2);
  ctx.fillStyle = light ? 'rgba(248, 235, 204, 0.88)' : 'rgba(245, 212, 148, 0.66)';
  ctx.fill();
  ctx.strokeStyle = light ? 'rgba(93, 99, 96, 0.58)' : 'rgba(85, 82, 72, 0.72)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(towerX + towerW * 0.5, towerTop + 108);
  ctx.lineTo(towerX + towerW * 0.5, towerTop + 96);
  ctx.moveTo(towerX + towerW * 0.5, towerTop + 108);
  ctx.lineTo(towerX + towerW * 0.57, towerTop + 112);
  ctx.stroke();
  ctx.fillStyle = light ? 'rgba(68, 91, 96, 0.62)' : 'rgba(12, 20, 31, 0.95)';
  const archY = groundY - h * 0.17;
  ctx.beginPath();
  ctx.moveTo(towerX + 16, groundY);
  ctx.lineTo(towerX + 16, archY + 18);
  ctx.quadraticCurveTo(towerX + towerW / 2, archY - 14, towerX + towerW - 16, archY + 18);
  ctx.lineTo(towerX + towerW - 16, groundY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = light ? 'rgba(64, 81, 82, 0.62)' : 'rgba(12, 19, 27, 0.94)';
  ctx.fillRect(0, groundY, w, h - groundY);
  const pathGradient = ctx.createLinearGradient(w * 0.5, groundY, w * 0.5, h);
  pathGradient.addColorStop(0, light ? 'rgba(206, 196, 176, 0.38)' : 'rgba(75, 75, 67, 0.28)');
  pathGradient.addColorStop(1, light ? 'rgba(238, 228, 207, 0.08)' : 'rgba(168, 140, 101, 0.06)');
  ctx.fillStyle = pathGradient;
  ctx.beginPath();
  ctx.moveTo(w * 0.42, groundY);
  ctx.lineTo(w * 0.56, groundY);
  ctx.lineTo(w * 0.86, h);
  ctx.lineTo(w * 0.1, h);
  ctx.closePath();
  ctx.fill();

  const foliage = light ? '#7D967B' : '#536859';
  const highlight = light ? '#A8B88E' : '#849665';
  drawTree(ctx, w * 0.13, groundY + 12, 1.14, foliage, highlight, random);
  drawTree(ctx, w * 0.88, groundY + 15, 1.3, foliage, highlight, random);
  drawTree(ctx, w * 0.02, groundY + 8, 0.78, foliage, highlight, random);

  ctx.strokeStyle = light ? 'rgba(60, 73, 75, 0.18)' : 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = groundY + 22 + i * 18;
    ctx.beginPath();
    ctx.moveTo(w * (0.31 - i * 0.035), y);
    ctx.lineTo(w * (0.69 + i * 0.055), y);
    ctx.stroke();
  }

  const bottomShade = ctx.createLinearGradient(0, h * 0.52, 0, h);
  bottomShade.addColorStop(0, 'rgba(7, 13, 22, 0)');
  bottomShade.addColorStop(1, light ? 'rgba(29, 43, 53, 0.35)' : 'rgba(5, 10, 18, 0.72)');
  ctx.fillStyle = bottomShade;
  ctx.fillRect(0, h * 0.52, w, h * 0.48);
}

export function renderBackdrop(targetCanvas, options = {}) {
  const ctx = targetCanvas.getContext('2d');
  const width = Number(options.width || targetCanvas.width || 375);
  const height = Number(options.height || targetCanvas.height || 667);
  const dpr = Number(options.dpr || 1);
  if (targetCanvas.width !== Math.round(width * dpr) || targetCanvas.height !== Math.round(height * dpr)) {
    targetCanvas.width = Math.round(width * dpr);
    targetCanvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawBackdropArt(
    ctx,
    width,
    height,
    String(options.scene || 'menu'),
    options.themeMode === 'light' ? 'light' : 'dark',
    Number(options.semesterIndex || 0),
    Number(options.weekIndex || 0),
  );
}

export function drawAmbientMotes(ctx, x, y, w, h, now, themeMode = 'dark') {
  const random = seeded(9341 + w * 13 + h * 7);
  ctx.save();
  for (let i = 0; i < 12; i++) {
    const baseX = x + random() * w;
    const baseY = y + random() * h;
    const phase = random() * Math.PI * 2;
    const radius = 0.8 + random() * 1.6;
    const py = baseY + Math.sin(now * 0.00032 + phase) * (5 + random() * 9);
    const px = baseX + Math.cos(now * 0.00021 + phase) * (3 + random() * 5);
    ctx.globalAlpha = themeMode === 'light' ? 0.1 + random() * 0.12 : 0.12 + random() * 0.28;
    ctx.fillStyle = themeMode === 'light' ? '#6A7D84' : '#F3DAA8';
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
