import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { DamParameters } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RotateCcw, Grid3x3, Tag, Download, Droplets } from "lucide-react";

interface DamViewerProps {
  parameters: DamParameters;
}

export interface DamViewerRef {
  exportGLB: () => void;
}

export const DamViewer = forwardRef<DamViewerRef, DamViewerProps>(function DamViewer({ parameters }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const damMeshRef = useRef<THREE.Group | null>(null);
  const glbModelRef = useRef<THREE.Group | null>(null);
  const waterModelRef = useRef<THREE.Group | null>(null);
  const labelGroupRef = useRef<THREE.Group | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const waterMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const waterAnimationsRef = useRef<THREE.AnimationClip[]>([]);

  const [showWireframe, setShowWireframe] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [useGLB, setUseGLB] = useState(true);
  const [glbLoaded, setGlbLoaded] = useState(false);
  const [showWater, setShowWater] = useState(true);
  const [waterLoaded, setWaterLoaded] = useState(false);

  const calculateFlowVelocity = useCallback((params: DamParameters) => {
    const g = 9.81;
    const head = params.waterDepth;
    const velocity = Math.sqrt(2 * g * head);
    return velocity;
  }, []);

  const calculateAnimationSpeed = useCallback((params: DamParameters) => {
    const baseVelocity = calculateFlowVelocity(params);
    const flowFactor = params.flowRate / 100;
    const efficiencyFactor = params.efficiency / 100;
    return Math.max(0.1, baseVelocity * flowFactor * efficiencyFactor * 0.1);
  }, [calculateFlowVelocity]);

  const loadWaterModel = useCallback((scene: THREE.Scene, params: DamParameters) => {
    const loader = new GLTFLoader();
    
    loader.load(
      "/Dam_Fluid.glb",
      (gltf) => {
        if (waterModelRef.current) {
          scene.remove(waterModelRef.current);
          if (waterMixerRef.current) {
            waterMixerRef.current.stopAllAction();
            waterMixerRef.current = null;
          }
        }

        const waterModel = gltf.scene.clone();
        
        const box = new THREE.Box3().setFromObject(waterModel);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const scaleX = params.length / (size.x || 1);
        const scaleY = (params.waterDepth / (size.y || 1)) * 1.2;
        const scaleZ = params.bottomWidth / (size.z || 1);
        
        waterModel.scale.set(scaleX, scaleY, scaleZ);
        
        waterModel.position.set(0, 0, 0);

        waterModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.material) {
              const originalMaterial = child.material as THREE.MeshStandardMaterial;
              const waterMaterial = new THREE.MeshPhysicalMaterial({
                color: 0x1a6fc4,
                metalness: 0.1,
                roughness: 0.2,
                transparent: true,
                opacity: 0.85,
                transmission: 0.3,
                thickness: 1.5,
                ior: 1.33,
                envMapIntensity: 1.0,
              });
              child.material = waterMaterial;
            }
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        if (gltf.animations && gltf.animations.length > 0) {
          waterAnimationsRef.current = gltf.animations;
          const mixer = new THREE.AnimationMixer(waterModel);
          waterMixerRef.current = mixer;

          gltf.animations.forEach((clip) => {
            const action = mixer.clipAction(clip);
            action.play();
          });

          const speed = calculateAnimationSpeed(params);
          mixer.timeScale = speed;
        }

        scene.add(waterModel);
        waterModelRef.current = waterModel;
        setWaterLoaded(true);
      },
      undefined,
      (error) => {
        console.warn("Could not load water GLB model:", error);
        setWaterLoaded(false);
      }
    );
  }, [calculateAnimationSpeed]);

  const updateWaterParameters = useCallback((params: DamParameters) => {
    if (waterMixerRef.current) {
      const speed = calculateAnimationSpeed(params);
      waterMixerRef.current.timeScale = speed;
    }

    if (waterModelRef.current) {
      const box = new THREE.Box3().setFromObject(waterModelRef.current);
      const size = new THREE.Vector3();
      box.getSize(size);

      const heightScale = params.waterDepth / 50;
      waterModelRef.current.scale.y = Math.max(0.5, heightScale);

      waterModelRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhysicalMaterial) {
          const flowIntensity = params.flowRate / 200;
          child.material.opacity = 0.7 + flowIntensity * 0.2;
          child.material.transmission = 0.2 + flowIntensity * 0.2;
        }
      });
    }
  }, [calculateAnimationSpeed]);

  const createExtrudedDam = useCallback((scene: THREE.Scene, params: DamParameters) => {
    if (damMeshRef.current) {
      scene.remove(damMeshRef.current);
    }

    const group = new THREE.Group();
    const { topWidth, bottomWidth, height, length } = params;

    const shape = new THREE.Shape();
    const halfBottom = bottomWidth / 2;
    const halfTop = topWidth / 2;

    shape.moveTo(-halfBottom, 0);
    shape.lineTo(halfBottom, 0);
    shape.lineTo(halfTop, height);
    shape.lineTo(-halfTop, height);
    shape.closePath();

    const extrudeSettings = {
      depth: length,
      bevelEnabled: false,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();

    const material = new THREE.MeshStandardMaterial({
      color: 0x8899c8,
      metalness: 0.12,
      roughness: 0.55,
      wireframe: showWireframe,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    scene.add(group);
    damMeshRef.current = group;

    return group;
  }, [showWireframe]);

  const loadGLBModel = useCallback((scene: THREE.Scene, params: DamParameters) => {
    const loader = new GLTFLoader();
    
    loader.load(
      "/Dam.glb",
      (gltf) => {
        if (glbModelRef.current) {
          scene.remove(glbModelRef.current);
        }

        const model = gltf.scene;
        
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);

        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.set(-center.x, -center.y, -center.z);

        const scaleX = params.length / (size.x || 1);
        const scaleY = params.height / (size.y || 1);
        const scaleZ = params.bottomWidth / (size.z || 1);

        model.scale.set(scaleX, scaleY, scaleZ);
        model.position.y = 0;

        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.material instanceof THREE.Material) {
              (child.material as THREE.MeshStandardMaterial).wireframe = showWireframe;
            }
          }
        });

        scene.add(model);
        glbModelRef.current = model;
        setGlbLoaded(true);
      },
      undefined,
      (error) => {
        console.warn("Could not load GLB model, using extruded geometry:", error);
        setGlbLoaded(false);
        setUseGLB(false);
      }
    );
  }, [showWireframe]);

  const createLabels = useCallback((scene: THREE.Scene, params: DamParameters) => {
    if (labelGroupRef.current) {
      scene.remove(labelGroupRef.current);
    }

    if (!showLabels) return;

    const group = new THREE.Group();
    
    const createLabel = (text: string, position: THREE.Vector3) => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!;
      canvas.width = 256;
      canvas.height = 64;

      context.fillStyle = "rgba(255, 255, 255, 0.9)";
      context.roundRect(0, 0, canvas.width, canvas.height, 8);
      context.fill();

      context.fillStyle = "#1e293b";
      context.font = "bold 24px Inter, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, canvas.width / 2, canvas.height / 2);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.copy(position);
      sprite.scale.set(20, 5, 1);

      return sprite;
    };

    group.add(createLabel(`H: ${params.height}m`, new THREE.Vector3(params.bottomWidth / 2 + 15, params.height / 2, 0)));
    group.add(createLabel(`L: ${params.length}m`, new THREE.Vector3(0, params.height + 10, 0)));
    group.add(createLabel(`b: ${params.bottomWidth}m`, new THREE.Vector3(0, -8, 0)));
    group.add(createLabel(`a: ${params.topWidth}m`, new THREE.Vector3(0, params.height + 10, params.length / 2 + 20)));

    scene.add(group);
    labelGroupRef.current = group;
  }, [showLabels]);

  const resetView = useCallback(() => {
    if (cameraRef.current && controlsRef.current) {
      const maxDim = Math.max(parameters.height, parameters.length, parameters.bottomWidth);
      cameraRef.current.position.set(maxDim * 1.5, maxDim, maxDim * 1.5);
      controlsRef.current.target.set(0, parameters.height / 2, 0);
      controlsRef.current.update();
    }
  }, [parameters]);

  const handleExportGLB = useCallback(() => {
    if (!sceneRef.current) return;

    const exporter = new GLTFExporter();
    const exportScene = new THREE.Scene();

    if (useGLB && glbModelRef.current) {
      exportScene.add(glbModelRef.current.clone());
    } else if (damMeshRef.current) {
      exportScene.add(damMeshRef.current.clone());
    }

    if (waterModelRef.current) {
      exportScene.add(waterModelRef.current.clone());
    }

    exporter.parse(
      exportScene,
      (gltf) => {
        const blob = new Blob([gltf as ArrayBuffer], { type: "model/gltf-binary" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "dam_model.glb";
        link.click();
        URL.revokeObjectURL(url);
      },
      (error) => {
        console.error("Error exporting GLB:", error);
      },
      { binary: true }
    );
  }, [useGLB]);

  useImperativeHandle(ref, () => ({
    exportGLB: handleExportGLB,
  }), [handleExportGLB]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f7ff);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      5000
    );
    const maxDim = Math.max(parameters.height, parameters.length, parameters.bottomWidth);
    camera.position.set(maxDim * 1.5, maxDim, maxDim * 1.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      preserveDrawingBuffer: true 
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, parameters.height / 2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.update();
    controlsRef.current = controls;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x444455, 0.75);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(120, 250, 120);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    scene.add(dir);

    const ambient = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambient);

    const grid = new THREE.GridHelper(500, 50, 0x9aa7b2, 0xe6eefc);
    scene.add(grid);

    clockRef.current = new THREE.Clock();

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      
      const deltaTime = clockRef.current.getDelta();

      if (waterMixerRef.current) {
        waterMixerRef.current.update(deltaTime);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (waterMixerRef.current) {
        waterMixerRef.current.stopAllAction();
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;

    if (useGLB) {
      loadGLBModel(sceneRef.current, parameters);
      if (damMeshRef.current) {
        sceneRef.current.remove(damMeshRef.current);
        damMeshRef.current = null;
      }
    } else {
      createExtrudedDam(sceneRef.current, parameters);
      if (glbModelRef.current) {
        sceneRef.current.remove(glbModelRef.current);
        glbModelRef.current = null;
      }
    }

    createLabels(sceneRef.current, parameters);
  }, [parameters, useGLB, createExtrudedDam, loadGLBModel, createLabels]);

  useEffect(() => {
    if (!sceneRef.current) return;

    if (showWater) {
      if (!waterModelRef.current) {
        loadWaterModel(sceneRef.current, parameters);
      } else {
        updateWaterParameters(parameters);
      }
    } else {
      if (waterModelRef.current) {
        sceneRef.current.remove(waterModelRef.current);
        waterModelRef.current = null;
        if (waterMixerRef.current) {
          waterMixerRef.current.stopAllAction();
          waterMixerRef.current = null;
        }
      }
    }
  }, [showWater, parameters, loadWaterModel, updateWaterParameters]);

  useEffect(() => {
    if (damMeshRef.current) {
      damMeshRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
          (child.material as THREE.MeshStandardMaterial).wireframe = showWireframe;
        }
      });
    }
    if (glbModelRef.current) {
      glbModelRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
          (child.material as THREE.MeshStandardMaterial).wireframe = showWireframe;
        }
      });
    }
  }, [showWireframe]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="h-full w-full rounded-lg overflow-hidden"
        data-testid="viewer-3d-canvas"
      />
      
      <div className="absolute top-4 right-4 flex flex-col gap-3 bg-card/95 backdrop-blur-sm p-4 rounded-lg border border-card-border">
        <div className="flex items-center gap-3">
          <Switch
            id="wireframe"
            checked={showWireframe}
            onCheckedChange={setShowWireframe}
            data-testid="switch-wireframe"
          />
          <Label htmlFor="wireframe" className="flex items-center gap-2 cursor-pointer text-sm">
            <Grid3x3 className="h-4 w-4" />
            Wireframe
          </Label>
        </div>
        
        <div className="flex items-center gap-3">
          <Switch
            id="labels"
            checked={showLabels}
            onCheckedChange={setShowLabels}
            data-testid="switch-labels"
          />
          <Label htmlFor="labels" className="flex items-center gap-2 cursor-pointer text-sm">
            <Tag className="h-4 w-4" />
            Labels
          </Label>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="useGlb"
            checked={useGLB}
            onCheckedChange={setUseGLB}
            data-testid="switch-use-glb"
          />
          <Label htmlFor="useGlb" className="flex items-center gap-2 cursor-pointer text-sm">
            Use 3D Model
          </Label>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="showWater"
            checked={showWater}
            onCheckedChange={setShowWater}
            data-testid="switch-show-water"
          />
          <Label htmlFor="showWater" className="flex items-center gap-2 cursor-pointer text-sm">
            <Droplets className="h-4 w-4" />
            Water Flow
          </Label>
        </div>
        
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button
            size="sm"
            variant="outline"
            onClick={resetView}
            data-testid="button-reset-view"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportGLB}
            data-testid="button-export-glb"
          >
            <Download className="h-4 w-4 mr-2" />
            GLB
          </Button>
        </div>
      </div>
    </div>
  );
});
