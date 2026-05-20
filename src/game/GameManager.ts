import * as THREE from 'three';
import { BLOCK_HEIGHT, INITIAL_BLOCK_SIZE, COLORS, ANIMATION_SPEED, SPEED_INCREMENT, CAMERA_OFFSET } from './constants';

export type GameState = 'START' | 'PLAYING' | 'GAMEOVER';

interface Block {
  mesh: THREE.Mesh;
  material: THREE.Material | THREE.Material[];
  width: number;
  depth: number;
  x: number;
  z: number;
  windowMaterials: THREE.MeshStandardMaterial[];
  isExecFloor?: boolean;
}

interface FlyingPerson {
  group: THREE.Group;
  targetPos: THREE.Vector3;
  startPos: THREE.Vector3;
  progress: number;
  speed: number;
}

// Procedural texture generator helpers
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 128, g: 128, b: 128 };
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function blendColorWithOffset(hex: string, lOffset: number, sOffset: number): string {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const h = hsl.h;
  const s = Math.max(0, Math.min(100, hsl.s + sOffset));
  const l = Math.max(0, Math.min(100, hsl.l + lOffset));
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function generateProceduralTexture(colorHex: string): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Determine material style based on the color to match structural design
  let style: 'brick' | 'concrete' | 'metal' | 'stone' | 'tile' = 'concrete';
  
  const c = colorHex.toLowerCase();
  if (c === '#b91c1c' || c === '#ea580c' || c === '#b45309') {
    style = 'brick';
  } else if (c === '#d4d4d8' || c === '#71717a' || c === '#a3a3a3') {
    style = 'metal';
  } else if (c === '#a8a29e' || c === '#78716c') {
    style = 'stone';
  } else if (c === '#f8fafc' || c === '#e5e5e5') {
    style = 'tile';
  } else {
    style = 'concrete';
  }

  // Draw the background color
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, 512, 512);

  // Helper to get noise (small grain)
  const addGrain = (intensity: number) => {
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const rand = (Math.random() - 0.5) * intensity;
      data[i] = Math.max(0, Math.min(255, data[i] + rand));
      data[i+1] = Math.max(0, Math.min(255, data[i+1] + rand));
      data[i+2] = Math.max(0, Math.min(255, data[i+2] + rand));
    }
    ctx.putImageData(imgData, 0, 0);
  };

  // Helper to add large organic noise (dirt/grunge/smudge)
  const addSmudges = (count: number, BaseOpacity: number) => {
    for (let i = 0; i < count; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const size = 30 + Math.random() * 80;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
      const shade = Math.random() > 0.5 ? 255 : 0;
      const alpha = Math.random() * BaseOpacity;
      grad.addColorStop(0, `rgba(${shade}, ${shade}, ${shade}, ${alpha})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  if (style === 'brick') {
    // STYLE 1: DUSTY URBAN CLAY BRICKS
    const rows = 12;
    const cols = 6;
    const rowHeight = 512 / rows;
    const colWidth = 512 / cols;

    for (let r = 0; r < rows; r++) {
      const y = r * rowHeight;
      const xShift = (r % 2) * (colWidth / 2);
      
      for (let c = -1; c <= cols; c++) {
        const x = c * colWidth + xShift;
        const l = Math.random() * 20 - 10;
        const s = Math.random() * 15 - 7.5;
        ctx.fillStyle = blendColorWithOffset(colorHex, l, s);
        ctx.fillRect(x + 2, y + 2, colWidth - 4, rowHeight - 4);

        // Brick organic noise
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        for (let k = 0; k < 10; k++) {
          ctx.fillRect(
            x + 5 + Math.random() * (colWidth - 10),
            y + 5 + Math.random() * (rowHeight - 10),
            1 + Math.random() * 3,
            1 + Math.random() * 3
          );
        }
      }
    }

    // Draw mortar joints
    ctx.strokeStyle = 'rgba(230,225,220,0.4)';
    ctx.lineWidth = 3;
    for (let r = 1; r < rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * rowHeight);
      ctx.lineTo(512, r * rowHeight);
      ctx.stroke();
    }
    for (let r = 0; r < rows; r++) {
      const xShift = (r % 2) * (colWidth / 2);
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        const x = c * colWidth + xShift;
        ctx.moveTo(x, r * rowHeight);
        ctx.lineTo(x, (r + 1) * rowHeight);
        ctx.stroke();
      }
    }
    addGrain(35);
    addSmudges(4, 0.1);

  } else if (style === 'concrete') {
    // STYLE 2: RAW ARCHITECTURAL CONCRETE PANELS WITH TIE-ROD PLUG HOLES
    addSmudges(12, 0.15);
    addGrain(28);

    // Bevel tile lines (concrete panel grid)
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(256, 0); ctx.lineTo(256, 512);
    ctx.moveTo(0, 256); ctx.lineTo(512, 256);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(258, 0); ctx.lineTo(258, 512);
    ctx.moveTo(0, 258); ctx.lineTo(512, 258);
    ctx.stroke();

    // Concrete Tie-rod plug holes
    const drawTieHole = (cx: number, cy: number) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx - 1, cy - 1, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    const offsets = [25, 231, 281, 487];
    offsets.forEach(x => {
      offsets.forEach(y => {
        drawTieHole(x, y);
      });
    });

  } else if (style === 'metal') {
    // STYLE 3: HIGH-TECH RIBBED VERTICAL METALLIC SIDING
    const stripes = 16;
    const stripeWidth = 512 / stripes;

    for (let i = 0; i < stripes; i++) {
      const grad = ctx.createLinearGradient(i * stripeWidth, 0, (i + 1) * stripeWidth, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0.12)');
      grad.addColorStop(0.3, 'rgba(255,255,255,0.04)');
      grad.addColorStop(0.7, 'rgba(0,0,0,0.12)');
      grad.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = grad;
      ctx.fillRect(i * stripeWidth, 0, stripeWidth, 512);
    }

    // Horizontal panel joins
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 128); ctx.lineTo(512, 128);
    ctx.moveTo(0, 256); ctx.lineTo(512, 256);
    ctx.moveTo(0, 384); ctx.lineTo(512, 384);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 129); ctx.lineTo(512, 129);
    ctx.moveTo(0, 257); ctx.lineTo(512, 257);
    ctx.moveTo(0, 385); ctx.lineTo(512, 385);
    ctx.stroke();

    addGrain(20);
    // Vertical brushed metal lines
    for (let k = 0; k < 40; k++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
      ctx.fillRect(Math.random() * 512, 0, 1 + Math.random() * 2, 512);
    }

  } else if (style === 'stone') {
    // STYLE 4: COARSE STACKED STONEWALL WITH NATURAL VARIATIONS
    const rows = 16;
    const rowHeight = 512 / rows;

    for (let r = 0; r < rows; r++) {
      const y = r * rowHeight;
      let x = 0;
      while (x < 512) {
        const stoneWidth = 40 + Math.random() * 90;
        const actualWidth = Math.min(stoneWidth, 512 - x);

        const lShift = Math.random() * 24 - 12;
        const sShift = Math.random() * 10 - 5;
        ctx.fillStyle = blendColorWithOffset(colorHex, lShift, sShift);
        ctx.fillRect(x, y, actualWidth, rowHeight);

        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x + 2, y + 2, actualWidth - 4, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(x + 2, y + rowHeight - 4, actualWidth - 4, 2);

        x += stoneWidth;
      }
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 2.5;
    for (let r = 1; r < rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * rowHeight);
      ctx.lineTo(512, r * rowHeight);
      ctx.stroke();
    }
    
    addGrain(30);
    addSmudges(5, 0.1);

  } else if (style === 'tile') {
    // STYLE 5: CONTEMPORARY CERAMIC TILE CLADDING
    const gridSize = 64;
    addGrain(15);

    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * gridSize, 0); ctx.lineTo(i * gridSize, 512);
      ctx.moveTo(0, i * gridSize); ctx.lineTo(512, i * gridSize);
      ctx.stroke();
    }
    addSmudges(3, 0.08);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;

  return texture;
}

export class GameManager {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private container: HTMLElement;

  private stack: Block[] = [];
  private currentBlock: Block | null = null;
  private fallingBlocks: { 
    mesh: THREE.Mesh; 
    isTumbling: boolean; 
    vx: number; 
    vz: number;
    rvx: number;
    rvy: number;
    rvz: number;
    hasLanded?: boolean;
  }[] = [];
  private flyingPeople: FlyingPerson[] = [];
  private rainSystem: THREE.Points | null = null;
  private windStreaks: THREE.LineSegments | null = null;
  private leaves: THREE.Group | null = null;
  private weatherTransition: number = 0;
  private windIntensity: number = 0;
  private windDirection = new THREE.Vector3(1, 0, 0.3).normalize();
  private lightningIntensity: number = 0;
  private ambientLight: THREE.AmbientLight | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;
  private initialSkyColor = new THREE.Color('#f0f2f5');
  private cloudySkyColor = new THREE.Color('#020617'); // Deep night sky
  private litWindowColor = new THREE.Color('#fcd34d'); // Amber-300
  private lightningColor = new THREE.Color('#ffffff'); // Pure white for peak flash
  private lightningSubFlash: boolean = false;
  private currentWire: THREE.Mesh | null = null;
  private shadowMesh: THREE.Mesh | null = null;
  private shakeIntensity: number = 0;
  private baseCameraX: number = 20;
  private baseCameraZ: number = 20;

  private gameState: GameState = 'START';
  private isDropping: boolean = false;
  private dropVelocity: number = 0;
  private score: number = 0;
  private direction: 'x' | 'z' = 'x';
  private speed: number = ANIMATION_SPEED;
  private moveOffset: number = 0;
  private swingMoveOffset: number = 0;
  private colorIndex: number = 0;

  private onScoreUpdate?: (score: number, populationIncrement?: number) => void;
  private onGameOver?: (score: number) => void;
  private onPerfect?: () => void;
  private onWeatherUpdate?: (transition: number) => void;
  private onSlip?: () => void;
  private onStreakUpdate?: (streak: number) => void;
  private onExecPhaseStateChange?: (active: boolean, durationMs: number) => void;
  private onExecTimerTick?: (remainingMs: number) => void;

  private isSlipping: boolean = false;
  private slipProgress: number = 0;
  private slipStartX: number = 0;
  private slipTargetX: number = 0;
  private slipStartZ: number = 0;
  private slipTargetZ: number = 0;
  private splashParticles: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }[] = [];

  private perfectStreak: number = 0;
  private isExecPhaseActive: boolean = false;
  private execPhaseRemainingMs: number = 0;
  private lastTime: number = performance.now();

  constructor(
    container: HTMLElement, 
    onScoreUpdate?: (score: number, populationIncrement?: number) => void, 
    onGameOver?: (score: number) => void,
    onPerfect?: () => void,
    onWeatherUpdate?: (transition: number) => void,
    onSlip?: () => void,
    onStreakUpdate?: (streak: number) => void,
    onExecPhaseStateChange?: (active: boolean, durationMs: number) => void,
    onExecTimerTick?: (remainingMs: number) => void
  ) {
    this.container = container;
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.onPerfect = onPerfect;
    this.onWeatherUpdate = onWeatherUpdate;
    this.onSlip = onSlip;
    this.onStreakUpdate = onStreakUpdate;
    this.onExecPhaseStateChange = onExecPhaseStateChange;
    this.onExecTimerTick = onExecTimerTick;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f0f2f5');

    const aspect = container.clientWidth / container.clientHeight;
    const d = CAMERA_OFFSET;
    this.camera = new THREE.OrthographicCamera(-d, d, d / aspect, -d / aspect, 1, 1000);
    this.camera.position.set(20, 20, 20);
    this.camera.lookAt(0, -5, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for mobile performance
    this.container.appendChild(this.renderer.domElement);

    this.initLights();
    this.initShadow();
    this.initBase();
    this.initRain();
    this.initWind();
    this.handleResize(); // Initialize with proper responsive bounds
    this.animate();

    window.addEventListener('resize', this.handleResize);
  }

  private initLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.directionalLight.position.set(10, 20, 10);
    this.scene.add(this.directionalLight);
  }

  private initShadow() {
    const geometry = new THREE.PlaneGeometry(INITIAL_BLOCK_SIZE, INITIAL_BLOCK_SIZE);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x000000, 
      transparent: true, 
      opacity: 0.2,
      side: THREE.DoubleSide
    });
    this.shadowMesh = new THREE.Mesh(geometry, material);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.visible = false;
    this.scene.add(this.shadowMesh);
  }

  private createBlockMesh(width: number, height: number, depth: number, color: string, isExecFloor: boolean = false) {
    const group = new THREE.Group();
    
    // Main block
    const geometry = new THREE.BoxGeometry(width, height, depth);

    // Create unique procedural textures for each face orientation to prevent stretching
    const texColor = isExecFloor ? '#eab308' : color;
    const texRight = generateProceduralTexture(texColor);
    texRight.repeat.set(depth / 3.0, height / 3.0);

    const texLeft = texRight.clone();
    texLeft.repeat.set(depth / 3.0, height / 3.0);

    const texTop = generateProceduralTexture(texColor);
    texTop.repeat.set(width / 3.0, depth / 3.0);

    const texBottom = texTop.clone();
    texBottom.repeat.set(width / 3.0, depth / 3.0);

    const texFront = generateProceduralTexture(texColor);
    texFront.repeat.set(width / 3.0, height / 3.0);

    const texBack = texFront.clone();
    texBack.repeat.set(width / 3.0, height / 3.0);

    const roughness = isExecFloor ? 0.2 : 0.45;
    const metalness = isExecFloor ? 0.75 : 0.1;

    const matRight = new THREE.MeshStandardMaterial({ color: texColor, map: texRight, roughness, metalness });
    const matLeft = new THREE.MeshStandardMaterial({ color: texColor, map: texLeft, roughness, metalness });
    const matTop = new THREE.MeshStandardMaterial({ color: texColor, map: texTop, roughness: isExecFloor ? 0.25 : 0.5, metalness: isExecFloor ? 0.7 : 0.05 });
    const matBottom = new THREE.MeshStandardMaterial({ color: texColor, map: texBottom, roughness: isExecFloor ? 0.25 : 0.5, metalness: isExecFloor ? 0.7 : 0.05 });
    const matFront = new THREE.MeshStandardMaterial({ color: texColor, map: texFront, roughness, metalness });
    const matBack = new THREE.MeshStandardMaterial({ color: texColor, map: texBack, roughness, metalness });

    const materialArray = [matRight, matLeft, matTop, matBottom, matFront, matBack];

    const mesh = new THREE.Mesh(geometry, materialArray);
    group.add(mesh);

    // Add windows like in the image
    const windowColor = '#1f2937'; // Dark windows
    const windowMaterials: THREE.MeshStandardMaterial[] = [];
    const windowWidth = width * 0.15;
    const windowHeight = height * 0.35;
    const windowDepth = 0.05;

    const addWindowsToSide = (isFront: boolean, isXSide: boolean) => {
      // Only add windows if side is wide enough
      const sideWidth = isXSide ? depth : width;
      if (sideWidth < 1) return;

      const sideGroup = new THREE.Group();
      
      // Create two windows for the side
      for (let i = 0; i < 2; i++) {
        const winGeom = new THREE.BoxGeometry(
          isXSide ? windowDepth : windowWidth,
          windowHeight,
          isXSide ? windowWidth : windowDepth
        );
        // Individual material for each window so we can update emissions
        const windowMaterial = new THREE.MeshStandardMaterial({ 
          color: windowColor,
          emissive: new THREE.Color(isExecFloor ? '#fbbf24' : '#000000'),
          emissiveIntensity: isExecFloor ? 2.0 : 0
        });
        windowMaterials.push(windowMaterial);
        
        const win = new THREE.Mesh(winGeom, windowMaterial);
        
        const spacing = sideWidth * 0.2;
        if (isXSide) {
          win.position.z = (i === 0 ? -spacing : spacing);
        } else {
          win.position.x = (i === 0 ? -spacing : spacing);
        }
        sideGroup.add(win);
      }

      // Position the side group
      if (isXSide) {
        sideGroup.position.x = (isFront ? width / 2 : -width / 2);
      } else {
        sideGroup.position.z = (isFront ? depth / 2 : -depth / 2);
      }
      group.add(sideGroup);
    };

    // Add windows to all 4 sides
    addWindowsToSide(true, true);   // Right
    addWindowsToSide(false, true);  // Left
    addWindowsToSide(true, false);  // Front
    addWindowsToSide(false, false); // Back

    // Add edges for the building block look
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(
      edges, 
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1 })
    );
    group.add(line);

    return { group, mesh, line, geometry, material: materialArray, windowMaterials };
  }

  private initBase() {
    // 1. Create a foundation platform (wider and thinner)
    const platformSize = INITIAL_BLOCK_SIZE * 3.5;
    const platformHeight = 2.8; // Reduced by 30% (from 4)
    const foundationGeom = new THREE.BoxGeometry(platformSize, platformHeight, platformSize);

    // Create base foundation concrete textures
    const texBaseTop = generateProceduralTexture('#1e293b');
    texBaseTop.repeat.set(platformSize / 3.0, platformSize / 3.0);
    const texBaseSide = generateProceduralTexture('#1e293b');
    texBaseSide.repeat.set(platformSize / 3.0, platformHeight / 3.0);

    const foundationMatArray = [
      new THREE.MeshStandardMaterial({ color: '#1e293b', map: texBaseSide, roughness: 0.7, metalness: 0.1 }), // +X
      new THREE.MeshStandardMaterial({ color: '#1e293b', map: texBaseSide.clone(), roughness: 0.7, metalness: 0.1 }), // -X
      new THREE.MeshStandardMaterial({ color: '#1e293b', map: texBaseTop, roughness: 0.8, metalness: 0.05 }), // +Y
      new THREE.MeshStandardMaterial({ color: '#1e293b', map: texBaseTop.clone(), roughness: 0.8, metalness: 0.05 }), // -Y
      new THREE.MeshStandardMaterial({ color: '#1e293b', map: texBaseSide.clone(), roughness: 0.7, metalness: 0.1 }), // +Z
      new THREE.MeshStandardMaterial({ color: '#1e293b', map: texBaseSide.clone(), roughness: 0.7, metalness: 0.1 })  // -Z
    ];

    const foundation = new THREE.Mesh(foundationGeom, foundationMatArray);
    
    // Add edges for detail
    const edges = new THREE.EdgesGeometry(foundationGeom);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 }));
    foundation.add(line);
    
    // Lower position for a standard view
    const foundationTop = -8;
    foundation.position.y = foundationTop - platformHeight / 2; 
    this.scene.add(foundation);

    this.stack.push({
      mesh: foundation as any,
      material: foundationMatArray,
      width: platformSize,
      depth: platformSize,
      x: 0,
      z: 0,
      windowMaterials: []
    });
  }

  public startGame() {
    this.reset();
    this.gameState = 'PLAYING';
    this.addNextBlock();
  }

  public handleInteraction() {
    if (this.gameState === 'START') {
      this.startGame();
    } else if (this.gameState === 'PLAYING') {
      if (!this.isDropping) {
        this.isDropping = true;
        this.dropVelocity = 0;
        if (this.shadowMesh) this.shadowMesh.visible = false;
      }
    } else if (this.gameState === 'GAMEOVER') {
      this.startGame();
    }
  }

  private reset() {
    // Clear scene of all game objects
    this.stack.forEach(b => this.scene.remove(b.mesh));
    this.fallingBlocks.forEach(fb => this.scene.remove(fb.mesh));
    if (this.currentWire) this.scene.remove(this.currentWire);
    if (this.shadowMesh) this.shadowMesh.visible = false;
    
    this.flyingPeople.forEach(p => this.scene.remove(p.group));
    this.flyingPeople = [];

    if (this.leaves) {
      this.leaves.children.forEach(leaf => (leaf as any).visible = false);
    }
    if (this.windStreaks) this.windStreaks.visible = false;

    // Explicitly remove current block if it exists
    if (this.currentBlock) {
      this.scene.remove(this.currentBlock.mesh);
      this.currentBlock = null;
    }

    this.perfectStreak = 0;
    this.isExecPhaseActive = false;
    this.execPhaseRemainingMs = 0;
    if (this.onStreakUpdate) this.onStreakUpdate(0);
    if (this.onExecPhaseStateChange) this.onExecPhaseStateChange(false, 0);

    // Reset current state
    this.stack = [];
    this.fallingBlocks = [];
    this.score = 0;
    this.speed = ANIMATION_SPEED;
    this.direction = 'x';
    this.colorIndex = 0;
    this.moveOffset = 0;
    this.swingMoveOffset = 0;
    this.isDropping = false;
    this.weatherTransition = 0;
    this.windIntensity = 0;
    this.isSlipping = false;
    this.splashParticles.forEach(sp => this.scene.remove(sp.mesh));
    this.splashParticles = [];
    this.scene.background = this.initialSkyColor.clone();
    if (this.rainSystem) this.rainSystem.visible = false;
    if (this.windStreaks) this.windStreaks.visible = false;
    
    if (this.onScoreUpdate) this.onScoreUpdate(0);

    this.initBase();
    
    // Reset camera position immediately to avoid jumping
    this.camera.position.set(20, 20, 20);
    this.camera.lookAt(0, -5, 0);
  }

  private addNextBlock() {
    if (this.gameState !== 'PLAYING') return;

    const lastBlock = this.stack[this.stack.length - 1];
    this.colorIndex = (this.colorIndex + 1) % COLORS.length;
    this.direction = this.direction === 'x' ? 'z' : 'x';
    this.isDropping = false;

    const isExecFloor = this.isExecPhaseActive;

    const { group, windowMaterials } = this.createBlockMesh(
      INITIAL_BLOCK_SIZE, 
      BLOCK_HEIGHT, 
      INITIAL_BLOCK_SIZE, 
      COLORS[this.colorIndex],
      isExecFloor
    );

    // Hang block higher up
    // The first building block sits on top of platform at foundationTop
    const foundationTop = -8; 
    const targetCenterY = this.stack.length === 1 
      ? foundationTop + BLOCK_HEIGHT / 2 
      : lastBlock.mesh.position.y + BLOCK_HEIGHT;

    group.position.y = targetCenterY + 12; // Hang 12 units above the target spot

    if (this.direction === 'x') {
      group.position.x = lastBlock.x;
      group.position.z = lastBlock.z;
    } else {
      group.position.z = lastBlock.z;
      group.position.x = lastBlock.x;
    }

    this.scene.add(group);
    this.currentBlock = {
      mesh: group as any,
      material: (group.children.find(c => c instanceof THREE.Mesh) as THREE.Mesh).material as THREE.Material,
      width: INITIAL_BLOCK_SIZE,
      depth: INITIAL_BLOCK_SIZE,
      x: group.position.x,
      z: group.position.z,
      windowMaterials,
      isExecFloor
    };

    // Show and position shadow guide
    if (this.shadowMesh) {
      // Platform height is 2.8, so center to top is 1.4.
      // Building blocks height is 6, so center to top is 3.
      const topOffset = this.stack.length === 1 ? 1.4 : BLOCK_HEIGHT / 2;
      this.shadowMesh.position.y = lastBlock.mesh.position.y + topOffset + 0.01;
      this.shadowMesh.scale.set(1, 1, 1); // Reset scale
      this.shadowMesh.visible = true;
    }

    // Create wire
    const wireGeom = new THREE.CylinderGeometry(0.1, 0.1, 24, 8);
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
    this.currentWire = new THREE.Mesh(wireGeom, wireMat);
    this.scene.add(this.currentWire);
  }

  private placeBlock() {
    if (!this.currentBlock) return;
    
    if (this.currentWire) {
      this.scene.remove(this.currentWire);
      this.currentWire = null;
    }

    if (this.shadowMesh) this.shadowMesh.visible = false;

    const lastBlock = this.stack[this.stack.length - 1];
    const diff = this.direction === 'x' 
      ? this.currentBlock.mesh.position.x - lastBlock.x
      : this.currentBlock.mesh.position.z - lastBlock.z;

    const size = INITIAL_BLOCK_SIZE;
    const isFirstBuildingBlock = this.stack.length === 1;
    
    let overlap: number;
    let isPerfect = false;
    const perfectThreshold = INITIAL_BLOCK_SIZE * 0.1;

    if (isFirstBuildingBlock) {
      const platformSize = lastBlock.width;
      // Use mesh position because of tower sway
      const diffX = this.currentBlock.mesh.position.x - lastBlock.mesh.position.x;
      const diffZ = this.currentBlock.mesh.position.z - lastBlock.mesh.position.z;
      const currentDiff = Math.abs(diffX) + Math.abs(diffZ);
      
      // Foundation is wider, so we check if block touches ANY part of it.
      if (currentDiff < (platformSize / 2 + size / 2)) {
        overlap = size; // Success on foundation
        if (currentDiff < perfectThreshold) isPerfect = true;
      } else {
        overlap = 0;
      }
    } else {
      // Calculate diff relative to CURRENT swayed position
      const relDiff = this.direction === 'x' 
        ? this.currentBlock.mesh.position.x - lastBlock.mesh.position.x
        : this.currentBlock.mesh.position.z - lastBlock.mesh.position.z;
      
      overlap = size - Math.abs(relDiff);
      if (Math.abs(relDiff) < perfectThreshold) isPerfect = true;
    }
    
    // Check for "extreme ends" - if overlap is less than 30% of size, it falls off
    // except for the first building block landing on the foundation which just needs to touch.
    const minOverlap = isFirstBuildingBlock ? 0.1 : size * 0.3;

    if (overlap <= minOverlap) {
      this.fallOff();
      return;
    }

    const isExecFloor = this.currentBlock.isExecFloor || false;

    if (isPerfect) {
      if (this.onPerfect) this.onPerfect();
      // Snap to perfect position
      this.currentBlock.mesh.position.x = lastBlock.mesh.position.x;
      this.currentBlock.mesh.position.z = lastBlock.mesh.position.z;

      // Handle perfect placement streak metrics
      if (!this.isExecPhaseActive) {
        this.perfectStreak++;
        if (this.perfectStreak >= 5) {
          this.isExecPhaseActive = true;
          this.execPhaseRemainingMs = 10000;
          this.perfectStreak = 0;
          if (this.onExecPhaseStateChange) {
            this.onExecPhaseStateChange(true, 10000);
          }
        }
        if (this.onStreakUpdate) {
          this.onStreakUpdate(this.perfectStreak);
        }
      }
    } else {
      // Imperfect placement resets perfect streak
      if (!this.isExecPhaseActive) {
        this.perfectStreak = 0;
        if (this.onStreakUpdate) {
          this.onStreakUpdate(this.perfectStreak);
        }
      }
    }

    // Calculate un-swayed base coordinates for the block
    let baseSway = 0;
    if (this.score > 15) {
      baseSway = Math.sin(this.moveOffset * 0.6);
    }
    const towerIndex = this.stack.length; // The index this block will have
    const swayFactor = Math.max(0, towerIndex - 15) * 0.15;
    const currentDisplacement = baseSway * swayFactor;

    const newX = this.currentBlock.mesh.position.x - (this.direction === 'x' ? currentDisplacement : 0);
    const newZ = this.currentBlock.mesh.position.z - (this.direction === 'z' ? currentDisplacement : 0);

    this.currentBlock.x = newX;
    this.currentBlock.z = newZ;

    this.stack.push({
      mesh: this.currentBlock.mesh,
      material: this.currentBlock.material,
      width: size,
      depth: size,
      x: newX,
      z: newZ,
      windowMaterials: this.currentBlock.windowMaterials,
      isExecFloor
    });

    let populationIncrement = 144;
    if (isExecFloor) {
      populationIncrement = isPerfect ? 10 : 7;
      this.spawnExecutiveSparkles(this.currentBlock.mesh.position, isPerfect);
    }

    this.score++;
    this.shakeIntensity = isPerfect ? 0.26 : 0.187; // Increased intensity by 30%
    if (this.onScoreUpdate) this.onScoreUpdate(this.score, populationIncrement);
    this.speed += SPEED_INCREMENT;
    
    // Spawn people flying with umbrellas
    this.spawnFlyingPeople(this.currentBlock.mesh.position, COLORS[this.colorIndex], isPerfect ? 5 : 2);

    this.addNextBlock();
  }

  private fallOff() {
    if (!this.currentBlock) return;
    
    if (this.currentWire) this.scene.remove(this.currentWire);
    if (this.shadowMesh) this.shadowMesh.visible = false;

    // Add to falling blocks to animate the fall
    this.fallingBlocks.push({
      mesh: this.currentBlock.mesh,
      isTumbling: false,
      vx: 0,
      vz: 0,
      rvx: 0,
      rvy: 0,
      rvz: 0,
      hasLanded: false
    });
    this.currentBlock = null;

    // Trigger game over after a slight delay
    setTimeout(() => {
      this.gameOver();
    }, 800);
  }

  private gameOver() {
    this.gameState = 'GAMEOVER';
    if (this.shadowMesh) this.shadowMesh.visible = false;
    if (this.onGameOver) this.onGameOver(this.score);
  }

  private createUmbrellaPerson(color: string) {
    const group = new THREE.Group();

    // Body (minimal cylinder)
    const bodyGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.8, 6);
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#334155' });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    group.add(body);

    // Umbrella Taper (Cone)
    const umbrellaGeom = new THREE.ConeGeometry(1.2, 0.6, 8);
    const umbrellaMat = new THREE.MeshStandardMaterial({ 
      color: color,
      side: THREE.DoubleSide 
    });
    const umbrella = new THREE.Mesh(umbrellaGeom, umbrellaMat);
    umbrella.position.y = 1.0;
    group.add(umbrella);

    // Handle
    const handleGeom = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 4);
    const handleMat = new THREE.MeshStandardMaterial({ color: '#1e293b' });
    const handle = new THREE.Mesh(handleGeom, handleMat);
    handle.position.y = 0.5;
    group.add(handle);

    return group;
  }

  private spawnFlyingPeople(targetPos: THREE.Vector3, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const personGroup = this.createUmbrellaPerson(color);
      
      // Random starting point far away
      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.random() * 20;
      const startX = targetPos.x + Math.cos(angle) * distance;
      const startZ = targetPos.z + Math.sin(angle) * distance;
      const startY = targetPos.y + 10 + Math.random() * 10;

      const startPos = new THREE.Vector3(startX, startY, startZ);
      personGroup.position.copy(startPos);
      personGroup.lookAt(targetPos);
      
      // Rotate umbrella slightly to catch "wind"
      personGroup.rotation.x += 0.2;

      this.scene.add(personGroup);

      this.flyingPeople.push({
        group: personGroup,
        targetPos: targetPos.clone(),
        startPos: startPos,
        progress: 0,
        speed: (0.01 + Math.random() * 0.01) * 0.56 // Reduced by 30% then another 20% (0.7 * 0.8)
      });
    }
  }

  private initRain() {
    const rainCount = 1500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);
    const velocities = new Float32Array(rainCount);

    for (let i = 0; i < rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = Math.random() * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
      velocities[i] = 1.0 + Math.random() * 1.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));

    const material = new THREE.PointsMaterial({
      color: '#cbd5e1',
      size: 3,
      transparent: true,
      opacity: 0.85
    });

    this.rainSystem = new THREE.Points(geometry, material);
    this.rainSystem.visible = false;
    this.scene.add(this.rainSystem);
  }

  private updateRain() {
    if (!this.rainSystem || !this.rainSystem.visible) return;

    const positions = this.rainSystem.geometry.attributes.position.array as Float32Array;
    const velocities = this.rainSystem.geometry.attributes.velocity.array as Float32Array;
    const count = velocities.length;

    // Center rain around camera view
    const camY = this.camera.position.y;

    for (let i = 0; i < count; i++) {
      const v = velocities[i];
      positions[i * 3 + 1] -= v;      // Vertical fall
      positions[i * 3] -= v * 0.4;    // Diagonal X
      positions[i * 3 + 2] -= v * 0.2; // Diagonal Z

      // Reset particles if they fall too low relative to camera
      if (positions[i * 3 + 1] < camY - 40) {
        positions[i * 3 + 1] = camY + 40;
        // Randomize horizontally relative to camera, with an offset to account for diagonal entry
        positions[i * 3] = this.camera.position.x + (Math.random() - 0.5) * 100 + 20;
        positions[i * 3 + 2] = this.camera.position.z + (Math.random() - 0.5) * 100 + 10;
      }
    }

    this.rainSystem.geometry.attributes.position.needsUpdate = true;
    (this.rainSystem.material as THREE.PointsMaterial).opacity = 0.85 * this.weatherTransition;
  }

  private initWind() {
    // 1. Wind Streaks
    const streakCount = 40;
    const streakGeometry = new THREE.BufferGeometry();
    const streakPositions = new Float32Array(streakCount * 2 * 3); // 2 points per line
    
    for (let i = 0; i < streakCount; i++) {
      const x = (Math.random() - 0.5) * 100;
      const y = Math.random() * 80;
      const z = (Math.random() - 0.5) * 100;
      
      const idx = i * 6;
      streakPositions[idx] = x;
      streakPositions[idx + 1] = y;
      streakPositions[idx + 2] = z;
      
      // End point
      const length = 5 + Math.random() * 5;
      streakPositions[idx + 3] = x + this.windDirection.x * length;
      streakPositions[idx + 4] = y;
      streakPositions[idx + 5] = z + this.windDirection.z * length;
    }
    
    streakGeometry.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
    const streakMaterial = new THREE.LineBasicMaterial({
      color: '#cbd5e1',
      transparent: true,
      opacity: 0, // start invisible
      linewidth: 1
    });
    
    this.windStreaks = new THREE.LineSegments(streakGeometry, streakMaterial);
    this.scene.add(this.windStreaks);

    // 2. Flying Leaves
    this.leaves = new THREE.Group();
    const leafColors = ['#166534', '#15803d', '#713f12', '#a16207'];
    const leafCount = 30;
    
    for (let i = 0; i < leafCount; i++) {
      const geometry = new THREE.PlaneGeometry(0.4, 0.6);
      const material = new THREE.MeshStandardMaterial({
        color: leafColors[Math.floor(Math.random() * leafColors.length)],
        side: THREE.DoubleSide
      });
      const leaf = new THREE.Mesh(geometry, material);
      
      // Custom properties for animation
      (leaf as any).speed = 0.5 + Math.random() * 0.5;
      (leaf as any).rotSpeed = (Math.random() - 0.5) * 0.2;
      (leaf as any).offset = Math.random() * 100;
      
      leaf.position.set(
        (Math.random() - 0.5) * 100,
        Math.random() * 80,
        (Math.random() - 0.5) * 100
      );
      leaf.visible = false;
      this.leaves.add(leaf);
    }
    this.scene.add(this.leaves);
  }

  private updateWind() {
    if (!this.windStreaks || !this.leaves || this.windIntensity < 0.01) return;

    const camY = this.camera.position.y;
    const time = Date.now() * 0.001;
    
    // Update Wind Streaks
    const streakPos = this.windStreaks.geometry.attributes.position.array as Float32Array;
    const streakCount = streakPos.length / 6;
    const windSpeed = 1.5 + this.windIntensity * 2.0;

    for (let i = 0; i < streakCount; i++) {
      const idx = i * 6;
      // Move points along wind direction
      streakPos[idx] += windSpeed * this.windDirection.x;
      streakPos[idx + 2] += windSpeed * this.windDirection.z;
      streakPos[idx + 3] += windSpeed * this.windDirection.x;
      streakPos[idx + 5] += windSpeed * this.windDirection.z;

      // Reset streaks
      const centerX = streakPos[idx];
      const centerZ = streakPos[idx + 2];
      const distFromCam = Math.sqrt(Math.pow(centerX - this.camera.position.x, 2) + Math.pow(centerZ - this.camera.position.z, 2));
      
      if (distFromCam > 60 || Math.abs(streakPos[idx + 1] - camY) > 40) {
        // Respawn "upwind"
        const dist = 50 + Math.random() * 10;
        const x = this.camera.position.x - this.windDirection.x * dist + (Math.random() - 0.5) * 60;
        const z = this.camera.position.z - this.windDirection.z * dist + (Math.random() - 0.5) * 60;
        const y = camY + (Math.random() - 0.5) * 40;
        
        streakPos[idx] = x;
        streakPos[idx + 1] = y;
        streakPos[idx + 2] = z;
        
        const length = 5 + Math.random() * 5;
        streakPos[idx + 3] = x + this.windDirection.x * length;
        streakPos[idx + 4] = y;
        streakPos[idx + 5] = z + this.windDirection.z * length;
      }
    }
    this.windStreaks.geometry.attributes.position.needsUpdate = true;
    (this.windStreaks.material as THREE.LineBasicMaterial).opacity = this.windIntensity * 0.3 * (0.5 + Math.sin(time * 2) * 0.5);
    this.windStreaks.visible = true;

    // Update Leaves
    this.leaves.children.forEach((leaf: any) => {
      leaf.visible = true;
      leaf.position.x += windSpeed * leaf.speed * this.windDirection.x;
      leaf.position.z += windSpeed * leaf.speed * this.windDirection.z;
      leaf.position.y += Math.sin(time + leaf.offset) * 0.05; // Fluttering
      
      leaf.rotation.x += leaf.rotSpeed;
      leaf.rotation.y += leaf.rotSpeed;
      
      const distFromCam = Math.sqrt(Math.pow(leaf.position.x - this.camera.position.x, 2) + Math.pow(leaf.position.z - this.camera.position.z, 2));
      if (distFromCam > 60 || Math.abs(leaf.position.y - camY) > 40) {
         // Respawn upwind
         const dist = 50 + Math.random() * 10;
         leaf.position.x = this.camera.position.x - this.windDirection.x * dist + (Math.random() - 0.5) * 60;
         leaf.position.z = this.camera.position.z - this.windDirection.z * dist + (Math.random() - 0.5) * 60;
         leaf.position.y = camY + (Math.random() - 0.5) * 40;
      }
    });

    (this.leaves as any).children.forEach((l: any) => {
      l.material.opacity = this.windIntensity;
      l.material.transparent = true;
    });
  }

  private animate = () => {
    requestAnimationFrame(this.animate);

    const now = performance.now();
    const dt = now - this.lastTime;
    this.lastTime = now;

    // Tick down Executive Floors cooldown timer smoothly
    if (this.gameState === 'PLAYING' && this.isExecPhaseActive) {
      this.execPhaseRemainingMs -= dt;
      if (this.execPhaseRemainingMs <= 0) {
        this.execPhaseRemainingMs = 0;
        this.isExecPhaseActive = false;
        if (this.onExecPhaseStateChange) {
          this.onExecPhaseStateChange(false, 0);
        }
      } else {
        if (this.onExecTimerTick) {
          this.onExecTimerTick(this.execPhaseRemainingMs);
        }
      }
    }

    // Global sway clock (for tower/block sway) - speed up by 20% during weather transition
    // and apply wind resistance (slow down when moving against wind)
    const windComponent = this.direction === 'x' ? this.windDirection.x : this.windDirection.z;
    const moveCos = Math.cos(this.moveOffset);
    const isMovingAgainstWind = (moveCos * windComponent) < 0;
    const resistanceFactor = isMovingAgainstWind ? 0.75 : 1.0; // 25% slower when pushing against wind
    const windResistance = 1 + this.windIntensity * (resistanceFactor - 1);
    
    this.moveOffset += this.speed * (1 + this.weatherTransition * 0.2) * windResistance;

    // Swing clock (for rope block swing) - speed up by 10% in the rainy season/transition
    // and also apply wind resistance
    const swingCos = Math.cos(this.swingMoveOffset);
    const isSwingMovingAgainstWind = (swingCos * windComponent) < 0;
    const swingResistanceFactor = isSwingMovingAgainstWind ? 0.75 : 1.0;
    const swingWindResistance = 1 + this.windIntensity * (swingResistanceFactor - 1);
    const rainSwingModifier = 1 + this.weatherTransition * 0.1; // 10% faster during rain

    this.swingMoveOffset += this.speed * rainSwingModifier * swingWindResistance;

    // Calculate tower sway if height > 15
    let baseSway = 0;
    if (this.score > 15) {
      // Use a fixed frequency and simple sine wave
      baseSway = Math.sin(this.moveOffset * 0.6);
    }

    // Apply sway to the stack
    this.stack.forEach((block, i) => {
      if (i === 0) return; // Don't sway foundation
      
      // Stable sway factor: for each block i, the displacement factor is constant 
      // regardless of how many blocks are added above it.
      const swayFactor = Math.max(0, i - 15) * 0.15;
      const currentDisplacement = baseSway * swayFactor;

      // Add directional "lean" from wind
      const windLean = this.windIntensity * Math.min(i, 20) * 0.05;

      if (this.direction === 'x') {
        block.mesh.position.x = block.x + currentDisplacement + windLean * this.windDirection.x;
        block.mesh.position.z = block.z + windLean * this.windDirection.z; 
      } else {
        block.mesh.position.z = block.z + currentDisplacement + windLean * this.windDirection.z;
        block.mesh.position.x = block.x + windLean * this.windDirection.x;
      }
    });

    // Handle weather transitions
    const isWindyPhase = this.score >= 45 && this.score < 75;
    const isRainyPhase = this.score >= 10 && this.score < 35;

    // Wind transition logic
    const targetWindIntensity = isWindyPhase ? 1.0 : 0;
    if (Math.abs(this.windIntensity - targetWindIntensity) > 0.001) {
      this.windIntensity += (targetWindIntensity - this.windIntensity) * 0.005;
    }

    // Rain/Sky transition logic
    const targetTransition = isRainyPhase ? 1 : 0;
    if (Math.abs(this.weatherTransition - targetTransition) > 0.001) {
      this.weatherTransition += (targetTransition - this.weatherTransition) * 0.005;
      
      if (this.onWeatherUpdate) {
        // Combine transitions: wind starts UI color change logic earlier if needed
        // but traditionally we only darken for rain.
        this.onWeatherUpdate(this.weatherTransition);
      }
      
      const skyBase = this.initialSkyColor.clone().lerp(this.cloudySkyColor, this.weatherTransition);
      this.scene.background = skyBase;
      
      if (this.rainSystem) {
        this.rainSystem.visible = this.weatherTransition > 0.01;
      }
    }

    if (this.windIntensity > 0.01) {
      this.updateWind();
    }

    // Update window emissions based on weather transition
    const emissiveIntensity = this.weatherTransition * 1.5; 
    const currentEmissive = new THREE.Color(0x000000).lerp(this.litWindowColor, this.weatherTransition);
    
    // Also slightly boost the actual block visibility by adding subtle emission of its own color
    // This prevents blocks from looking like silhouettes against the dark sky
    this.stack.forEach(block => {
      block.windowMaterials.forEach(mat => {
        mat.emissive.copy(currentEmissive);
        mat.emissiveIntensity = emissiveIntensity;
      });

      // Subtle vibrancy boost for the block body
      const vibrancy = this.weatherTransition * 0.2;
      const mats = Array.isArray(block.material) ? block.material : [block.material];
      mats.forEach(mat => {
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.emissive.copy(mat.color).multiplyScalar(vibrancy);
        }
      });
    });
    
    if (this.currentBlock) {
      this.currentBlock.windowMaterials.forEach(mat => {
        mat.emissive.copy(currentEmissive);
        mat.emissiveIntensity = emissiveIntensity;
      });

      const vibrancy = this.weatherTransition * 0.2;
      const mats = Array.isArray(this.currentBlock.material) ? this.currentBlock.material : [this.currentBlock.material];
      mats.forEach(mat => {
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.emissive.copy(mat.color).multiplyScalar(vibrancy);
        }
      });
    }

    // Lightning effect
    if (isRainyPhase && this.weatherTransition > 0.8) {
      // Periodic lightning strike
      if (Math.random() < 0.004) {
        this.lightningIntensity = 1.2; // Slightly over-brighten
        this.lightningSubFlash = true;
        this.shakeIntensity = Math.max(this.shakeIntensity, 0.45); // Stronger thunder shake
      }
    }

    if (this.lightningIntensity > 0) {
      // Create a "pulse" or "double flash" effect
      if (this.lightningSubFlash && this.lightningIntensity < 0.6) {
        this.lightningIntensity = 0.9;
        this.lightningSubFlash = false;
      }

      this.lightningIntensity *= 0.88; // Sharper decay for more impact
      if (this.lightningIntensity < 0.01) this.lightningIntensity = 0;
      
      // Flash the sky
      const skyBase = this.initialSkyColor.clone().lerp(this.cloudySkyColor, this.weatherTransition);
      // Use higher intensity for the lerp to "wash out" the sky
      const flashInfluence = Math.min(this.lightningIntensity, 1.0);
      const flashColor = skyBase.clone().lerp(this.lightningColor, flashInfluence);
      this.scene.background = flashColor;

      // Boost light intensity significantly
      if (this.ambientLight) this.ambientLight.intensity = 0.7 + this.lightningIntensity * 3.0;
      if (this.directionalLight) this.directionalLight.intensity = 0.8 + this.lightningIntensity * 4.5;
    } else if (this.ambientLight && this.directionalLight) {
      // Normal intensity
      this.ambientLight.intensity = 0.7;
      this.directionalLight.intensity = 0.8;
    }

    if (this.weatherTransition > 0.01) {
      this.updateRain();
    }

    if (this.gameState === 'PLAYING' && this.currentBlock) {
      const lastBlock = this.stack[this.stack.length - 1];
      const foundationTop = -8;
      const targetCenterY = this.stack.length === 1 
        ? foundationTop + BLOCK_HEIGHT / 2 
        : lastBlock.mesh.position.y + BLOCK_HEIGHT;

      if (!this.isDropping) {
        // Swing logic with wind impact
        const windComponent = this.direction === 'x' ? this.windDirection.x : this.windDirection.z;
        const windBias = windComponent * this.windIntensity * 3;
        // Surge effect: increase displacement when swinging in the direction of the wind
        const windSurge = Math.max(0, Math.sin(this.swingMoveOffset) * windComponent) * this.windIntensity * 5;
        
        const swingOffset = Math.sin(this.swingMoveOffset) * 9 + windBias + windSurge;
        
        // Position relative to current swayed top of tower
        if (this.direction === 'x') {
          this.currentBlock.mesh.position.x = lastBlock.mesh.position.x + swingOffset;
          this.currentBlock.mesh.position.z = lastBlock.mesh.position.z;
        } else {
          this.currentBlock.mesh.position.z = lastBlock.mesh.position.z + swingOffset;
          this.currentBlock.mesh.position.x = lastBlock.mesh.position.x;
        }

        // Update shadow position to match swinging block
        if (this.shadowMesh) {
          this.shadowMesh.position.x = this.currentBlock.mesh.position.x;
          this.shadowMesh.position.z = this.currentBlock.mesh.position.z;
          // Sway shadow y position slightly if needed or keep static on top of block
        }
      } else if (!this.isSlipping) {
        // Drop logic
        this.dropVelocity += 0.25;
        this.currentBlock.mesh.position.y -= this.dropVelocity;

        if (this.currentBlock.mesh.position.y <= targetCenterY) {
          this.currentBlock.mesh.position.y = targetCenterY;
          
          // Slippery physics in rainy weather
          const isRainyPhase = this.score >= 10 && this.score < 35;
          if (isRainyPhase && this.weatherTransition > 0.01 && this.stack.length > 0) {
            const lastBlock = this.stack[this.stack.length - 1];
            const relDiff = this.direction === 'x'
              ? this.currentBlock.mesh.position.x - lastBlock.mesh.position.x
              : this.currentBlock.mesh.position.z - lastBlock.mesh.position.z;
            
            const perfectThreshold = INITIAL_BLOCK_SIZE * 0.1;
            const isPerfect = Math.abs(relDiff) < perfectThreshold;

            if (!isPerfect) {
              const willSlip = Math.random() < 0.40;
              if (willSlip) {
                this.isSlipping = true;
                this.slipProgress = 0;
                this.slipStartX = this.currentBlock.mesh.position.x;
                this.slipStartZ = this.currentBlock.mesh.position.z;

                const slipSign = relDiff >= 0 ? 1 : -1;
                const baseSlip = 0.4 + Math.random() * 0.5; // Slip distance
                const scaleSlip = Math.abs(relDiff) * 0.2;
                const totalSlip = (baseSlip + scaleSlip) * slipSign * this.weatherTransition;

                if (this.direction === 'x') {
                  this.slipTargetX = this.slipStartX + totalSlip;
                  this.slipTargetZ = this.slipStartZ;
                } else {
                  this.slipTargetX = this.slipStartX;
                  this.slipTargetZ = this.slipStartZ + totalSlip;
                }

                if (this.currentWire) {
                  this.scene.remove(this.currentWire);
                  this.currentWire = null;
                }
                if (this.shadowMesh) this.shadowMesh.visible = false;

                this.spawnSlipperySplash(this.currentBlock.mesh.position, this.direction === 'x' ? totalSlip : 0, this.direction === 'z' ? totalSlip : 0);
                if (this.onSlip) this.onSlip();
              } else {
                this.placeBlock();
              }
            } else {
              this.placeBlock();
            }
          } else {
            this.placeBlock();
          }
        }
      } else {
        // Slipping/sliding animation behavior
        this.slipProgress += 0.08;
        if (this.slipProgress >= 1) {
          this.slipProgress = 1;
          this.currentBlock.mesh.position.x = this.slipTargetX;
          this.currentBlock.mesh.position.z = this.slipTargetZ;
          this.isSlipping = false;
          this.placeBlock();
        } else {
          const t = this.slipProgress;
          const easeOut = t * (2 - t);
          this.currentBlock.mesh.position.x = THREE.MathUtils.lerp(this.slipStartX, this.slipTargetX, easeOut);
          this.currentBlock.mesh.position.z = THREE.MathUtils.lerp(this.slipStartZ, this.slipTargetZ, easeOut);
          
          if (Math.random() < 0.4) {
            this.spawnSplashDrip(this.currentBlock.mesh.position);
          }
        }
      }

      // Update wire (Cylinder Mesh)
      if (this.currentWire) {
        this.currentWire.position.x = this.currentBlock.mesh.position.x;
        this.currentWire.position.z = this.currentBlock.mesh.position.z;
        // Position cylinder center so it starts from the block top and goes up
        this.currentWire.position.y = this.currentBlock.mesh.position.y + BLOCK_HEIGHT / 2 + 12;
      }
    }

    // Camera follow - smoothly track tower height and horizontal sway to keep the stack centered
    if (this.stack.length > 0) {
      const topBlock = this.stack[this.stack.length - 1];
      const topPos = topBlock.mesh.position;
      
      // Calculate target camera positions to maintain a centered view of the tower top
      // targetY provides enough height to look down on the stack
      const targetY = topPos.y + 20; 
      const targetX = this.baseCameraX + topPos.x;
      const targetZ = this.baseCameraZ + topPos.z;
      
      // Smoothing factor for camera movement - reduced for a more "cushioned" feel
      const lerp = 0.03;
      
      // Add a subtle, high-frequency "vibrance" shake to the tracking itself
      // this simulates wind or mechanical jitter at height
      const trackingTime = Date.now() * 0.005;
      const vibrance = Math.sin(trackingTime * 2) * 0.026;
      
      this.camera.position.x += (targetX + vibrance - this.camera.position.x) * lerp;
      this.camera.position.y += (targetY - this.camera.position.y) * lerp;
      this.camera.position.z += (targetZ + vibrance - this.camera.position.z) * lerp;

      let lookAtX = topPos.x + vibrance * 0.5;
      let lookAtZ = topPos.z + vibrance * 0.5;

      // Apply impact camera shake if any
      if (this.shakeIntensity > 0.001) {
        const time = Date.now() * 0.05;
        const offset = Math.sin(time) * this.shakeIntensity;
        
        this.camera.position.x += offset;
        this.camera.position.z += offset;
        // Shift look-at point as well to keep the shake purely translational
        lookAtX += offset;
        lookAtZ += offset;
        
        this.shakeIntensity *= 0.96;
      } else {
        this.shakeIntensity = 0;
      }

      // Maintain consistent viewing angle while moving (diff 25 is our base vertical offset)
      const lookAtY = this.camera.position.y - 25;
      this.camera.lookAt(lookAtX, lookAtY, lookAtZ);
    }

    // Animate falling blocks
    const foundationTop = -8;
    const landingY = foundationTop + BLOCK_HEIGHT / 2;

    for (let i = this.fallingBlocks.length - 1; i >= 0; i--) {
      const fb = this.fallingBlocks[i];
      const mesh = fb.mesh;
      
      // Gravity
      mesh.position.y -= 0.4;

      // Check for landing on foundation
      if (mesh.position.y <= landingY) {
        const foundation = this.stack[0];
        const halfSize = foundation.width / 2;
        
        // If block is within foundation bounds, it stops falling
        if (Math.abs(mesh.position.x) < halfSize && Math.abs(mesh.position.z) < halfSize) {
          if (!fb.hasLanded) {
            this.shakeIntensity = 0.078;
            fb.hasLanded = true;
          }
          mesh.position.y = landingY;
          // Stop tumbling and horizontal movement
          fb.isTumbling = false;
          fb.vx = 0;
          fb.vz = 0;
          mesh.rotation.set(0, 0, 0); // Straighten it out on the floor
          continue; // Skip the rest of physics for this block
        }
      }

      // Check for collision with tower if not already tumbling or on ground
      if (!fb.isTumbling) {
        for (const stackBlock of this.stack) {
          const dy = Math.abs(mesh.position.y - stackBlock.mesh.position.y);
          if (dy < BLOCK_HEIGHT) {
            const dx = mesh.position.x - stackBlock.mesh.position.x;
            const dz = mesh.position.z - stackBlock.mesh.position.z;
            
            const threshold = INITIAL_BLOCK_SIZE;
            if (Math.abs(dx) < threshold && Math.abs(dz) < threshold) {
              fb.isTumbling = true;
              
              // Realistic deflection: velocity away from center of impact
              fb.vx = dx * 0.09;
              fb.vz = dz * 0.09;
              
              // "Realistic turn": tilt based on which side was hit
              fb.rvx = dz * 0.035;
              fb.rvz = -dx * 0.035;
              fb.rvy = (Math.random() - 0.5) * 0.014;
              break;
            }
          }
        }
      }

      // Physics if tumbling (Realistic turn and fall)
      if (fb.isTumbling) {
        mesh.position.x += fb.vx;
        mesh.position.z += fb.vz;
        mesh.rotation.x += fb.rvx;
        mesh.rotation.y += fb.rvy;
        mesh.rotation.z += fb.rvz;
        
        // Slightly damp the rotation for realism
        fb.rvx *= 0.99;
        fb.rvz *= 0.99;
      }

      if (mesh.position.y < -40) {
        this.scene.remove(mesh);
        this.fallingBlocks.splice(i, 1);
      }
    }

    // Animate flying people
    for (let i = this.flyingPeople.length - 1; i >= 0; i--) {
      const p = this.flyingPeople[i];
      p.progress += p.speed;

      // Cubic easing for a natural "glide"
      const t = p.progress;
      const easedT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      p.group.position.lerpVectors(p.startPos, p.targetPos, easedT);
      
      // Slight swaying effect while flying
      p.group.rotation.z = Math.sin(Date.now() * 0.005 + i) * 0.1;
      p.group.rotation.x = Math.sin(Date.now() * 0.003 + i) * 0.1;

      if (p.progress >= 1) {
        this.scene.remove(p.group);
        this.flyingPeople.splice(i, 1);
      }
    }

    // Animate splash particles
    for (let i = this.splashParticles.length - 1; i >= 0; i--) {
      const sp = this.splashParticles[i];
      sp.mesh.position.x += sp.vx;
      sp.mesh.position.y += sp.vy;
      sp.mesh.position.z += sp.vz;
      
      // Gravity
      sp.vy -= 0.012;
      
      sp.life -= 0.035;
      sp.mesh.scale.setScalar(sp.life);
      
      if (sp.mesh.material instanceof THREE.Material) {
        sp.mesh.material.opacity = sp.life * 0.82;
      }

      if (sp.life <= 0) {
        this.scene.remove(sp.mesh);
        sp.mesh.geometry.dispose();
        this.splashParticles.splice(i, 1);
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  private handleResize = () => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const aspect = width / height;
    const d = CAMERA_OFFSET;

    // Responsive orthographic camera
    if (aspect < 1) {
      // Portrait mode: ensure we always see the same width
      this.camera.left = -d;
      this.camera.right = d;
      this.camera.top = d / aspect;
      this.camera.bottom = -d / aspect;
    } else {
      // Landscape mode: ensure we always see the same height
      this.camera.left = -d * aspect;
      this.camera.right = d * aspect;
      this.camera.top = d;
      this.camera.bottom = -d;
    }

    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private spawnSlipperySplash(pos: THREE.Vector3, slipX: number, slipZ: number) {
    const particleCount = 15;
    const geom = new THREE.SphereGeometry(0.12, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: '#93c5fd', // Light Blue
      transparent: true,
      opacity: 0.8
    });

    for (let i = 0; i < particleCount; i++) {
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(pos);
      mesh.position.y -= BLOCK_HEIGHT / 2; // Bottom of particle block
      
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.05 + Math.random() * 0.15;
      const vx = Math.cos(angle) * speed + slipX * 0.15;
      const vz = Math.sin(angle) * speed + slipZ * 0.15;
      const vy = 0.08 + Math.random() * 0.15;
      
      this.scene.add(mesh);
      this.splashParticles.push({
        mesh,
        vx,
        vy,
        vz,
        life: 1.0
      });
    }
  }

  private spawnExecutiveSparkles(pos: THREE.Vector3, isPerfect: boolean) {
    const particleCount = isPerfect ? 25 : 12;
    const geom = new THREE.SphereGeometry(isPerfect ? 0.18 : 0.12, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: '#fbbf24', // Yellow/Gold
      transparent: true,
      opacity: 0.9
    });

    for (let i = 0; i < particleCount; i++) {
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(pos);
      mesh.position.x += (Math.random() - 0.5) * INITIAL_BLOCK_SIZE;
      mesh.position.z += (Math.random() - 0.5) * INITIAL_BLOCK_SIZE;
      mesh.position.y += (Math.random() - 0.5) * BLOCK_HEIGHT;

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.08 + Math.random() * 0.12;
      const vx = Math.cos(angle) * speed;
      const vz = Math.sin(angle) * speed;
      const vy = 0.15 + Math.random() * 0.2; // Upward burst

      this.scene.add(mesh);
      this.splashParticles.push({
        mesh,
        vx,
        vy,
        vz,
        life: 1.0
      });
    }
  }

  private spawnSplashDrip(pos: THREE.Vector3) {
    const geom = new THREE.SphereGeometry(0.08, 3, 3);
    const mat = new THREE.MeshBasicMaterial({
      color: '#60a5fa',
      transparent: true,
      opacity: 0.6
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(pos);
    mesh.position.y -= BLOCK_HEIGHT / 2;
    mesh.position.x += (Math.random() - 0.5) * INITIAL_BLOCK_SIZE;
    mesh.position.z += (Math.random() - 0.5) * INITIAL_BLOCK_SIZE;

    const vx = (Math.random() - 0.5) * 0.03;
    const vz = (Math.random() - 0.5) * 0.03;
    const vy = 0.03 + Math.random() * 0.05;

    this.scene.add(mesh);
    this.splashParticles.push({
      mesh,
      vx,
      vy,
      vz,
      life: 0.6
    });
  }

  public dispose() {
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
