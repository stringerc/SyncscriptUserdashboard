declare module 'n8ao' {
  import { Pass } from 'postprocessing';
  import * as THREE from 'three';

  export enum DepthType {
    Default = 'default',
    Reverse = 'reverse',
  }

  export interface N8AOConfiguration {
    aoRadius: number;
    aoSamples: number;
    denoiseSamples: number;
    denoiseRadius: number;
    distanceFalloff: number;
    intensity: number;
    denoiseIterations: number;
    color: THREE.Color;
    screenSpaceRadius: boolean;
    halfRes: boolean;
    depthAwareUpsampling: boolean;
    colorMultiply: boolean;
    transparencyAware: boolean;
    accumulate: boolean;
    depthBufferType: DepthType;
  }

  export class N8AOPass extends Pass {
    constructor(scene: THREE.Scene, camera: THREE.Camera, width?: number, height?: number);
    configuration: N8AOConfiguration;
    setSize(width: number, height: number): void;
  }

  export class N8AOPostPass extends Pass {
    constructor(width?: number, height?: number);
    configuration: N8AOConfiguration;
    setSize(width: number, height: number): void;
  }
}
