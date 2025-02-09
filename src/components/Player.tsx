import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import type { ArcRotateCamera, Vector3 } from "@babylonjs/core";
import { Engine } from "@babylonjs/core/Engines/engine";
import type { MmdWasmRuntime, StreamAudioPlayer } from "babylon-mmd";
import { useEffect, useRef, useState } from "react";
import { AssetsPath, createBaseRuntime } from "./baseRuntime";
import { buildScene } from "./sceneBuilder";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Separator } from "./ui/separator";
import { ToastAction } from "./ui/toast";

const MODEL = [
  {
    q: "mikuBlk",
    name: "Miku",
    type: "Black",
    path: "./models/Miku_Black.bpmx",
  },
  {
    q: "mikuWhi",
    name: "Miku",
    type: "White",
    path: "./models/Miku_White.bpmx",
  },
  { q: "RinBlk", name: "Rin", type: "Black", path: "./models/Rin_Black.bpmx" },
  { q: "RinWhi", name: "Rin", type: "White", path: "./models/Rin_White.bpmx" },
  {
    q: "RukaBlk",
    name: "Ruka",
    type: "Black",
    path: "./models/Ruka_Black.bpmx",
  },
  {
    q: "RukaWhi",
    name: "Ruka",
    type: "White",
    path: "./models/Ruka_White.bpmx",
  },
];

const PROJECTS = [
  {
    q: "ca",
    title: "Catch the wave",
    path: {
      dance: "./projects/ca/dance.bvmd",
      camera: "./projects/ca/camera.bvmd",
      sound: "./projects/ca/sound.mp3",
      stage: null,
    },
  },
  {
    q: "hi",
    title: "Hibikase",
    path: {
      dance: "./projects/hi/dance.bvmd",
      camera: "./projects/hi/camera.bvmd",
      sound: "./projects/hi/sound.mp3",
      stage: null,
    },
  },
  {
    q: "dr",
    title: "Dreaming chu chu",
    path: {
      dance: "./projects/dr/dance.bvmd",
      camera: "./projects/dr/camera.bvmd",
      sound: "./projects/dr/sound.mp3",
      stage: "./projects/dr/stage.bpmx",
    },
  },
  {
    q: "pa",
    title: "Pallete",
    path: {
      dance: "./projects/pa/dance.bvmd",
      camera: "./projects/pa/camera.bvmd",
      sound: "./projects/pa/sound.mp3",
      stage: null,
    },
  },
  {
    q: "me",
    title: "Melancholic",
    path: {
      dance: "./projects/me/dance.bvmd",
      camera: "./projects/me/camera.bvmd",
      sound: "./projects/me/sound.mp3",
      stage: null,
    },
  },
  {
    q: "el",
    title: "Electric Angel",
    path: {
      dance: "./projects/el/dance.bvmd",
      camera: "./projects/el/camera.bvmd",
      sound: "./projects/el/sound.mp3",
      stage: null,
    },
  },
];

interface ManualCameraInitialPosition {
  alpha: number;
  beta: number;
  radius: number;
  target: Vector3;
}

const Player = () => {
  const drawingAreaRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isManualCameraMode, setIsManualCameraMode] = useState(false);
  const [isResetButtonVisible, setIsResetButtonVisible] = useState(false);
  const [mmdRuntime, setMmdRuntime] = useState<MmdWasmRuntime | null>(null);
  const [audioPlayer, setAudioPlayer] = useState<StreamAudioPlayer | null>(
    null
  );
  const [manualCamera, setManualCamera] = useState<ArcRotateCamera | null>(
    null
  );
  const [manualCameraInitialPosition, setManualCameraInitialPosition] =
    useState<ManualCameraInitialPosition | null>(null);
  const [setAutoCameraModeFunc, setSetAutoCameraModeFunc] = useState<
    (() => void) | null
  >(null);
  const [setManualCameraModeFunc, setSetManualCameraModeFunc] = useState<
    (() => void) | null
  >(null);
  const { toast } = useToast();
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  const queryParams = new URLSearchParams(window.location.search);
  const initialProjectQ = queryParams.get("p") || "dr"; // default project
  const initialModelQ = queryParams.get("m") || "MikuWhi"; // default model

  const [selectedProjectQ, setSelectedProjectQ] =
    useState<string>(initialProjectQ);
  const [selectedModelQ, setSelectedModelQ] = useState<string>(initialModelQ);

  // State for pending project and model changes in Drawer
  const [pendingProjectQ, setPendingProjectQ] =
    useState<string>(initialProjectQ);
  const [pendingModelQ, setPendingModelQ] = useState<string>(initialModelQ);

  const selectedProject =
    PROJECTS.find((p) => p.q === selectedProjectQ) || PROJECTS[2]; // Default to "Dreaming chu chu" if not found
  const selectedModel = MODEL.find((m) => m.q === selectedModelQ) || MODEL[5]; // Default to "RukaWhi" if not found

  const isDefaultSelection =
    queryParams.get("p") === null && queryParams.get("m") === null;

  useEffect(() => {
    if (isDefaultSelection) {
      return; // Skip interaction check and toast if default selection
    }

    const interactionTimeout = setTimeout(() => {
      if (!hasInteracted) {
        toast({
          title: "Open menu to continue",
          action: (
            <ToastAction altText="Open Menu" onClick={() => setMenuOpen(true)}>
              Open Menu
            </ToastAction>
          ),
        });
      }
    }, 3000);

    const handleInteraction = () => {
      if (!hasInteracted) {
        setHasInteracted(true);
        clearTimeout(interactionTimeout);
      }
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);

    return () => {
      clearTimeout(interactionTimeout);
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
    };
  }, [hasInteracted, toast, isDefaultSelection]);

  useEffect(() => {
    if (isDefaultSelection) {
      return; // Skip engine initialization if default selection
    }

    const initializeEngine = async () => {
      if (!drawingAreaRef.current) {
        console.error("drawingAreaRef.current is null");
        return;
      }

      const canvas = drawingAreaRef.current;

      const engine = new Engine(canvas, true, {
        preserveDrawingBuffer: false,
        stencil: false,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });

      const assets: AssetsPath = {
        modelFilePath: selectedModel.path,
        motionFilePath: selectedProject.path.dance,
        cameraMotionFilePath: selectedProject.path.camera,
        stageModelFilePath: selectedProject.path.stage,
        soundFilePath: selectedProject.path.sound,
      };

      const runtimeResult = await createBaseRuntime({
        canvas,
        engine,
        assets,
        sceneBuilder: { build: buildScene },
      });

      runtimeResult.run();

      const {
        mmdRuntime: r,
        audioPlayer: ap,
        manualCamera: mc,
        manualCameraInitialPosition: mcip,
        setAutoCameraMode,
        setManualCameraMode,
      } = runtimeResult;

      setMmdRuntime(r);
      setAudioPlayer(ap);
      setManualCamera(mc);
      setManualCameraInitialPosition(mcip);
      setSetAutoCameraModeFunc(() => setAutoCameraMode);
      setSetManualCameraModeFunc(() => setManualCameraMode);

      window.addEventListener("resize", () => {
        engine.resize();
      });
    };

    initializeEngine().catch(console.error);
  }, [selectedModel, selectedProject, isDefaultSelection]); // Re-run effect when selectedModel or selectedProject or isDefaultSelection changes

  useEffect(() => {
    if (isPlaying && audioPlayer) {
      const updateProgress = () => {
        if (audioPlayer && audioPlayer.duration) {
          const progressValue =
            (audioPlayer.currentTime / audioPlayer.duration) * 100;
          setProgress(progressValue);
        }
        if (isPlaying) {
          requestAnimationFrame(updateProgress);
        }
      };
      requestAnimationFrame(updateProgress);
    } else {
      setProgress(0);
    }
  }, [isPlaying, audioPlayer]);

  const handlePlayPauseButtonClick = () => {
    if (audioPlayer && mmdRuntime) {
      if (isPlaying) {
        audioPlayer.pause();
        mmdRuntime.pauseAnimation();
        setIsPlaying(false);
      } else {
        audioPlayer.play();
        mmdRuntime.playAnimation();
        setIsPlaying(true);
        setIsResetButtonVisible(true);
      }
    }
  };

  const handleResetButtonClick = () => {
    if (audioPlayer && mmdRuntime && setAutoCameraModeFunc) {
      setIsPlaying(false);
      setIsResetButtonVisible(false);
      audioPlayer.currentTime = 0;
      mmdRuntime.pauseAnimation();
      audioPlayer.pause();
      mmdRuntime.seekAnimation(0, true);
      setProgress(0);
      setAutoCameraModeFunc();
    }
  };

  const handleCameraModeButtonClick = () => {
    if (setManualCameraModeFunc && setAutoCameraModeFunc) {
      if (isManualCameraMode) {
        setAutoCameraModeFunc();
        setIsManualCameraMode(false);
      } else {
        setManualCameraModeFunc();
        setIsManualCameraMode(true);
      }
    }
  };

  const handleResetManualCameraButtonClick = () => {
    if (manualCamera && manualCameraInitialPosition) {
      manualCamera.alpha = manualCameraInitialPosition.alpha;
      manualCamera.beta = manualCameraInitialPosition.beta;
      manualCamera.radius = manualCameraInitialPosition.radius;
      manualCamera.target = manualCameraInitialPosition.target.clone();
    }
  };

  const handleApplyChange = () => {
    setSelectedProjectQ(pendingProjectQ);
    setSelectedModelQ(pendingModelQ);
    const newQuery = `?p=${pendingProjectQ}&m=${pendingModelQ}`;
    const newUrl = window.location.pathname + newQuery;
    window.location.href = newUrl;
  };

  if (isDefaultSelection) {
    return (
      <>
        <div className="flex flex-col justify-center items-center h-dvh gap-12">
          <div className="font-semibold text-3xl">
            Welcome to MMDReactViewer
          </div>
          <Button
            onClick={() => {
              setDrawerOpen(true);
            }}
          >
            Click to set project and model
          </Button>
        </div>
        <Drawer open={isDrawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Change Project and Model</DrawerTitle>
            </DrawerHeader>
            <div className="p-4">
              <div className="grid gap-1">
                <div className="text-lg font-semibold">Project</div>
                <div className="grid max-md:grid-cols-2 grid-cols-3 gap-3">
                  {PROJECTS.map((v, i) => {
                    return (
                      <Button
                        key={i}
                        variant={pendingProjectQ === v.q ? "default" : "ghost"}
                        onClick={() => setPendingProjectQ(v.q)}
                      >
                        {v.title}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-1">
                <div className="text-lg font-semibold">Model</div>
                <div className="grid max-md:grid-cols-2 grid-cols-3 gap-3">
                  {MODEL.map((v, i) => {
                    return (
                      <Button
                        key={i}
                        variant={pendingModelQ === v.q ? "default" : "ghost"}
                        onClick={() => setPendingModelQ(v.q)}
                      >
                        {v.name} ({v.type})
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
            <DrawerFooter>
              <Button onClick={handleApplyChange}>Apply</Button>
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <>
      <div className="relative">
        <Sheet open={isMenuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger className="absolute top-0 right-0 p-2">
            <Button variant="secondary">Menu</Button>
          </SheetTrigger>
          <SheetContent className="flex flex-col gap-3">
            <div className="grid gap-1">
              <div className="text-lg font-semibold">Scene Control</div>
              <Button
                onClick={handlePlayPauseButtonClick}
                variant={isPlaying ? "secondary" : "default"}
              >
                {isPlaying ? "Pause" : "Play"}
              </Button>
            </div>

            <div className="grid gap-1">
              <div className="text-lg font-semibold">Seeking</div>

              <Progress value={progress} className="pointer-events-none" />
            </div>
            <div className="grid gap-1">
              <div className="text-lg font-semibold">Camera Controls</div>
              <div className="text-muted-foreground text-sm">
                Current Control Mode: {isManualCameraMode ? "Manual" : "Auto"}
              </div>
            </div>

            <div className="grid gap-1">
              <Button onClick={handleCameraModeButtonClick} variant="secondary">
                {isManualCameraMode ? "Auto" : "Manual"}
              </Button>

              {isManualCameraMode && (
                <Button
                  onClick={handleResetManualCameraButtonClick}
                  variant="secondary"
                >
                  Reset Pos
                </Button>
              )}
            </div>
            {isResetButtonVisible && (
              <>
                <div className="grid gap-1">
                  <div className="text-lg font-semibold">Initialise scene</div>
                  <div className="text-muted-foreground text-sm">
                    Use this button in case of freezes
                  </div>
                </div>

                <Button onClick={handleResetButtonClick} variant="destructive">
                  Initialise
                </Button>
              </>
            )}
            <Separator />
            <div className="text-lg font-semibold">
              Change Project and Model
            </div>

            <Button
              onClick={() => {
                setMenuOpen(false);
                setDrawerOpen(true);
              }}
              variant="secondary"
            >
              Open Menu
            </Button>

            <SheetFooter>
              <SheetClose asChild>
                <Button variant="outline">Close</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <canvas
          id="drawingArea"
          className="w-full h-dvh m-0 p-0 overflow-hidden"
          ref={drawingAreaRef}
        />
      </div>
      <Drawer open={isDrawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Change Project and Model</DrawerTitle>
          </DrawerHeader>
          <div className="p-4">
            <div className="grid gap-1">
              <div className="text-lg font-semibold">Project</div>
              <div className="grid grid-cols-3 gap-3">
                {PROJECTS.map((v, i) => {
                  return (
                    <Button
                      key={i}
                      variant={pendingProjectQ === v.q ? "default" : "ghost"}
                      onClick={() => setPendingProjectQ(v.q)}
                    >
                      {v.title}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-1">
              <div className="text-lg font-semibold">Model</div>
              <div className="grid grid-cols-3 gap-3">
                {MODEL.map((v, i) => {
                  return (
                    <Button
                      key={i}
                      variant={pendingModelQ === v.q ? "default" : "ghost"}
                      onClick={() => setPendingModelQ(v.q)}
                    >
                      {v.name} ({v.type})
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
          <DrawerFooter>
            <Button onClick={handleApplyChange}>Apply</Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default Player;
