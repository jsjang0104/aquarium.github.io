import * as THREE from 'three';

/** A temporary sparring match; normal swimming resumes after completion or cancellation. */
export class FishDuel {
  constructor(aquarium, { onChange = () => {} } = {}) {
    this.aquarium = aquarium;
    this.onChange = onChange;
    this.active = null;
  }
  start(ids) {
    if (this.active || ids.length !== 2 || ids[0] === ids[1]) return false;
    const fighters = ids.map((id) => this.aquarium.fish.find((fish) => fish.id === id));
    if (fighters.some((fish) => !fish)) return false;
    const rings = fighters.map((fish, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.85, 0.025, 6, 48),
        new THREE.MeshBasicMaterial({
          color: i ? '#ffb58c' : '#adf2d5',
          transparent: true,
          opacity: 0.85,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.copy(fish.mesh.position).add(new THREE.Vector3(0, -0.8, 0));
      this.aquarium.scene.add(ring);
      return ring;
    });
    this.active = {
      ids: [...ids],
      fighters,
      rings,
      time: 0,
      winner: ids[Math.random() < 0.5 ? 0 : 1],
    };
    this.aquarium.play?.clear();
    this.changePhase('approach');
    return true;
  }
  changePhase(phase) {
    if (!this.active || this.active.phase === phase) return;
    this.active.phase = phase;
    this.onChange({ phase, ids: this.active.ids, winner: this.active.winner });
  }
  update(dt) {
    const match = this.active;
    if (!match) return;
    match.time += dt;
    if (match.time >= 13) {
      this.finish('finished');
      return;
    }
    this.changePhase(
      match.time < 3
        ? 'approach'
        : match.time < 7
          ? 'circle'
          : match.time < 10
            ? 'charge'
            : 'celebrate',
    );
    match.rings.forEach((ring, i) => {
      ring.position.copy(match.fighters[i].mesh.position).add(new THREE.Vector3(0, -0.8, 0));
      ring.scale.setScalar(1 + Math.sin(match.time * 6) * 0.08);
    });
  }
  getIntent(fish) {
    const match = this.active;
    const index = match?.ids.indexOf(fish.id) ?? -1;
    if (index < 0) return null;
    const side = index ? 1 : -1;
    let x,
      y = 0.6,
      z = 2;
    if (match.phase === 'approach') x = side * 2.8;
    else if (match.phase === 'circle') {
      const angle = (match.time - 3) * 2.2 + index * Math.PI;
      x = Math.cos(angle) * 2.4;
      y += Math.sin(angle) * 0.8;
      z += Math.sin(angle) * 0.8;
    } else if (match.phase === 'charge') {
      x = side * Math.cos((match.time - 7) * Math.PI * 2) * 2.6;
      y += side * 0.35;
    } else {
      const won = fish.id === match.winner;
      x = won ? Math.sin((match.time - 10) * 3) * 1.4 : side * 4.5;
      y = won ? 1.5 + Math.cos((match.time - 10) * 3) * 0.5 : -0.4;
    }
    return {
      target: new THREE.Vector3(x, y, z),
      speed: match.phase === 'charge' ? 5.5 : 3.6,
      scared: true,
    };
  }
  finish(phase) {
    const match = this.active;
    if (!match) return;
    this.active = null;
    match.rings.forEach((ring) => {
      this.aquarium.scene.remove(ring);
      ring.geometry.dispose();
      ring.material.dispose();
    });
    match.fighters.forEach((fish) => {
      fish.timer = 0;
    });
    this.onChange({ phase, ids: match.ids, winner: phase === 'finished' ? match.winner : null });
  }
  cancel() {
    this.finish('cancelled');
  }
  dispose() {
    this.cancel();
  }
}
