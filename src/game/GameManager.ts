import * as THREE from 'three';
import { BLOCK_HEIGHT, INITIAL_BLOCK_SIZE, COLORS, ANIMATION_SPEED, SPEED_INCREMENT, CAMERA_OFFSET } from './constants';

export type GameState = 'START' | 'PLAYING' | 'GAMEOVER';

interface Block {
  mesh: THREE.Mesh;
  width: number;
  depth: number;
  x: number;
  z: number;
}

interface FlyingPerson {
  group: THREE.Group;
  targetPos: THREE.Vector3;
  startPos: THREE.Vector3;
  progress: number;
  speed: number;
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
  private weatherTransition: number = 0;
  private lightningIntensity: number = 0;
  private ambientLight: THREE.AmbientLight | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;
  private initialSkyColor = new THREE.Color('#f0f2f5');
  private cloudySkyColor = new THREE.Color('#1e293b'); // Slate-800 for a darker storm look
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
  private colorIndex: number = 0;

  private onScoreUpdate?: (score: number) => void;
  private onGameOver?: (score: number) => void;
  private onPerfect?: () => void;
  private onWeatherUpdate?: (transition: number) => void;

  constructor(
    container: HTMLElement, 
    onScoreUpdate?: (score: number) => void, 
    onGameOver?: (score: number) => void,
    onPerfect?: () => void,
    onWeatherUpdate?: (transition: number) => void
  ) {
    this.container = container;
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.onPerfect = onPerfect;
    this.onWeatherUpdate = onWeatherUpdate;

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

  private createBlockMesh(width: number, height: number, depth: number, color: string) {
    const group = new THREE.Group();
    
    // Main block
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({ 
      color: color,
      roughness: 0.2,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    // Add windows like in the image
    const windowColor = '#1f2937'; // Dark windows
    const windowMaterial = new THREE.MeshStandardMaterial({ color: windowColor });
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

    return { group, mesh, line, geometry, material };
  }

  private initBase() {
    // 1. Create a foundation platform (wider and thinner)
    const platformSize = INITIAL_BLOCK_SIZE * 3.5;
    const platformHeight = 2.8; // Reduced by 30% (from 4)
    const foundationGeom = new THREE.BoxGeometry(platformSize, platformHeight, platformSize);
    const foundationMat = new THREE.MeshStandardMaterial({ 
      color: '#1e293b', // Even deeper slate
      roughness: 1,
      metalness: 0 
    });
    const foundation = new THREE.Mesh(foundationGeom, foundationMat);
    
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
      width: platformSize,
      depth: platformSize,
      x: 0,
      z: 0
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

    // Explicitly remove current block if it exists
    if (this.currentBlock) {
      this.scene.remove(this.currentBlock.mesh);
      this.currentBlock = null;
    }

    // Reset current state
    this.stack = [];
    this.fallingBlocks = [];
    this.score = 0;
    this.speed = ANIMATION_SPEED;
    this.direction = 'x';
    this.colorIndex = 0;
    this.moveOffset = 0;
    this.isDropping = false;
    this.weatherTransition = 0;
    this.scene.background = this.initialSkyColor.clone();
    if (this.rainSystem) this.rainSystem.visible = false;
    
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

    const { group } = this.createBlockMesh(INITIAL_BLOCK_SIZE, BLOCK_HEIGHT, INITIAL_BLOCK_SIZE, COLORS[this.colorIndex]);

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
      width: INITIAL_BLOCK_SIZE,
      depth: INITIAL_BLOCK_SIZE,
      x: group.position.x,
      z: group.position.z
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

    if (isPerfect) {
      if (this.onPerfect) this.onPerfect();
      // Snap to perfect position
      this.currentBlock.mesh.position.x = lastBlock.mesh.position.x;
      this.currentBlock.mesh.position.z = lastBlock.mesh.position.z;
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
      width: size,
      depth: size,
      x: newX,
      z: newZ
    });

    this.score++;
    this.shakeIntensity = isPerfect ? 0.26 : 0.187; // Increased intensity by 30%
    if (this.onScoreUpdate) this.onScoreUpdate(this.score);
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
      size: 0.45,
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

  private animate = () => {
    requestAnimationFrame(this.animate);

    // Global sway clock - speed up by 20% during weather transition
    this.moveOffset += this.speed * (1 + this.weatherTransition * 0.2);

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

      if (this.direction === 'x') {
        block.mesh.position.x = block.x + currentDisplacement;
        block.mesh.position.z = block.z; // Lock other axis
      } else {
        block.mesh.position.z = block.z + currentDisplacement;
        block.mesh.position.x = block.x;
      }
    });

    // Handle weather transitions
    const isRainyPhase = this.score >= 15 && this.score < 40;
    const targetTransition = isRainyPhase ? 1 : 0;

    if (Math.abs(this.weatherTransition - targetTransition) > 0.001) {
      this.weatherTransition += (targetTransition - this.weatherTransition) * 0.005;
      
      if (this.onWeatherUpdate) this.onWeatherUpdate(this.weatherTransition);
      
      const skyBase = this.initialSkyColor.clone().lerp(this.cloudySkyColor, this.weatherTransition);
      this.scene.background = skyBase;
      
      if (this.rainSystem) {
        this.rainSystem.visible = this.weatherTransition > 0.01;
      }
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
        // Swing logic
        const swingOffset = Math.sin(this.moveOffset) * 9;
        
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
      } else {
        // Drop logic
        this.dropVelocity += 0.25;
        this.currentBlock.mesh.position.y -= this.dropVelocity;

        if (this.currentBlock.mesh.position.y <= targetCenterY) {
          this.currentBlock.mesh.position.y = targetCenterY;
          this.placeBlock();
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

  public dispose() {
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
