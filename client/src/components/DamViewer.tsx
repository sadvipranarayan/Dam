import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { DamParameters } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RotateCcw, Grid3x3, Tag, Download } from "lucide-react";

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
  const labelGroupRef = useRef<THREE.Group | null>(null);
  const animationIdRef = useRef<number | null>(null);

  const [showWireframe, setShowWireframe] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [useGLB, setUseGLB] = useState(true);
  const [glbLoaded, setGlbLoaded] = useState(false);

  const createExtrudedDam = useCallback((scene: THREE.Scene, params: DamParameters) => {
    if (damMeshRef.current) {
      scene.remove(damMeshRef.current);
    }

    const group = new THREE.Group();
    const { topWidth, bottomWidth, height, length } = params;

    // Create trapezoidal cross-section shape
    const shape = new THREE.Shape();
    const halfBottom = bottomWidth / 2;
    const halfTop = topWidth / 2;

    shape.moveTo(-halfBottom, 0);
    shape.lineTo(halfBottom, 0);
    shape.lineTo(halfTop, height);
    shape.lineTo(-halfTop, height);
    shape.closePath();

    // Extrude settings
    const extrudeSettings = {
      depth: length,
      bevelEnabled: false,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();

    // Dam material - concrete-like appearance
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

    // Add water plane
    const waterWidth = bottomWidth * 2;
    const waterLength = length * 2;
    const waterGeometry = new THREE.PlaneGeometry(waterWidth, waterLength);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.6,
      metalness: 0.1,
      roughness: 0.1,
    });
    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(-bottomWidth / 2, params.waterDepth * 0.8, 0);
    group.add(waterMesh);

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
        
        // Get the bounding box of the model
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);

        // Center the model at origin first
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.set(-center.x, -center.y, -center.z);

        // Scale the model to match the parameters
        const scaleX = params.length / (size.x || 1);
        const scaleY = params.height / (size.y || 1);
        const scaleZ = params.bottomWidth / (size.z || 1);

        model.scale.set(scaleX, scaleY, scaleZ);

        // Position the model so the base sits on the ground
        model.position.y = 0;

        // Apply wireframe if enabled
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
    
    // Create dimension lines with sprites
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

    // Height label
    group.add(createLabel(`H: ${params.height}m`, new THREE.Vector3(params.bottomWidth / 2 + 15, params.height / 2, 0)));
    
    // Length label
    group.add(createLabel(`L: ${params.length}m`, new THREE.Vector3(0, params.height + 10, 0)));
    
    // Bottom width label
    group.add(createLabel(`b: ${params.bottomWidth}m`, new THREE.Vector3(0, -8, 0)));
    
    // Top width label
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

    // Clone the dam mesh for export
    if (useGLB && glbModelRef.current) {
      exportScene.add(glbModelRef.current.clone());
    } else if (damMeshRef.current) {
      exportScene.add(damMeshRef.current.clone());
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

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f7ff);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      5000
    );
    const maxDim = Math.max(parameters.height, parameters.length, parameters.bottomWidth);
    camera.position.set(maxDim * 1.5, maxDim, maxDim * 1.5);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      preserveDrawingBuffer: true 
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, parameters.height / 2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.update();
    controlsRef.current = controls;

    // Lighting
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444455, 0.75);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(120, 250, 120);
    dir.castShadow = true;
    scene.add(dir);

    const ambient = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambient);

    // Grid
    const grid = new THREE.GridHelper(500, 50, 0x9aa7b2, 0xe6eefc);
    scene.add(grid);

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
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
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update dam model when parameters change
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

  // Update wireframe mode
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
