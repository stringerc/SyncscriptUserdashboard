import React from "react";
import { Composition } from "remotion";
import { CortexPromo } from "./CortexPromo";
import { CortexCoreRender } from "./CortexCoreRender";

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="CortexPromo"
      component={CortexPromo}
      durationInFrames={450}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
    <Composition
      id="CortexCoreRender"
      component={CortexCoreRender}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
    </>
  );
};
