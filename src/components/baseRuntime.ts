import type { Vector3 } from "@babylonjs/core";
import { ArcRotateCamera } from "@babylonjs/core";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { Scene } from "@babylonjs/core/scene";
import type { MmdCamera, MmdWasmRuntime, StreamAudioPlayer } from "babylon-mmd";
export interface AssetsPath {
  motionFilePath: string;
  cameraMotionFilePath: string;
  soundFilePath: string;
  modelFilePath: string;
  stageModelFilePath: string | null;
}

export interface ISceneBuilder {
  build(
    canvas: HTMLCanvasElement,
    engine: AbstractEngine,
    assets: AssetsPath,
    onPlayProgress?: (progress: number) => void
  ): Promise<{
    scene: Scene;
    mmdRuntime: MmdWasmRuntime;
    audioPlayer: StreamAudioPlayer;
    manualCamera: ArcRotateCamera;
    mmdCamera: MmdCamera;
    manualCameraInitialPosition: {
      alpha: number;
      beta: number;
      radius: number;
      target: Vector3;
    };
    setAutoCameraMode: () => void;
    setManualCameraMode: () => void;
  }>;
}

export interface BaseRuntimeInitParams {
  canvas: HTMLCanvasElement;
  engine: AbstractEngine;
  assets: AssetsPath;
  sceneBuilder: ISceneBuilder;
  onPlayProgress?: (progress: number) => void;
}

interface BaseRuntime {
  run(): void;
  dispose(): void;
  scene: Scene;
  mmdRuntime: MmdWasmRuntime;
  audioPlayer: StreamAudioPlayer;
  manualCamera: ArcRotateCamera;
  mmdCamera: MmdCamera;
  manualCameraInitialPosition: {
    alpha: number;
    beta: number;
    radius: number;
    target: Vector3;
  };
  setAutoCameraMode: () => void;
  setManualCameraMode: () => void;
}

export const createBaseRuntime = async (
  params: BaseRuntimeInitParams
): Promise<BaseRuntime> => {
  const { canvas, engine, assets, sceneBuilder, onPlayProgress } = params;
  const sceneResult = await sceneBuilder.build(
    canvas,
    engine,
    assets,
    onPlayProgress
  );

  const {
    scene,
    mmdRuntime,
    audioPlayer,
    manualCamera,
    mmdCamera,
    manualCameraInitialPosition,
    setAutoCameraMode,
    setManualCameraMode,
  } = sceneResult;

  const onResize = (): void => {
    engine.resize();
  };

  const onTick = (): void => {
    if (scene) {
      scene.render();
    }
  };

  const run = (): void => {
    window.addEventListener("resize", onResize);
    engine.runRenderLoop(onTick);
  };

  const dispose = (): void => {
    window.removeEventListener("resize", onResize);
    engine.dispose();
  };

  return {
    run,
    dispose,
    scene,
    mmdRuntime,
    audioPlayer,
    manualCamera,
    mmdCamera,
    manualCameraInitialPosition,
    setAutoCameraMode,
    setManualCameraMode,
  };
};
