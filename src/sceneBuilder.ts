import type { AbstractEngine } from "@babylonjs/core";
import {
  ArcRotateCamera,
  Color3,
  Color4,
  CreateGround,
  DefaultRenderingPipeline,
  DirectionalLight,
  Scene,
  SceneLoader,
  ShadowGenerator,
  TransformNode,
  Vector3,
  loadAssetContainerAsync,
} from "@babylonjs/core";
import { ShadowOnlyMaterial } from "@babylonjs/materials";
import type { MmdAnimation, MmdMesh, MmdWasmInstance } from "babylon-mmd";
import {
  BpmxLoader,
  BvmdLoader,
  MmdCamera,
  MmdStandardMaterialBuilder,
  MmdWasmAnimation,
  MmdWasmInstanceTypeSPR,
  MmdWasmPhysics,
  MmdWasmRuntime,
  SdefInjector,
  StreamAudioPlayer,
  getMmdWasmInstance,
  registerDxBmpTextureLoader,
} from "babylon-mmd";
import type { ISceneBuilder } from "./baseRuntime";

const LOADING_GIF_PATH = "./loading.gif";

const MOTION_FILE_PATH = "./projects/hi/dance.bvmd";
const CAMERA_MOTION_FILE_PATH = "./projects/hi/camera.bvmd";
const MODEL_FILE_PATH = "./models/Rin_Black.bpmx";
const SOUND_FILE_PATH = "./projects/hi/sound.mp3";

const initializeEngine = (engine: AbstractEngine): void => {
  SdefInjector.OverrideEngineCreateEffect(engine);
  registerDxBmpTextureLoader();
};

const setupScene = (scene: Scene): void => {
  scene.clearColor = new Color4(0.05, 0.05, 0.1, 1.0);
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

const createDirectionalLight = (scene: Scene): DirectionalLight => {
  const directionalLight = new DirectionalLight(
    "DirectionalLight",
    new Vector3(0.5, -1, 1),
    scene
  );
  directionalLight.diffuse = new Color3(0.976, 1.0, 0.901);
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

const setupAudioPlayer = (scene: Scene): StreamAudioPlayer => {
  const audioPlayer = new StreamAudioPlayer(scene);
  audioPlayer.preservesPitch = false;
  audioPlayer.source = SOUND_FILE_PATH;
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

const updateLoadingText = (index: number, text: string): void => {
  if (loadingTextParagraph) {
    const loadingTexts =
      loadingTextParagraph.textContent?.split("<br/><br/>") || [];
    loadingTexts[index] = text;
    loadingTextParagraph.innerHTML = loadingTexts.join("<br/><br/>");
  }
};

const loadAssets = async (
  scene: Scene
): Promise<[MmdWasmInstance, MmdAnimation, MmdAnimation, MmdMesh]> => {
  const materialBuilder = new MmdStandardMaterialBuilder();
  const bvmdLoader = new BvmdLoader(scene);
  bvmdLoader.loggingEnabled = true;
  SceneLoader.RegisterPlugin(new BpmxLoader());

  return Promise.all([
    getMmdWasmInstance(new MmdWasmInstanceTypeSPR()),
    bvmdLoader.loadAsync("motion", MOTION_FILE_PATH, (event) =>
      updateLoadingText(
        0,
        `モーションを読み込み中... ${event.loaded}/${event.total} (${Math.floor(
          (event.loaded * 100) / event.total
        )}%)`
      )
    ),
    bvmdLoader.loadAsync("cameraMotion", CAMERA_MOTION_FILE_PATH, (event) =>
      updateLoadingText(
        1,
        `カメラモーションを読み込み中... ${event.loaded}/${
          event.total
        } (${Math.floor((event.loaded * 100) / event.total)}%)`
      )
    ),
    loadAssetContainerAsync(MODEL_FILE_PATH, scene, {
      onProgress: (event) =>
        updateLoadingText(
          2,
          `モデルを読み込み中... ${event.loaded}/${event.total} (${Math.floor(
            (event.loaded * 100) / event.total
          )}%)`
        ),
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
  ]);
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
  const shadowGenerator = new ShadowGenerator(4096, directionalLight, true);
  shadowGenerator.usePoissonSampling = true;
  shadowGenerator.useBlurExponentialShadowMap = true;
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

  for (const mesh of modelMesh.metadata.meshes) mesh.receiveShadows = true;
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
  currentPipeline.samples = 4;
  currentPipeline.fxaaEnabled = true;
};

export const buildScene: ISceneBuilder["build"] = async (
  canvas: HTMLCanvasElement,
  engine: AbstractEngine
): Promise<Scene> => {
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
    createGround(scene, directionalLight, mmdRoot);
    const audioPlayer = setupAudioPlayer(scene);

    setupLoadingUI();

    const [wasmInstance, mmdAnimation, cameraAnimation, modelMesh] =
      await loadAssets(scene);

    hideLoadingUI(scene);

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

    const playButtonContainer = document.createElement("div");
    playButtonContainer.className = "play-button-container";
    const playButton = document.createElement("button");
    playButton.className = "play-button";
    playButton.textContent = "再生";
    playButtonContainer.appendChild(playButton);
    document.body.appendChild(playButtonContainer);

    const resetButton = document.createElement("button");
    resetButton.className = "action-button";
    resetButton.textContent = "初期";
    resetButton.style.position = "absolute";
    resetButton.style.top = "6px";
    resetButton.style.right = "6px";
    resetButton.style.display = "none";
    document.body.appendChild(resetButton);

    const cameraModeContainer = document.createElement("div");
    cameraModeContainer.className = "camera-mode-container";
    cameraModeContainer.style.position = "absolute";
    cameraModeContainer.style.top = "6px";
    cameraModeContainer.style.left = "6px";
    cameraModeContainer.style.display = "flex";
    cameraModeContainer.style.flexDirection = "column";
    cameraModeContainer.style.gap = "6px";
    document.body.appendChild(cameraModeContainer);

    const cameraModeButton = document.createElement("button");
    cameraModeButton.className = "action-button";
    cameraModeContainer.appendChild(cameraModeButton);

    const resetManualCameraButton = document.createElement("button");
    resetManualCameraButton.className = "action-button";
    resetManualCameraButton.textContent = "正面";
    cameraModeContainer.appendChild(resetManualCameraButton);
    resetManualCameraButton.style.display = "none";

    const setAutoCameraMode = () => {
      if (!isAutoCamera) {
        scene.activeCamera = mmdCamera;
        mmdCamera.setAnimation("cameraMotion");
        manualCamera.detachControl();
        currentCamera = mmdCamera;
        setupRenderingPipeline(scene, currentCamera);
        isAutoCamera = true;
        resetManualCameraButton.style.display = "none";
      }
      cameraModeButton.textContent = "カメラ";
    };

    const setManualCameraMode = () => {
      if (isAutoCamera) {
        mmdCamera.setAnimation(null);
        scene.activeCamera = manualCamera;
        manualCamera.attachControl(canvas, true);
        currentCamera = manualCamera;
        setupRenderingPipeline(scene, currentCamera);
        isAutoCamera = false;
        resetManualCameraButton.style.display = "block";
      }
      cameraModeButton.textContent = "オート";
    };

    cameraModeButton.onclick = () => {
      if (isAutoCamera) {
        setManualCameraMode();
      } else {
        setAutoCameraMode();
      }
    };

    resetManualCameraButton.onclick = () => {
      manualCamera.alpha = manualCameraInitialPosition.alpha;
      manualCamera.beta = manualCameraInitialPosition.beta;
      manualCamera.radius = manualCameraInitialPosition.radius;
      manualCamera.target = manualCameraInitialPosition.target.clone();
    };

    setAutoCameraMode();

    mmdRuntime.seekAnimation(0, true);

    playButton.onclick = () => {
      audioPlayer.play();
      mmdRuntime.playAnimation();
      playButtonContainer.style.display = "none";
      resetButton.style.display = "block";
    };

    resetButton.onclick = () => {
      playButtonContainer.style.display = "flex";
      resetButton.style.display = "none";
      audioPlayer.currentTime = 0;
      mmdRuntime.pauseAnimation();
      audioPlayer.pause();
      mmdRuntime.seekAnimation(0, true);
      setAutoCameraMode();
    };

    return scene;
  } catch (error) {
    console.error("シーンの構築中にエラーが発生しました:", error);
    throw error;
  }
};
