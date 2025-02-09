// sceneBuilder.ts
import type {
  AbstractEngine,
  ISceneLoaderProgressEvent,
} from "@babylonjs/core";
import {
  ArcRotateCamera,
  Color3,
  Color4,
  CreateGround,
  DefaultRenderingPipeline,
  DirectionalLight,
  HemisphericLight,
  LoadAssetContainerAsync,
  PBRMaterial,
  PBRMetallicRoughnessMaterial,
  Scene,
  SceneLoader,
  ShadowGenerator,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { ShadowOnlyMaterial } from "@babylonjs/materials";
import {
  BpmxLoader,
  BvmdLoader,
  MmdAnimation,
  MmdCamera,
  MmdMesh,
  MmdStandardMaterial,
  MmdStandardMaterialBuilder,
  MmdWasmAnimation,
  MmdWasmInstance,
  MmdWasmInstanceTypeSPR,
  MmdWasmPhysics,
  MmdWasmRuntime,
  SdefInjector,
  StreamAudioPlayer,
  getMmdWasmInstance,
  registerDxBmpTextureLoader,
} from "babylon-mmd";
import type { AssetsPath, ISceneBuilder } from "./baseRuntime.ts";

const LOADING_GIF_PATH = "./loading.gif";

const initializeEngine = (engine: AbstractEngine): void => {
  SdefInjector.OverrideEngineCreateEffect(engine);
  registerDxBmpTextureLoader();
};

const setupScene = (scene: Scene): void => {
  scene.clearColor = new Color4(0.957, 0.961, 0.969, 1.0);
  scene.ambientColor = new Color3(0.3, 0.3, 0.3);
};

const createMmdRoot = (scene: Scene): TransformNode => {
  const mmdRoot = new TransformNode("mmdRoot", scene);
  mmdRoot.position.z = 20;
  return mmdRoot;
};

const createMmdCamera = (scene: Scene, mmdRoot: TransformNode): MmdCamera => {
  const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
  mmdCamera.maxZ = 300;
  mmdCamera.minZ = 1;
  mmdCamera.parent = mmdRoot;
  mmdCamera.inertia = 0.8;
  return mmdCamera;
};

const createManualCamera = (
  scene: Scene,
  mmdRoot: TransformNode,
  canvas: HTMLCanvasElement
): {
  camera: ArcRotateCamera;
  initialPosition: {
    alpha: number;
    beta: number;
    radius: number;
    target: Vector3;
  };
} => {
  const initialAlpha = -Math.PI / 2;
  const initialBeta = Math.PI / 2.5;
  const initialRadius = 30;
  const initialTarget = new Vector3(0, 10, 0);

  const manualCamera = new ArcRotateCamera(
    "manualCamera",
    initialAlpha,
    initialBeta,
    initialRadius,
    initialTarget,
    scene
  );
  manualCamera.parent = mmdRoot;
  manualCamera.attachControl(canvas, true);
  manualCamera.maxZ = 300;
  manualCamera.minZ = 1;
  manualCamera.inertia = 0.8;

  return {
    camera: manualCamera,
    initialPosition: {
      alpha: initialAlpha,
      beta: initialBeta,
      radius: initialRadius,
      target: initialTarget,
    },
  };
};

const createAmbientLight = (scene: Scene): HemisphericLight => {
  const ambientLight = new HemisphericLight(
    "ambientLight",
    new Vector3(0, 1, 0),
    scene
  );
  ambientLight.intensity = 0.8;
  ambientLight.diffuse = new Color3(0.8, 0.8, 0.8);
  ambientLight.groundColor = new Color3(0.4, 0.4, 0.4);
  return ambientLight;
};

const createDirectionalLight = (scene: Scene): DirectionalLight => {
  const directionalLight = new DirectionalLight(
    "DirectionalLight",
    new Vector3(0.5, -1, 1),
    scene
  );
  directionalLight.diffuse = new Color3(0.976, 1.0, 0.976);
  directionalLight.intensity = 1.03;
  directionalLight.autoCalcShadowZBounds = false;
  directionalLight.autoUpdateExtends = false;
  return directionalLight;
};
const createGround = (
  scene: Scene,
  directionalLight: DirectionalLight,
  mmdRoot: TransformNode
): TransformNode => {
  const ground = CreateGround(
    "ground1",
    { width: 100, height: 100, subdivisions: 2, updatable: false },
    scene
  );
  const shadowOnlyMaterial = new ShadowOnlyMaterial("shadowOnly", scene);
  ground.material = shadowOnlyMaterial;
  shadowOnlyMaterial.activeLight = directionalLight;
  shadowOnlyMaterial.alpha = 0.4;
  ground.receiveShadows = true;
  ground.parent = mmdRoot;
  return ground;
};

const setupAudioPlayer = (
  scene: Scene,
  soundFilePath: string
): StreamAudioPlayer => {
  const audioPlayer = new StreamAudioPlayer(scene);
  audioPlayer.preservesPitch = false;
  audioPlayer.source = soundFilePath;
  return audioPlayer;
};

let loadingUIContainer: HTMLDivElement | null = null;
let loadingTextParagraph: HTMLParagraphElement | null = null;

const setupLoadingUI = (): void => {
  loadingUIContainer = document.createElement("div");
  loadingUIContainer.id = "loadingUIContainer";
  loadingUIContainer.style.position = "fixed";
  loadingUIContainer.style.top = "0";
  loadingUIContainer.style.left = "0";
  loadingUIContainer.style.width = "100%";
  loadingUIContainer.style.height = "100%";
  loadingUIContainer.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  loadingUIContainer.style.display = "flex";
  loadingUIContainer.style.flexDirection = "column";
  loadingUIContainer.style.justifyContent = "center";
  loadingUIContainer.style.alignItems = "center";
  loadingUIContainer.style.zIndex = "1000";

  const loadingImage = document.createElement("img");
  loadingImage.src = LOADING_GIF_PATH;
  loadingImage.alt = "Loading...";
  loadingImage.style.width = "240px";
  loadingImage.style.height = "240px";
  loadingImage.style.objectFit = "cover";

  loadingTextParagraph = document.createElement("p");
  loadingTextParagraph.textContent = "Loading assets...";
  loadingTextParagraph.style.color = "white";
  loadingTextParagraph.style.marginTop = "20px";

  if (loadingUIContainer) {
    loadingUIContainer.appendChild(loadingImage);
    loadingUIContainer.appendChild(loadingTextParagraph);
    document.body.appendChild(loadingUIContainer);
  }
};

const hideLoadingUI = (scene: Scene): void => {
  scene.onAfterRenderObservable.addOnce(() => {
    if (loadingUIContainer) {
      loadingUIContainer.style.display = "none";
    }
  });
};

const updateLoadingProgress = (progress: number, text: string): void => {
  if (loadingTextParagraph) {
    loadingTextParagraph.textContent = `${text} (${progress}%)`;
  }
};

const loadAssets = async (
  scene: Scene,
  {
    motionFilePath,
    cameraMotionFilePath,
    modelFilePath,
    stageModelFilePath,
  }: {
    motionFilePath: string;
    cameraMotionFilePath: string;
    modelFilePath: string;
    stageModelFilePath: string | null;
  }
): Promise<
  [MmdWasmInstance, MmdAnimation, MmdAnimation, MmdMesh, MmdMesh | null]
> => {
  const materialBuilder = new MmdStandardMaterialBuilder();
  const bvmdLoader = new BvmdLoader(scene);
  bvmdLoader.loggingEnabled = true;
  SceneLoader.RegisterPlugin(new BpmxLoader());

  let totalProgress = 0;
  const totalAssets = stageModelFilePath ? 4 : 3;

  const updateOverallProgress = (
    assetProgress: number,
    assetIndex: number,
    assetText: string
  ) => {
    const progressPerAsset = 100 / totalAssets;
    totalProgress =
      assetIndex * progressPerAsset + (assetProgress * progressPerAsset) / 100;
    updateLoadingProgress(
      Math.floor(totalProgress),
      `Loading assets... ${assetText}`
    );
  };

  return Promise.all([
    getMmdWasmInstance(new MmdWasmInstanceTypeSPR()),
    bvmdLoader.loadAsync("motion", motionFilePath, (event) => {
      updateOverallProgress(
        Math.floor((event.loaded * 100) / event.total),
        0,
        "motions"
      );
    }),
    bvmdLoader.loadAsync("cameraMotion", cameraMotionFilePath, (event) => {
      updateOverallProgress(
        Math.floor((event.loaded * 100) / event.total),
        1,
        "camera motions"
      );
    }),
    LoadAssetContainerAsync(modelFilePath, scene, {
      onProgress: (event) => {
        updateOverallProgress(
          Math.floor((event.loaded * 100) / event.total),
          2,
          "models"
        );
      },
      pluginOptions: {
        mmdmodel: {
          loggingEnabled: true,
          materialBuilder: materialBuilder,
        },
      },
    }).then((result) => {
      result.addAllToScene();
      return result.rootNodes[0] as MmdMesh;
    }),
    stageModelFilePath
      ? loadStageModel(scene, stageModelFilePath, (event) => {
          updateOverallProgress(
            Math.floor((event.loaded * 100) / event.total),
            3,
            "stage model"
          );
        })
      : Promise.resolve(null),
  ]);
};

const loadStageModel = async (
  scene: Scene,
  stageModelFilePath: string,
  onProgressCallback?: (event: ISceneLoaderProgressEvent) => void,
  convertToPBR: boolean = true
): Promise<MmdMesh | null> => {
  try {
    const result = await LoadAssetContainerAsync(stageModelFilePath, scene, {
      onProgress: onProgressCallback,
      pluginOptions: {
        mmdmodel: {
          loggingEnabled: true,
        },
      },
    });

    result.addAllToScene();

    const rootNode = result.rootNodes[0] as MmdMesh;
    if (rootNode) {
      rootNode.getChildMeshes().forEach((mesh) => {
        if (convertToPBR && mesh.material instanceof MmdStandardMaterial) {
          const oldMaterial = mesh.material as MmdStandardMaterial;
          const pbrMaterial = new PBRMetallicRoughnessMaterial(
            oldMaterial.name + "_pbr",
            scene
          );
          pbrMaterial.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;

          pbrMaterial.baseColor = oldMaterial.diffuseColor?.clone();

          pbrMaterial.emissiveColor = oldMaterial.emissiveColor?.clone();
          if (!pbrMaterial.emissiveColor) {
            pbrMaterial.emissiveColor = new Color3(0.05, 0.05, 0.05);
          } else {
            pbrMaterial.emissiveColor.addInPlace(
              new Color3(0.025, 0.025, 0.025)
            );
          }

          pbrMaterial.alpha = oldMaterial.alpha;
          pbrMaterial.alphaMode = oldMaterial.alphaMode;
          pbrMaterial.metallic = 0.0;
          pbrMaterial.roughness = 0.72;

          if (oldMaterial.diffuseTexture) {
            pbrMaterial.baseTexture = oldMaterial.diffuseTexture.clone();
          }
          if (oldMaterial.emissiveTexture) {
            pbrMaterial.emissiveTexture = oldMaterial.emissiveTexture.clone();
          }
          if (oldMaterial.ambientTexture) {
            pbrMaterial._ambientTexture = oldMaterial.ambientTexture.clone();
          }
          if (oldMaterial.opacityTexture) {
            pbrMaterial._opacityTexture = oldMaterial.opacityTexture.clone();
          }
          if (oldMaterial.bumpTexture) {
            pbrMaterial._bumpTexture = oldMaterial.bumpTexture.clone();
          }
          pbrMaterial.wireframe = oldMaterial.wireframe;
          pbrMaterial.sideOrientation = oldMaterial.sideOrientation;
          pbrMaterial.backFaceCulling = oldMaterial.backFaceCulling;

          mesh.material = pbrMaterial;
          oldMaterial.dispose();
        }
        mesh.receiveShadows = true;
      });

      return rootNode;
    } else {
      console.error(
        "loadStageModel: Stage model root node is not a TransformNode."
      );
      return null;
    }
  } catch (error) {
    console.error("loadStageModel: Error loading stage model:", error); // Keep error logging
    return null;
  }
};

const setupMmdRuntime = (
  scene: Scene,
  wasmInstance: MmdWasmInstance,
  mmdAnimation: MmdAnimation,
  cameraAnimation: MmdAnimation,
  modelMesh: MmdMesh,
  mmdRoot: TransformNode,
  mmdCamera: MmdCamera,
  audioPlayer: StreamAudioPlayer,
  directionalLight: DirectionalLight
): MmdWasmRuntime => {
  const shadowGenerator = new ShadowGenerator(2048, directionalLight, true);
  shadowGenerator.usePercentageCloserFiltering = true;
  shadowGenerator.transparencyShadow = true;
  shadowGenerator.forceBackFacesOnly = true;
  shadowGenerator.frustumEdgeFalloff = 0.1;

  const mmdRuntime = new MmdWasmRuntime(
    wasmInstance,
    scene,
    new MmdWasmPhysics(scene)
  );
  mmdRuntime.loggingEnabled = true;
  mmdRuntime.register(scene);

  mmdRuntime.setAudioPlayer(audioPlayer);
  mmdRuntime.setCamera(mmdCamera);

  const mmdWasmAnimation = new MmdWasmAnimation(
    mmdAnimation,
    wasmInstance,
    scene
  );
  const cameraWasmAnimation = new MmdWasmAnimation(
    cameraAnimation,
    wasmInstance,
    scene
  );

  mmdCamera.addAnimation(cameraWasmAnimation);
  mmdCamera.setAnimation("cameraMotion");

  modelMesh.parent = mmdRoot;

  shadowGenerator.addShadowCaster(modelMesh);

  const mmdModel = mmdRuntime.createMmdModel(modelMesh);
  mmdModel.addAnimation(mmdWasmAnimation);
  mmdModel.setAnimation("motion");

  mmdRuntime.physics?.createGroundModel?.([0]);

  optimizeScene(scene);
  return mmdRuntime;
};

const optimizeScene = (scene: Scene): void => {
  scene.onAfterRenderObservable.addOnce(() => {
    scene.freezeMaterials();

    const meshes = scene.meshes;
    for (let i = 0, len = meshes.length; i < len; ++i) {
      const mesh = meshes[i];
      mesh.freezeWorldMatrix();
      mesh.doNotSyncBoundingInfo = true;
      mesh.isPickable = false;
      mesh.alwaysSelectAsActiveMesh = true;
    }

    scene.skipPointerMovePicking = true;
    scene.skipPointerDownPicking = true;
    scene.skipPointerUpPicking = true;
    scene.skipFrustumClipping = true;
    scene.blockMaterialDirtyMechanism = true;
  });
};

let currentPipeline: DefaultRenderingPipeline | null = null;

const setupRenderingPipeline = (
  scene: Scene,
  currentCamera: MmdCamera | ArcRotateCamera
): void => {
  if (currentPipeline) {
    currentPipeline.dispose();
    currentPipeline = null;
  }
  currentPipeline = new DefaultRenderingPipeline("default", true, scene, [
    currentCamera,
  ]);
  currentPipeline.samples = 2;
  currentPipeline.fxaaEnabled = true;
};

export const buildScene: ISceneBuilder["build"] = async (
  canvas: HTMLCanvasElement,
  engine: AbstractEngine,
  assets: AssetsPath
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
}> => {
  try {
    initializeEngine(engine);
    const scene = new Scene(engine);

    setupScene(scene);

    const mmdRoot = createMmdRoot(scene);
    const mmdCamera = createMmdCamera(scene, mmdRoot);
    const manualCameraResult = createManualCamera(scene, mmdRoot, canvas);
    const manualCamera = manualCameraResult.camera;
    const manualCameraInitialPosition = manualCameraResult.initialPosition;
    const directionalLight = createDirectionalLight(scene);
    createAmbientLight(scene);
    createGround(scene, directionalLight, mmdRoot);

    const audioPlayer = setupAudioPlayer(scene, assets.soundFilePath);

    setupLoadingUI();

    const [wasmInstance, mmdAnimation, cameraAnimation, modelMesh, stageModel] =
      await loadAssets(scene, {
        motionFilePath: assets.motionFilePath,
        cameraMotionFilePath: assets.cameraMotionFilePath,
        modelFilePath: assets.modelFilePath,
        stageModelFilePath: assets.stageModelFilePath,
      });

    hideLoadingUI(scene);

    if (stageModel) {
      stageModel.parent = mmdRoot;
      stageModel.position = new Vector3(0, 0, 0);
      stageModel.rotation = Vector3.Zero();
    }

    const mmdRuntime: MmdWasmRuntime = setupMmdRuntime(
      scene,
      wasmInstance,
      mmdAnimation,
      cameraAnimation,
      modelMesh,
      mmdRoot,
      mmdCamera,
      audioPlayer,
      directionalLight
    );

    let isAutoCamera = true;
    let currentCamera: MmdCamera | ArcRotateCamera = mmdCamera;
    setupRenderingPipeline(scene, currentCamera);

    const setAutoCameraMode = () => {
      if (!isAutoCamera) {
        scene.activeCamera = mmdCamera;
        mmdCamera.setAnimation("cameraMotion");
        manualCamera.detachControl();
        currentCamera = mmdCamera;
        setupRenderingPipeline(scene, currentCamera);
        isAutoCamera = true;
      }
    };

    const setManualCameraMode = () => {
      if (isAutoCamera) {
        mmdCamera.setAnimation(null);
        scene.activeCamera = manualCamera;
        manualCamera.attachControl(canvas, true);
        currentCamera = manualCamera;
        setupRenderingPipeline(scene, currentCamera);
        isAutoCamera = false;
      }
    };

    setAutoCameraMode();
    mmdRuntime.seekAnimation(0, true);

    return {
      scene,
      mmdRuntime,
      audioPlayer,
      manualCamera,
      mmdCamera,
      manualCameraInitialPosition,
      setAutoCameraMode,
      setManualCameraMode,
    };
  } catch (error) {
    console.error("Error has occured while building scene:", error);
    throw error;
  }
};
