import * as THREE from 'three';

const FRONT = new THREE.Vector3(1, 0, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const BPM = 120;

/** One clock drives the whole school's choreography and ceiling lights. */
export class FishDance {
  constructor(aquarium, { onChange = () => {}, onMusicError = () => {} } = {}) {
    this.aquarium = aquarium;
    this.onChange = onChange;
    this.onMusicError = onMusicError;
    this.music = new Audio();
    this.music.preload = 'none';
    this.music.loop = true;
    this.music.src = new URL('../bgm.mp3', import.meta.url).href;
    this.active = false;
    this.time = 0;
    this.dancers = [];
    this.direction = new THREE.Vector3();
    this.side = new THREE.Vector3();
    this.up = new THREE.Vector3();
    this.basis = new THREE.Matrix4();
    this.roll = new THREE.Quaternion();
  }
  start() {
    const tank = this.aquarium;
    if (this.active || !tank.fish.length) return false;
    tank.play?.clear();
    for (const food of tank.food) {
      tank.scene.remove(food.mesh);
      tank.disposeObject(food.mesh);
    }
    tank.food = [];
    this.time = 0;
    this.active = true;
    tank.paused = false;
    const columns = Math.ceil(Math.sqrt(tank.fish.length));
    const rows = Math.ceil(tank.fish.length / columns);
    this.dancers = [...tank.fish, ...tank.school].map((fish, i) => {
      const small = i >= tank.fish.length;
      const index = small ? i - tank.fish.length : i;
      const row = Math.floor(index / columns);
      const count = Math.min(columns, tank.fish.length - row * columns);
      const anchor = small
        ? new THREE.Vector3((index / Math.max(1, tank.school.length - 1) - 0.5) * 16, 3.3, -2.6)
        : new THREE.Vector3(
            ((index % columns) - (count - 1) / 2) * 4.7,
            0.2 + ((rows - 1) / 2 - row) * 2.1,
            1.2 + row * 0.35,
          );
      return { fish, anchor, small, origin: fish.mesh.position.clone() };
    });
    this.buildLights();
    this.applyLighting();
    this.update(0);
    this.syncMusic();
    tank.play?.status();
    this.onChange();
    return true;
  }
  syncMusic() {
    if (!this.active || this.aquarium.paused) {
      this.music.pause();
      return;
    }
    this.music.playbackRate = this.aquarium.speed;
    if (this.music.paused) {
      this.music.play().catch((error) => {
        if (error.name !== 'AbortError' && this.active && !this.aquarium.paused) {
          this.onMusicError();
        }
      });
    }
  }
  buildLights() {
    this.group = new THREE.Group();
    this.aquarium.scene.add(this.group);
    this.faceLight = new THREE.DirectionalLight('#fff2ed', 1.8);
    this.group.add(this.faceLight);
    this.lights = [];
    for (let i = 0; i < 5; i++) {
      const color = new THREE.Color().setHSL(i / 5, 0.85, 0.65);
      const material = new THREE.ShaderMaterial({
        uniforms: { color: { value: color }, strength: { value: 0 } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vUv; varying vec3 vNormal; varying vec3 vView;
          void main() {
            vUv = uv; vNormal = normalMatrix * normal;
            vec4 view = modelViewMatrix * vec4(position, 1.0);
            vView = -view.xyz; gl_Position = projectionMatrix * view;
          }`,
        fragmentShader: `uniform vec3 color; uniform float strength;
          varying vec2 vUv; varying vec3 vNormal; varying vec3 vView;
          void main() {
            float soft = pow(abs(dot(normalize(vNormal), normalize(vView))), 1.5);
            float fade = smoothstep(0.0, 0.22, vUv.y) * (0.4 + 0.6 * vUv.y);
            gl_FragColor = vec4(color, soft * fade * strength);
          }`,
      });
      const geometry = new THREE.CylinderGeometry(0.035, 1.85, 1, 24, 1, true);
      geometry.translate(0, -0.5, 0);
      const beam = new THREE.Mesh(geometry, material);
      beam.position.set(-8 + i * 4, 5.1, -0.9);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 12, 8),
        new THREE.MeshBasicMaterial({ color }),
      );
      lamp.position.copy(beam.position);
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(1.8, 32),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.15,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      pool.rotation.x = -Math.PI / 2;
      const target = new THREE.Object3D();
      // Three real spotlights color the fish; five soft beams make the light visible in water.
      const spot = i % 2 === 0 ? new THREE.SpotLight(color, 75, 22, 0.48, 0.85, 1) : null;
      if (spot) {
        spot.position.copy(beam.position);
        spot.target = target;
        this.group.add(spot);
      }
      this.group.add(beam, lamp, pool, target);
      this.lights.push({ beam, lamp, pool, target, spot });
    }
    this.ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.36, 1),
      new THREE.MeshStandardMaterial({
        color: '#e6d9ff',
        metalness: 0.8,
        roughness: 0.18,
        emissive: '#7953ac',
        emissiveIntensity: 0.45,
        flatShading: true,
      }),
    );
    this.ball.position.set(0, 4.65, 0.3);
    this.group.add(this.ball);
    const positions = new Float32Array(54 * 3);
    for (let i = 0; i < 54; i++) {
      positions[i * 3] = Math.sin(i * 12.9898) * 9;
      positions[i * 3 + 2] = Math.cos(i * 7.23) * 2.8;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.sparkles = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: '#efd5ff',
        size: 0.13,
        transparent: true,
        opacity: 0.7,
        map: this.aquarium.bubbles.material.map.clone(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.sparkles.frustumCulled = false;
    this.group.add(this.sparkles);
  }
  applyLighting() {
    if (!this.active) return;
    const tank = this.aquarium;
    tank.scene.background.set(tank.night ? '#100b28' : '#171735');
    tank.scene.fog.color.set('#1b2246');
    tank.ambient.intensity = tank.night ? 0.85 : 1.4;
    tank.sun.intensity = 1.7;
    tank.sun.color.set('#e6deff');
    tank.renderer.toneMappingExposure = 1.05;
  }
  faceCamera() {
    if (!this.active) return;
    const beat = ((this.time * BPM) / 60) * Math.PI * 2;
    const amplitude = this.aquarium.reducedMotion ? 0.35 : 1;
    this.faceLight.position.copy(this.aquarium.camera.position);
    for (const { fish } of this.dancers) {
      const mesh = fish.mesh;
      this.direction.copy(this.aquarium.camera.position).sub(mesh.position).normalize();
      this.side.crossVectors(this.direction, this.aquarium.camera.up).normalize();
      this.up.crossVectors(this.side, this.direction).normalize();
      this.basis.makeBasis(this.direction, this.up, this.side);
      mesh.quaternion.setFromRotationMatrix(this.basis);
      // Roll around the nose so the face keeps looking at the camera while swaying.
      this.roll.setFromAxisAngle(FRONT, Math.sin(beat * 0.5) * 0.22 * amplitude);
      mesh.quaternion.multiply(this.roll);
    }
  }
  update(dt) {
    if (!this.active) return;
    this.time += dt;
    const beat = ((this.time * BPM) / 60) * Math.PI * 2;
    const amplitude = this.aquarium.reducedMotion ? 0.35 : 1;
    const entrance = THREE.MathUtils.smoothstep(this.time, 0, 1.4);
    const bounce = Math.sin(beat) * 0.27 * amplitude;
    const sway = Math.sin(beat * 0.5) * 0.55 * amplitude;
    for (const { fish, anchor, small, origin } of this.dancers) {
      const size = small ? 0.3 : 1;
      fish.mesh.position
        .set(
          anchor.x + sway * size,
          anchor.y + bounce * size,
          anchor.z + Math.cos(beat * 0.5) * 0.16 * size * amplitude,
        )
        .lerp(origin, 1 - entrance);
      fish.velocity?.set(0, 0, 0);
      fish.mesh.userData.tail.rotation.y = Math.sin(beat) * 0.65 * amplitude;
      fish.mesh.userData.fins.forEach((fin, i) => {
        fin.rotation.y = Math.sin(beat + i * Math.PI) * 0.65 * amplitude;
      });
    }
    this.faceCamera();
    const pulse = 0.5 + 0.5 * Math.sin(beat);
    const fade = Math.min(1, this.time * 2);
    this.lights.forEach(({ beam, lamp, pool, target, spot }, i) => {
      target.position.set(
        -7 + i * 3.5 + Math.sin(this.time * 0.8 + i * 1.6) * 1.7 * amplitude,
        -4.28,
        Math.cos(this.time * 0.6 + i * 1.3) * 2.4 * amplitude,
      );
      this.direction.copy(target.position).sub(beam.position);
      beam.scale.y = this.direction.length();
      beam.quaternion.setFromUnitVectors(DOWN, this.direction.normalize());
      const color = beam.material.uniforms.color.value;
      color.setHSL((i / 5 + this.time * 0.045) % 1, 0.85, 0.65);
      beam.material.uniforms.strength.value = fade * (0.14 + pulse * 0.09 * amplitude);
      lamp.material.color.copy(color);
      pool.material.color.copy(color);
      pool.material.opacity = fade * (0.12 + pulse * 0.1 * amplitude);
      pool.position.copy(target.position);
      if (spot) {
        spot.color.copy(color);
        spot.intensity = fade * (65 + pulse * 30 * amplitude);
      }
    });
    this.ball.rotation.y = this.time * 0.65 * amplitude;
    const positions = this.sparkles.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      positions.setY(i, ((i * 0.37 + this.time * 0.35 * amplitude) % 8) - 3.2);
    }
    positions.needsUpdate = true;
    this.sparkles.material.opacity = fade * (0.45 + pulse * 0.3 * amplitude);
  }
  stop() {
    this.music.pause();
    this.music.currentTime = 0;
    if (!this.active) return;
    this.active = false;
    const tank = this.aquarium;
    for (const { fish } of this.dancers) {
      const yaw = fish.mesh.rotation.y;
      fish.mesh.rotation.set(0, yaw, 0);
      fish.mesh.userData.tail.rotation.y = 0;
      fish.mesh.userData.fins.forEach((fin) => {
        fin.rotation.y = 0;
      });
      if (fish.velocity) {
        fish.velocity.set(Math.cos(yaw) * 0.6, 0, -Math.sin(yaw) * 0.6);
        fish.timer = 0;
      }
    }
    tank.scene.remove(this.group);
    tank.disposeObject(this.group);
    this.group = null;
    this.faceLight = null;
    this.ball = null;
    this.sparkles = null;
    this.lights = [];
    this.dancers = [];
    tank.setNight(tank.night);
    tank.play?.clear();
    this.onChange();
  }
  dispose() {
    this.stop();
  }
}
