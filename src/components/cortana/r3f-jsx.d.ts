/// <reference types="@react-three/fiber" />

// Ambient three-fiber primitives for CortanaOrb (project may not load R3F types globally)
import type { ThreeElements } from '@react-three/fiber';

declare global {
  namespace React {
    namespace JSX {
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}

export {};
