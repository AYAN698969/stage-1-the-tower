/** Loads GLB models from assets/manifest.json (meshopt decoder, shared cache). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/**
 * Wrap a model in a group, scale it uniformly to fit inside `size` [w,h,d],
 * centre it on X/Z and put its bottom at y = 0. Returns the wrapper group.
 * @param {THREE.Object3D} obj
 * @param {number[]} size
 */
export function normalizeModel(obj, size) {
  const g = new THREE.Group();
  // Make sure world matrices are current before measuring (a freshly
  // cloned skinned mesh can otherwise report a stale/wrong box).
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const s = new THREE.Vector3();
  box.getSize(s);
  if (s.x > 0 && s.y > 0 && s.z > 0) {
    const k = Math.min(size[0] / s.x, size[1] / s.y, size[2] / s.z);
    obj.scale.setScalar(k);
  }
  const b2 = new THREE.Box3().setFromObject(obj);
  const c = new THREE.Vector3();
  b2.getCenter(c);
  obj.position.set(-c.x, -b2.min.y, -c.z);
  g.add(obj);
  g.userData.baseY = 0;
  return g;
}

/** Find an animation clip by a substring of its name (case-insensitive). */
export function findClip(clips, ...names) {
  for (const n of names) {
    const c = clips.find((cl) => cl.name.toLowerCase().includes(n.toLowerCase()));
    if (c) return c;
  }
  return clips[0] || null;
}

export class AssetManager {
  constructor() {
    this.loader = new GLTFLoader();
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.cache = new Map(); // name -> { scene, clips }
    this.manifest = null;
    this.loaded = 0;
    this.total = 0;
  }

  async loadManifest() {
    const r = await fetch('assets/manifest.json');
    if (!r.ok) throw new Error('manifest.json missing');
    this.manifest = await r.json();
    this.total = Object.keys(this.manifest.models).length;
    return this.manifest;
  }

  /** Load every model in the manifest. Calls onProgress(done, total, name). */
  async loadAll(onProgress) {
    const entries = Object.entries(this.manifest.models);
    for (const [name, info] of entries) {
      try {
        const gltf = await this.loader.loadAsync(info.file);
        gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
        this.cache.set(name, { scene: gltf.scene, clips: gltf.animations || [] });
      } catch (e) {
        console.warn('[assets] failed to load', name, e);
        this.cache.set(name, null);
      }
      this.loaded++;
      onProgress?.(this.loaded, this.total, name);
    }
  }

  has(name) { return this.cache.has(name) && this.cache.get(name) !== null; }

  /** Fresh clone (skinned meshes are cloned properly). Returns null if missing.
   * NOTE: only for NON-skinned models (furniture/props). Skinned characters
   * must use loadFresh() instead — SkeletonUtils.clone breaks these models
   * (their mesh nodes carry a -90° X rotation + 100x scale, and the clone
   * comes out 100x too big and lying flat). */
  clone(name) {
    const entry = this.cache.get(name);
    if (!entry) return null;
    return cloneSkinned(entry.scene);
  }

  /** Load a model FRESH from its file (independent scene + skeleton).
   * Use for characters (skinned meshes) — each instance gets its own
   * skeleton so animations don't interfere. The browser HTTP cache makes
   * the re-fetch cheap. Returns { scene, clips } or null. */
  async loadFresh(name) {
    const info = this.manifest?.models?.[name];
    if (!info) return null;
    try {
      const gltf = await this.loader.loadAsync(info.file);
      gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      return { scene: gltf.scene, clips: gltf.animations || [] };
    } catch (e) {
      console.warn('[assets] failed to load fresh', name, e);
      return null;
    }
  }

  clips(name) {
    const entry = this.cache.get(name);
    return entry ? entry.clips : [];
  }
}
