declare module 'webgazer' {
  const webgazer: {
    begin(): Promise<void>;
    end(): void;
    showVideo(bool: boolean): void;
    showPredictionPoints(bool: boolean): void;
    setGazeListener(cb: (data: any, elapsed: number) => void): void;
    params: {
      faceMeshSolutionPath?: string;
      showVideo?: boolean;
      showFaceOverlay?: boolean;
      showFaceFeedbackBox?: boolean;
      showPredictionPoints?: boolean;
      [key: string]: any;
    };
    [key: string]: any;
  };
  export default webgazer;
}
