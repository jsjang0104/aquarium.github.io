import * as THREE from 'three';

/** Wrap one portrait around the fish's +X-facing head, with the body's lighting. */
export function createPortraitMaterial(color, canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({
    color,
    map: texture,
    roughness: 0.55,
    metalness: 0.03,
  });

  material.onBeforeCompile = (shader) => {
    // SphereGeometry supplies unit-sphere positions before the body's ellipsoid scale.
    // Angular coordinates make the image wrap around that same physical surface.
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPortraitPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPortraitPosition = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPortraitPosition;')
      .replace(
        '#include <map_fragment>',
        `
          vec3 portraitPosition = normalize(vPortraitPosition);
          // The nose points along +X. From that direction, screen-right is -Z.
          float longitude = atan(-portraitPosition.z, portraitPosition.x);
          float latitude = asin(clamp(portraitPosition.y, -1.0, 1.0));
          vec2 portraitUv = vec2(
            0.5 + longitude / 2.65,
            0.5 + (latitude - 0.03) / 2.4
          );
          float portraitRadius = length((portraitUv - 0.5) * 2.0);
          float feather = 1.0 - smoothstep(0.82, 0.98, portraitRadius);
          vec4 portraitColor = texture2D(map, clamp(portraitUv, 0.0, 1.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, portraitColor.rgb, portraitColor.a * feather);
        `,
      );
  };
  material.customProgramCacheKey = () => 'head-portrait-v2';
  return material;
}
