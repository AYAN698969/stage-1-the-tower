/** Renderer, scene, lights, sky, quality tiers. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const QUALITY = {
  low: { pixelRatio: 0.75, shadows: false },
  med: { pixelRatio: 1.0, shadows: false },
  high: { pixelRatio: 1.5, shadows: true },
};

export class Engine {
  /**
   * @param {HTMLElement} container
   * @param {string} qualityName 'low' | 'med' | 'high'
   */
  constructor(container, qualityName = 'med') {
    this.container = container;
    this.qualityName = QUALITY[qualityName] ? qualityName : 'med';
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9cc3e5);
    this.scene.fog = new THREE.Fog(0xa8c6e0, 55, 160);
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.08, 400);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.id = 'game-canvas';
    container.appendChild(this.renderer.domElement);
    this.sun = new THREE.DirectionalLight(0xfff2dd, 2.8);
    this.sun.castShadow = false;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5f, 0.9);
    this.scene.add(hemi);
    // Soft PBR ambience without an HDRI download.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.setQuality(this.qualityName);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Sun from elevation/azimuth in degrees. */
  setSun(elevationDeg, azimuthDeg) {
    const el = (elevationDeg * Math.PI) / 180;
    const az = (azimuthDeg * Math.PI) / 180;
    const d = 90;
    this.sun.position.set(Math.cos(el) * Math.sin(az) * d, Math.sin(el) * d, Math.cos(el) * Math.cos(az) * d);
    this.sun.target.position.set(0, 8, 0);
    this.sun.target.updateMatrixWorld();
  }

  setQuality(name) {
    if (!QUALITY[name]) return;
    this.qualityName = name;
    const q = QUALITY[name];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (q.shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1024, 1024);
      const c = this.sun.shadow.camera;
      c.left = -30; c.right = 30; c.top = 30; c.bottom = -30; c.near = 10; c.far = 220;
      this.sun.shadow.bias = -0.0005;
    } else {
      this.sun.castShadow = false;
    }
    this.resize();
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  /** @param {Function} loop */
  start(loop) { this.renderer.setAnimationLoop(loop); }

  getStats() {
    const i = this.renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures };
  }

  dispose() { this.renderer.setAnimationLoop(null); this.renderer.dispose(); }
}
