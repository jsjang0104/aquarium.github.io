import * as THREE from 'three';

const HOLD_MS = 450;
const MAX_BUBBLES = 96;
const clampPoint = (point) =>
  point.set(
    THREE.MathUtils.clamp(point.x, -9, 9),
    THREE.MathUtils.clamp(point.y, -2.7, 3.3),
    THREE.MathUtils.clamp(point.z, -3, 3.4),
  );

/** Gesture arbitration, temporary fish interests and bounded play effects. */
export class TankPlay {
  constructor(aquarium, { onActivity = () => {}, onStatus = () => {} } = {}) {
    this.aquarium = aquarium;
    this.canvas = aquarium.renderer.domElement;
    this.onActivity = onActivity;
    this.onStatus = onStatus;
    this.time = 0;
    this.mode = 'play';
    this.pointers = new Set();
    this.ripples = [];
    this.particles = [];
    this.listeners = [];
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -3.1);
    const positions = new Float32Array(MAX_BUBBLES * 3);
    this.bubbleGeometry = new THREE.BufferGeometry();
    this.bubbleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.bubbleGeometry.setDrawRange(0, 0);
    this.bubbleMaterial = new THREE.PointsMaterial({
      map: aquarium.bubbles.material.map,
      size: 0.26,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.bubbles = new THREE.Points(this.bubbleGeometry, this.bubbleMaterial);
    this.bubbles.frustumCulled = false;
    aquarium.scene.add(this.bubbles);
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute(
      'aria-label',
      '수조 놀이: 톡 누르기, 움직여 따라오기, 길게 눌러 기포 만들기. T 톡톡, B 기포.',
    );
    this.listen(this.canvas, 'pointerdown', (event) => this.pointerDown(event));
    this.listen(this.canvas, 'pointermove', (event) => this.pointerMove(event));
    this.listen(this.canvas, 'pointerup', (event) => this.pointerUp(event));
    this.listen(this.canvas, 'pointercancel', () => this.clear());
    this.listen(this.canvas, 'lostpointercapture', (event) => {
      this.pointers.delete(event.pointerId);
      if (this.gesture?.id === event.pointerId) {
        this.followTarget = null;
        this.cancelGesture();
      }
      if (!this.pointers.size) this.multiTouch = false;
    });
    this.listen(this.canvas, 'pointerleave', () => {
      if (!this.gesture) {
        this.followTarget = null;
        this.status();
      }
    });
    this.listen(window, 'blur', () => this.clear());
    this.listen(document, 'visibilitychange', () => {
      if (document.hidden) this.clear();
    });
    this.setMode('play');
  }
  listen(target, type, handler) {
    target.addEventListener(type, handler);
    this.listeners.push(() => target.removeEventListener(type, handler));
  }
  status(message) {
    this.onStatus(
      message ??
        (this.aquarium.dance?.active
          ? '다 같이 춤추는 중 · 둘러보기로 무대를 감상해요'
          : this.mode === 'view'
            ? '둘러보기 · 드래그로 시점 회전'
            : '톡 누르기 · 움직여 따라오기 · 길게 눌러 기포'),
    );
  }
  setMode(mode) {
    this.clear();
    this.mode = mode;
    this.aquarium.controls.enableRotate = mode === 'view';
    this.canvas.style.cursor = mode === 'view' ? 'grab' : 'crosshair';
    this.status();
  }
  pointAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((clientY - rect.top) / rect.height) * 2,
    );
    this.aquarium.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(pointer, this.aquarium.camera);
    const point = this.raycaster.ray.intersectPlane(this.plane, new THREE.Vector3());
    return point ? clampPoint(point) : new THREE.Vector3(0, 0, 3.1);
  }
  pointerDown(event) {
    if (this.aquarium.dance?.active || event.button !== 0 || this.mode !== 'play') return;
    this.pointers.add(event.pointerId);
    if (this.pointers.size > 1) {
      this.multiTouch = true;
      this.cancelGesture();
      this.followTarget = null;
      return;
    }
    if (this.multiTouch) return;
    this.canvas.focus({ preventScroll: true });
    this.gesture = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      held: false,
      point: this.pointAt(event.clientX, event.clientY),
    };
    this.holdTimer = setTimeout(() => {
      if (!this.gesture || this.gesture.moved || document.hidden) return;
      this.gesture.held = true;
      this.emitting = true;
      this.emitter = this.gesture.point.clone();
      this.onActivity('bubbles');
      this.emitBubbles(this.emitter, 4);
      this.status('기포를 만드는 중 · 손을 떼면 멈춰요');
    }, HOLD_MS);
  }
  pointerMove(event) {
    if (this.aquarium.dance?.active || this.mode !== 'play' || this.multiTouch) return;
    const point = this.pointAt(event.clientX, event.clientY);
    if (this.gesture) {
      if (this.gesture.id !== event.pointerId) return;
      this.gesture.point.copy(point);
      if (Math.hypot(event.clientX - this.gesture.x, event.clientY - this.gesture.y) > 8) {
        this.gesture.moved = true;
        clearTimeout(this.holdTimer);
      }
      if (this.gesture.held) {
        this.emitter.copy(point);
        return;
      }
      if (this.gesture.moved && event.pointerType !== 'mouse' && !this.gesture.startedFollow) {
        this.gesture.startedFollow = true;
        this.onActivity('follow');
      }
      if (!this.gesture.moved) return;
    } else if (event.pointerType === 'touch' || event.buttons) return;
    this.followAt(point);
  }
  pointerUp(event) {
    const gesture = this.gesture;
    const rect = this.canvas.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (
      gesture?.id === event.pointerId &&
      !gesture.moved &&
      !gesture.held &&
      !this.multiTouch &&
      inside
    )
      this.tapAt(gesture.point);
    this.pointers.delete(event.pointerId);
    this.cancelGesture();
    if (!this.pointers.size) this.multiTouch = false;
    if (event.pointerType === 'touch' || !inside) this.followTarget = null;
    this.status();
  }
  cancelGesture() {
    clearTimeout(this.holdTimer);
    this.gesture = null;
    this.emitting = false;
    this.emissionTime = 0;
    this.status();
  }
  clear() {
    this.cancelGesture();
    this.pointers.clear();
    this.multiTouch = false;
    this.followTarget = null;
    this.tapInterest = null;
    this.bubbleInterest = null;
    this.fright = null;
  }
  followAt(point) {
    if (this.aquarium.dance?.active) return;
    this.followTarget = clampPoint(point.clone());
    this.followUntil = this.time + 3;
    this.status('친구들이 손끝을 따라와요');
  }
  tapAt(point) {
    if (this.aquarium.dance?.active) return;
    const location = clampPoint(point.clone());
    this.followTarget = null;
    this.fright = { point: location, until: this.time + 1.1 };
    this.tapInterest = { point: location, until: this.time + 4 };
    this.onActivity('tap');
    if (this.ripples.length >= 6) this.removeRipple(this.ripples.shift());
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1, 48),
      new THREE.MeshBasicMaterial({
        color: '#c9fff0',
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    mesh.position.copy(location);
    mesh.position.z = 4.3;
    mesh.scale.setScalar(0.1);
    this.aquarium.scene.add(mesh);
    this.ripples.push({ mesh, age: 0 });
  }
  emitBubbles(point, count = 1) {
    const location = clampPoint(point.clone());
    for (let i = 0; i < count && this.particles.length < MAX_BUBBLES; i++) {
      const position = location
        .clone()
        .add(new THREE.Vector3((Math.random() - 0.5) * 0.35, 0, (Math.random() - 0.5) * 0.2));
      this.particles.push({
        position,
        age: 0,
        speed: 0.7 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      });
    }
    this.bubbleInterest = { point: location, until: this.time + 3 };
  }
  bubbleBurst() {
    if (this.aquarium.dance?.active) return;
    this.onActivity('bubbles');
    this.emitBubbles(new THREE.Vector3(0, -1.8, 3.1), 24);
  }
  getIntent(fish) {
    if (this.aquarium.dance?.active) return null;
    const position = fish.mesh.position;
    if (
      this.fright &&
      this.time < this.fright.until &&
      position.distanceTo(this.fright.point) < 4.5
    ) {
      const away = position.clone().sub(this.fright.point);
      if (away.lengthSq() < 0.01) away.set(Math.cos(fish.phase), 0.3, -1);
      return {
        target: clampPoint(position.clone().addScaledVector(away.normalize(), 4)),
        speed: 3.6,
        scared: true,
      };
    }
    if (this.aquarium.food.length) return null;
    const point =
      this.bubbleInterest?.until > this.time
        ? this.bubbleInterest.point
        : this.followTarget && this.followUntil > this.time
          ? this.followTarget
          : this.tapInterest?.until > this.time
            ? this.tapInterest.point
            : null;
    if (!point) return null;
    const target = point
      .clone()
      .add(new THREE.Vector3(Math.cos(fish.phase) * 0.65, Math.sin(fish.phase) * 0.45, -0.3));
    return { target: clampPoint(target), speed: 1.9 };
  }
  removeRipple(ripple) {
    this.aquarium.scene.remove(ripple.mesh);
    ripple.mesh.geometry.dispose();
    ripple.mesh.material.dispose();
  }
  update(dt) {
    this.time += dt;
    if (this.emitting && this.emitter) {
      this.emissionTime = (this.emissionTime || 0) + dt;
      while (this.emissionTime >= 0.065) {
        this.emitBubbles(this.emitter);
        this.emissionTime -= 0.065;
      }
    }
    this.ripples = this.ripples.filter((ripple) => {
      ripple.age += dt;
      if (ripple.age > 1.1) {
        this.removeRipple(ripple);
        return false;
      }
      ripple.mesh.scale.setScalar(0.1 + ripple.age * 2.4);
      ripple.mesh.material.opacity = (1 - ripple.age / 1.1) * 0.65;
      return true;
    });
    this.particles = this.particles.filter((particle) => {
      particle.age += dt;
      particle.position.y += dt * particle.speed;
      particle.position.x += Math.sin(this.time * 2 + particle.phase) * dt * 0.1;
      return particle.age < 7 && particle.position.y < 5;
    });
    const positions = this.bubbleGeometry.attributes.position;
    this.particles.forEach((p, i) => positions.setXYZ(i, p.position.x, p.position.y, p.position.z));
    positions.needsUpdate = true;
    this.bubbleGeometry.setDrawRange(0, this.particles.length);
  }
  dispose() {
    this.clear();
    this.listeners.forEach((remove) => remove());
    this.ripples.forEach((ripple) => this.removeRipple(ripple));
    this.ripples = [];
    this.aquarium.scene.remove(this.bubbles);
    this.bubbleGeometry.dispose();
    this.bubbleMaterial.dispose();
  }
}
