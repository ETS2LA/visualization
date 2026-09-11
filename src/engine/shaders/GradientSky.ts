import * as THREE from 'three';

// NOTE: This shader was created by ChatGPT. I claim no ownership of it.
//       The rest of the code was written by me (Tumppi066).
export function createSkyMaterial(topColor: THREE.Color, horizonColor: THREE.Color, bottomColor: THREE.Color, horizonHeight: number = 0, horizonFalloff: number = 0.05): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        side: THREE.BackSide,

        uniforms: {
            topColor: { // horizon
                value: horizonColor
            },

            horizonColor: { // bottom
                value: bottomColor
            },

            bottomColor: { // top
                value: topColor
            },

            horizonHeight: {
                value: horizonHeight
            },

            horizonFalloff: {
                value: horizonFalloff
            }
        },

        vertexShader: `
            varying vec3 vWorldPosition;

            void main() {
                vec4 worldPosition =
                    modelMatrix * vec4(position, 1.0);

                vWorldPosition = worldPosition.xyz;

                gl_Position =
                    projectionMatrix *
                    modelViewMatrix *
                    vec4(position, 1.0);
            }
        `,

        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 horizonColor;
            uniform vec3 bottomColor;

            uniform float horizonHeight;
            uniform float horizonFalloff;

            varying vec3 vWorldPosition;

            void main() {
                vec3 direction =
                    normalize(vWorldPosition - cameraPosition);

                float height = direction.y;

                float topFactor = smoothstep(
                    horizonHeight,
                    horizonHeight + horizonFalloff,
                    height
                );

                float bottomFactor = smoothstep(
                    -horizonHeight - horizonFalloff,
                    -horizonHeight,
                    height
                );

                vec3 color = mix(
                    horizonColor,
                    topColor,
                    topFactor
                );

                color = mix(
                    color,
                    bottomColor,
                    bottomFactor
                );

                gl_FragColor = vec4(color, 1.0);
            }
        `
    });
}