import * as THREE from 'three';
import { createPortraitMaterial } from './fish-material.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const rand = (min, max) => min + Math.random() * (max - min);
const up = new THREE.Vector3(0, 1, 0);

export class Aquarium {
  constructor(container, { reducedMotion = false, onError = () => {} } = {}) {
    this.container = container;
    this.fish = [];
    this.plants = [];
    this.food = [];
    this.time = 0;
    this.paused = reducedMotion;
    this.speed = 1;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0a3944');
    this.scene.fog = new THREE.FogExp2('#0c424b', 0.029);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    container.append(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.renderer.setAnimationLoop(null);
      onError();
    });
    this.camera = new THREE.PerspectiveCamera(39, 1, 0.1, 100);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 17;
    this.controls.maxDistance = 42;
    this.controls.minPolarAngle = Math.PI * 0.35;
    this.controls.maxPolarAngle = Math.PI * 0.55;
    this.controls.minAzimuthAngle = -0.55;
    this.controls.maxAzimuthAngle = 0.55;
    this.ambient = new THREE.HemisphereLight('#baf9ea', '#48644c', 2.2);
    this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight('#fff4cc', 3.6);
    this.sun.position.set(-5, 12, 8);
    this.scene.add(this.sun);
    const glow = new THREE.PointLight('#59dcca', 24, 30, 2);
    glow.position.set(1, 5, -2);
    this.scene.add(glow);
    this.buildEnvironment();
    this.update(0);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.resetView();
    this.last = 0;
    this.renderer.setAnimationLoop((now) => this.frame(now));
  }
  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }
  resetView() {
    this.controls.target.set(0, -0.3, 0);
    this.camera.position.set(0, 3.1, this.camera.aspect < 1 ? 35 : 24);
    this.controls.update();
  }
  material(color, extra = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...extra });
  }
  mesh(geometry, material, position, scale) {
    const m = new THREE.Mesh(geometry, material);
    if (position) m.position.set(...position);
    if (scale) m.scale.set(...scale);
    this.scene.add(m);
    return m;
  }
  buildEnvironment() {
    const sand = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 vPosition; uniform float uTime; void main(){vec2 p=vPosition.xz;float grain=fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);float a=sin(p.x*2.1+sin(p.y*1.5+uTime*.3)*1.4+uTime*.2);float b=sin(p.y*2.7+sin(p.x*1.4-uTime*.23));float light=pow(max(0.,1.-abs(a+b)*.75),9.)*.20;vec3 col=mix(vec3(.22,.32,.25),vec3(.48,.51,.33),grain*.18+.65);col+=light*vec3(.55,.85,.6);gl_FragColor=vec4(col,1.);}`,
    });
    this.sand = sand;
    this.mesh(new THREE.BoxGeometry(22.4, 0.4, 10.3), sand, [0, -4.55, 0]);
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(22.4, 10, 10.3));
    const frame = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: '#a2eadb', transparent: true, opacity: 0.16 }),
    );
    frame.position.y = 0.25;
    this.scene.add(frame);
    this.mesh(
      new THREE.PlaneGeometry(22.4, 10),
      new THREE.MeshBasicMaterial({
        color: '#448783',
        transparent: true,
        opacity: 0.045,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      [0, 0.25, -5.12],
    );
    const surface = this.mesh(
      new THREE.PlaneGeometry(22.4, 10.3),
      new THREE.MeshBasicMaterial({
        color: '#b7ffda',
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      [0, 5.23, 0],
    );
    surface.rotation.x = -Math.PI / 2;
    // Translucent beams taper toward the water surface.
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.PlaneGeometry(2.3, 12);
      const pos = geo.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        if (pos.getY(j) > 0) pos.setX(j, pos.getX(j) * 0.15);
      }
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        vertexShader:
          'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:
          'varying vec2 vUv;void main(){float a=pow(sin(vUv.x*3.14159),2.)*vUv.y*.065;gl_FragColor=vec4(.45,.8,.64,a);}',
      });
      const beam = this.mesh(geo, mat, [-8 + i * 4, 0.7, -3]);
      beam.rotation.z = -0.23;
    }
    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    for (let i = 0; i < 22; i++) {
      const side = i < 11 ? -1 : 1;
      const rock = this.mesh(
        rockGeo,
        this.material(i % 3 === 0 ? '#658578' : '#365b57'),
        [side * rand(5, 10.4), -4.1, rand(-4, 3.8)],
        [rand(0.4, 1.3), rand(0.3, 0.85), rand(0.4, 1)],
      );
      rock.rotation.set(rand(0, 2), rand(0, 3), rand(0, 1));
    }
    for (let i = 0; i < 54; i++) {
      const x = i < 42 ? (i % 2 ? -1 : 1) * rand(6.3, 10.5) : rand(-8, 8),
        z = i < 42 ? rand(-4.5, 2.9) : rand(-4.7, -3.6);
      this.createKelp(x, z, rand(1.1, 4.9), i);
    }
    this.createCoral(-7.8, -0.8, '#d49686');
    this.createCoral(7.9, 1.5, '#b18ea0');
    this.createCoral(4.9, -3.1, '#d3b77d');
    for (let i = 0; i < 110; i++) {
      const pebble = this.mesh(
        new THREE.IcosahedronGeometry(rand(0.025, 0.1), 0),
        this.material(i % 2 ? '#899381' : '#c1b791'),
        [rand(-10.8, 10.8), -4.3, rand(-4.8, 4.8)],
        [1, 0.4, 1],
      );
      pebble.rotation.y = rand(0, 6);
    }
    // A small starfish on the sand.
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5,
        r = i % 2 ? 0.15 : 0.43;
      const x = Math.cos(a) * r,
        y = Math.sin(a) * r;
      if (!i) star.moveTo(x, y);
      else star.lineTo(x, y);
    }
    star.closePath();
    const starMesh = this.mesh(
      new THREE.ExtrudeGeometry(star, {
        depth: 0.06,
        bevelEnabled: true,
        bevelSize: 0.025,
        bevelThickness: 0.025,
        bevelSegments: 1,
        steps: 1,
      }),
      this.material('#dba183'),
      [2, -4.3, 2.7],
    );
    starMesh.rotation.x = -Math.PI / 2;
    const bubbleGeo = new THREE.BufferGeometry(),
      positions = new Float32Array(95 * 3);
    this.bubbleData = [];
    for (let i = 0; i < 95; i++) {
      positions[i * 3] = rand(-10, 10);
      positions[i * 3 + 1] = rand(-4.1, 5);
      positions[i * 3 + 2] = rand(-4, 4);
      this.bubbleData.push({ x: positions[i * 3], speed: rand(0.25, 0.85), phase: rand(0, 6) });
    }
    bubbleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const bc = document.createElement('canvas');
    bc.width = bc.height = 64;
    const ctx = bc.getContext('2d');
    const gradient = ctx.createRadialGradient(30, 30, 15, 32, 32, 30);
    gradient.addColorStop(0, '#b5f2e200');
    gradient.addColorStop(0.75, '#b5f2e211');
    gradient.addColorStop(0.9, '#d5fff588');
    gradient.addColorStop(1, '#b5f2e200');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    this.bubbles = new THREE.Points(
      bubbleGeo,
      new THREE.PointsMaterial({
        map: new THREE.CanvasTexture(bc),
        size: 0.11,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    this.scene.add(this.bubbles);
    this.school = [];
    for (let i = 0; i < 11; i++) {
      const fish = this.createFish(i % 2 ? '#83b7a0' : '#b3cbb0');
      fish.scale.setScalar(rand(0.15, 0.24));
      this.scene.add(fish);
      this.school.push({ mesh: fish, phase: i * 0.57 });
    }
  }
  createKelp(x, z, height, index) {
    const geometry = new THREE.PlaneGeometry(rand(0.23, 0.52), height, 1, 14);
    geometry.translate(0, height / 2, 0);
    const material = this.material(['#397e55', '#55976a', '#2f755e', '#85a366'][index % 4], {
      side: THREE.DoubleSide,
      roughness: 0.85,
    });
    const plant = this.mesh(geometry, material, [x, -4.35, z]);
    plant.rotation.y = rand(-1, 1);
    const base = Float32Array.from(geometry.attributes.position.array);
    this.plants.push({ mesh: plant, base, height, phase: rand(0, 6), bend: rand(-0.3, 0.3) });
  }
  createCoral(x, z, color) {
    const material = this.material(color);
    const root = new THREE.Group();
    root.position.set(x, -4.3, z);
    this.scene.add(root);
    const branch = (start, end, r) => {
      const delta = end.clone().sub(start);
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.65, r, delta.length(), 6),
        material,
      );
      m.position.copy(start).add(end).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(up, delta.normalize());
      root.add(m);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.7, 6, 4), material);
      tip.position.copy(end);
      root.add(tip);
    };
    for (let i = 0; i < 8; i++) {
      const end = new THREE.Vector3(rand(-0.8, 0.8), rand(0.8, 1.8), rand(-0.45, 0.45));
      branch(new THREE.Vector3(), end, 0.1);
      for (let j = 0; j < 2; j++)
        branch(
          end.clone().multiplyScalar(0.65),
          end.clone().add(new THREE.Vector3(rand(-0.4, 0.4), rand(0.1, 0.45), rand(-0.25, 0.25))),
          0.065,
        );
    }
  }
  createFish(color, canvas) {
    const group = new THREE.Group();
    const mat = canvas
      ? createPortraitMaterial(color, canvas)
      : this.material(color, { roughness: 0.38, metalness: 0.08 });
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(1, canvas ? 48 : 32, canvas ? 32 : 20),
      mat,
    );
    body.scale.set(1.05, 0.65, 0.43);
    group.add(body);
    const makeFin = (points, position) => {
      const s = new THREE.Shape();
      points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
      s.closePath();
      const m = new THREE.Mesh(
        new THREE.ExtrudeGeometry(s, {
          depth: 0.035,
          bevelEnabled: true,
          bevelThickness: 0.025,
          bevelSize: 0.04,
          bevelSegments: 2,
          steps: 1,
        }),
        this.material(color, { side: THREE.DoubleSide, roughness: 0.55 }),
      );
      m.position.set(...position);
      group.add(m);
      return m;
    };
    const tail = makeFin(
      [
        [0, 0],
        [-0.74, 0.6],
        [-0.62, 0],
        [-0.74, -0.6],
      ],
      [-0.86, 0, 0],
    );
    makeFin(
      [
        [-0.55, 0],
        [-0.12, 0.46],
        [0.48, 0],
      ],
      [-0.06, 0.47, 0],
    );
    makeFin(
      [
        [-0.45, 0],
        [-0.3, -0.27],
        [0.35, 0],
      ],
      [-0.15, -0.5, 0],
    );
    const fins = [];
    for (const side of [-1, 1]) {
      const fin = makeFin(
        [
          [0, 0],
          [-0.45, -0.32],
          [-0.5, 0.06],
        ],
        [-0.12, -0.16, side * 0.34],
      );
      fin.rotation.x = side * 0.65;
      fins.push(fin);
      if (!canvas) {
        const eye = new THREE.Mesh(
          new THREE.SphereGeometry(0.085, 10, 8),
          this.material('#152e2e'),
        );
        eye.position.set(0.63, 0.15, side * 0.34);
        group.add(eye);
      }
    }
    group.userData = { tail, fins };
    return group;
  }
  setFish(records, canvases) {
    const old = new Map(this.fish.map((f) => [f.id, f]));
    for (const f of this.fish) {
      this.scene.remove(f.mesh);
      this.disposeObject(f.mesh);
    }
    this.fish = records.map((record, i) => {
      const mesh = this.createFish(record.color, canvases[i]);
      this.scene.add(mesh);
      const previous = old.get(record.id);
      mesh.position.copy(
        previous?.mesh.position ??
          new THREE.Vector3(
            records.length === 1
              ? 0
              : (i / (records.length - 1) - 0.5) * Math.min(14, (records.length - 1) * 4.4),
            1.1 - (i % 3) * 1.25,
            1.5 + (i % 2) * 0.5,
          ),
      );
      const direction = i % 2 ? -1 : 1;
      mesh.rotation.y = previous?.mesh.rotation.y ?? (direction < 0 ? Math.PI : 0);
      return {
        id: record.id,
        mesh,
        velocity:
          previous?.velocity ??
          new THREE.Vector3(direction * rand(0.7, 1.2), rand(-0.2, 0.2), rand(-0.2, 0.2)),
        target: previous?.target ?? new THREE.Vector3(rand(-8, 8), rand(-2.5, 3), rand(-2.5, 3)),
        timer: rand(2, 5),
        phase: rand(0, 6),
      };
    });
  }
  disposeObject(object) {
    object.traverse((child) => {
      child.geometry?.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        material?.map?.dispose();
        material?.dispose();
      }
    });
  }
  feed() {
    if (this.food.length > 0) return false;
    const x = rand(-4, 4);
    for (let i = 0; i < 15; i++) {
      const mesh = this.mesh(new THREE.SphereGeometry(0.065, 6, 4), this.material('#e7c583'), [
        x + rand(-1, 1),
        rand(3.5, 4.4),
        rand(0.5, 2),
      ]);
      this.food.push({ mesh, life: 0 });
    }
    return true;
  }
  setNight(night) {
    this.scene.background.set(night ? '#061e32' : '#0a3944');
    this.scene.fog.color.set(night ? '#072a3e' : '#0c424b');
    this.ambient.intensity = night ? 0.85 : 2.2;
    this.sun.intensity = night ? 1 : 3.6;
    this.sun.color.set(night ? '#7faaff' : '#fff4cc');
    this.renderer.toneMappingExposure = night ? 0.85 : 1.22;
  }
  update(dt) {
    this.time += dt;
    const t = this.time;
    this.sand.uniforms.uTime.value = t;
    for (const plant of this.plants) {
      const p = plant.mesh.geometry.attributes.position;
      for (let j = 0; j < p.count; j++) {
        const y = plant.base[j * 3 + 1],
          f = y / plant.height;
        const taper = Math.sin(Math.PI * (0.08 + f * 0.9));
        p.setX(
          j,
          plant.base[j * 3] * taper +
            Math.sin(t * 0.8 + plant.phase + f * 2.7) * f * f * 0.55 +
            plant.bend * f,
        );
        p.setZ(j, Math.cos(t * 0.6 + plant.phase + f * 2) * f * 0.25);
      }
      p.needsUpdate = true;
    }
    const b = this.bubbles.geometry.attributes.position;
    for (let i = 0; i < b.count; i++) {
      let y = b.getY(i) + dt * this.bubbleData[i].speed;
      if (y > 5.1) y = -4.1;
      b.setY(i, y);
      b.setX(i, this.bubbleData[i].x + Math.sin(t * 0.6 + this.bubbleData[i].phase + y) * 0.13);
    }
    b.needsUpdate = true;
    for (const item of this.food) {
      item.life += dt;
      item.mesh.position.y -= dt * 0.4;
    }
    for (const f of this.fish) {
      f.timer -= dt;
      if (this.food.length) {
        let nearest = this.food[0];
        for (const p of this.food)
          if (
            p.mesh.position.distanceToSquared(f.mesh.position) <
            nearest.mesh.position.distanceToSquared(f.mesh.position)
          )
            nearest = p;
        f.target.copy(nearest.mesh.position);
      } else if (f.timer < 0 || f.target.distanceTo(f.mesh.position) < 1) {
        f.target.set(rand(-9, 9), rand(-2.5, 3.4), rand(-3, 3.2));
        f.timer = rand(3, 7);
      }
      const desired = f.target
        .clone()
        .sub(f.mesh.position)
        .normalize()
        .multiplyScalar(this.food.length ? 2.6 : 1.25 + Math.sin(t + f.phase) * 0.3);
      for (const other of this.fish)
        if (other !== f) {
          const diff = f.mesh.position.clone().sub(other.mesh.position),
            distance = diff.length();
          if (distance < 1.8 && distance > 0.01)
            desired.addScaledVector(diff.normalize(), (1.8 - distance) * 1.2);
        }
      f.velocity.lerp(desired, Math.min(1, dt * 1.25));
      f.mesh.position.addScaledVector(f.velocity, dt);
      f.mesh.position.x = THREE.MathUtils.clamp(f.mesh.position.x, -9.5, 9.5);
      f.mesh.position.y = THREE.MathUtils.clamp(f.mesh.position.y, -3.0, 3.7);
      f.mesh.position.z = THREE.MathUtils.clamp(f.mesh.position.z, -3.6, 3.7);
      const yaw = Math.atan2(-f.velocity.z, f.velocity.x);
      let diff = Math.atan2(Math.sin(yaw - f.mesh.rotation.y), Math.cos(yaw - f.mesh.rotation.y));
      f.mesh.rotation.y += diff * Math.min(1, dt * 3);
      f.mesh.rotation.z = Math.sin(t * 2 + f.phase) * 0.045;
      f.mesh.userData.tail.rotation.y = Math.sin(t * 8 + f.phase) * 0.45;
      f.mesh.userData.fins.forEach(
        (fin, i) => (fin.rotation.y = Math.sin(t * 6 + f.phase + i) * 0.3),
      );
    }
    this.food = this.food.filter((item) => {
      const eaten = this.fish.some((f) => f.mesh.position.distanceTo(item.mesh.position) < 0.9);
      if (eaten || item.life > 18 || item.mesh.position.y < -4) {
        this.scene.remove(item.mesh);
        this.disposeObject(item.mesh);
        return false;
      }
      return true;
    });
    for (const f of this.school) {
      f.mesh.position.set(
        Math.sin(t * 0.15 + f.phase) * 8,
        Math.sin(t * 0.3 + f.phase) * 1.2 + 1.8,
        -3.6 + Math.cos(f.phase) * 0.4,
      );
      f.mesh.rotation.y = Math.cos(t * 0.15 + f.phase) > 0 ? 0 : Math.PI;
      f.mesh.userData.tail.rotation.y = Math.sin(t * 9 + f.phase) * 0.5;
    }
  }
  frame(now) {
    const dt = Math.min((now - this.last) / 1000, 0.04);
    this.last = now;
    if (document.hidden) return;
    if (!this.paused) this.update(dt * this.speed);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
