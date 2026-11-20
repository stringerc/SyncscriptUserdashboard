/**
 * FrameFeedbackEffect — temporal frame-blend (motion-blur trails).
 *
 * Each frame the incoming scene buffer is snapshotted into a private
 * render target; the shader mixes the current frame with that snapshot
 * by `damp`. Fast motion leaves luminous trails that decay naturally —
 * the same feedback mechanism as three.js AfterimagePass, implemented
 * as a postprocessing Effect so it composes inside EffectComposer.
 */
import * as THREE from 'three';
import { Effect, BlendFunction } from 'postprocessing';
import type { WebGLRenderer } from 'three';

const FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform sampler2D tFeedback;
  uniform float damp;
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec4 prev = texture2D(tFeedback, uv);
    outputColor = mix(inputColor, prev, clamp(damp, 0.0, 0.95));
  }
`;

const COPY_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const COPY_FRAG = /* glsl */ `
  uniform sampler2D tInput;
  varying vec2 vUv;
  void main() { gl_FragColor = texture2D(tInput, vUv); }
`;

export class FrameFeedbackEffect extends Effect {
  private feedbackRT: THREE.WebGLRenderTarget | null = null;
  private copyScene = new THREE.Scene();
  private copyCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private copyMat = new THREE.ShaderMaterial({
    uniforms: { tInput: { value: null } },
    vertexShader: COPY_VERT,
    fragmentShader: COPY_FRAG,
    depthTest: false,
    depthWrite: false,
  });

  constructor(damp = 0.55) {
    super('FrameFeedback', FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, any>([
        ['damp', { value: damp }],
        ['tFeedback', { value: null }],
      ]),
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copyMat);
    quad.frustumCulled = false;
    this.copyScene.add(quad);
  }

  setSize(width: number, height: number) {
    this.feedbackRT?.setSize(width, height);
  }

  update(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget) {
    const u = this.uniforms.get('tFeedback');
    if (!this.feedbackRT) {
      this.feedbackRT = new THREE.WebGLRenderTarget(inputBuffer.width, inputBuffer.height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: false,
        stencilBuffer: false,
      });
    }
    if (u && u.value == null) u.value = this.feedbackRT.texture;

    // Snapshot the upstream frame — next frame's shader blends against it.
    this.copyMat.uniforms.tInput.value = inputBuffer.texture;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.feedbackRT);
    renderer.render(this.copyScene, this.copyCam);
    renderer.setRenderTarget(prev);
  }

  dispose() {
    super.dispose();
    this.feedbackRT?.dispose();
    this.copyMat.dispose();
    (this.copyScene.children[0] as THREE.Mesh | undefined)?.geometry?.dispose();
  }
}
