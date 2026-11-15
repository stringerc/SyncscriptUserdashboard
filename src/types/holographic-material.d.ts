declare module 'holographic-material/src/HolographicMaterial' {
  import { ReactNode } from 'react';
  interface HolographicMaterialProps {
    fresnelAmount?: number;
    fresnelOpacity?: number;
    scanlineSize?: number;
    hologramBrightness?: number;
    signalSpeed?: number;
    hologramColor?: string;
    hologramOpacity?: number;
    enableBlinking?: boolean;
    blinkFresnelOnly?: boolean;
    enableAdditive?: boolean;
    side?: 'FrontSide' | 'BackSide' | 'DoubleSide';
  }
  export default function HolographicMaterial(props: HolographicMaterialProps): ReactNode;
}
