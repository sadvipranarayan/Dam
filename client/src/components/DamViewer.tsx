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

const waterVertexShader = `
  uniform float time;
  uniform float flowSpeed;
  uniform float waveHeight;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying float vElevation;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    vec3 pos = position;
    
    float wave1 = sin(pos.x * 0.5 + time * flowSpeed) * waveHeight;
    float wave2 = sin(pos.z * 0.3 + time * flowSpeed * 0.7) * waveHeight * 0.5;
    float wave3 = cos(pos.x * 0.2 + pos.z * 0.2 + time * flowSpeed * 1.3) * waveHeight * 0.3;
    
    pos.y += wave1 + wave2 + wave3;
    vElevation = wave1 + wave2 + wave3;
    
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const waterFragmentShader = `
  uniform vec3 waterColor;
  uniform vec3 foamColor;
  uniform float opacity;
  uniform float time;
  uniform float flowSpeed;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying float vElevation;
  
  void main() {
    vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
    float diffuse = max(dot(vNormal, lightDir), 0.0);
    
    float foam = smoothstep(0.3, 0.8, vElevation * 3.0 + 0.5);
    foam += sin(vUv.x * 50.0 + time * flowSpeed * 2.0) * 0.1;
    foam = clamp(foam, 0.0, 1.0);
    
    float fresnel = pow(1.0 - max(dot(vNormal, vec3(0.0, 1.0, 0.0)), 0.0), 2.0);
    
    vec3 finalColor = mix(waterColor, foamColor, foam * 0.4);
    finalColor += fresnel * 0.2;
    finalColor *= (0.6 + diffuse * 0.4);
    
    float caustics = sin(vWorldPosition.x * 2.0 + time) * sin(vWorldPosition.z * 2.0 + time * 0.7);
    finalColor += caustics * 0.03;
    
    gl_FragColor = vec4(finalColor, opacity);
  }
`;

const flowVertexShader = `
  uniform float time;
  uniform float flowSpeed;
  uniform float turbulence;
  varying vec2 vUv;
  varying float vFlow;
  
  void main() {
    vUv = uv;
    
    vec3 pos = position;
    
    float flowOffset = time * flowSpeed;
    float wave = sin(pos.y * 5.0 + flowOffset) * turbulence;
    wave += cos(pos.y * 3.0 + flowOffset * 1.5) * turbulence * 0.5;
    
    pos.x += wave;
    pos.z += wave * 0.5;
    
    vFlow = sin(pos.y * 2.0 + flowOffset) * 0.5 + 0.5;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const flowFragmentShader = `
  uniform vec3 waterColor;
  uniform vec3 foamColor;
  uniform float opacity;
  uniform float time;
  varying vec2 vUv;
  varying float vFlow;
  
  void main() {
    float foam = smoothstep(0.6, 1.0, vFlow);
    foam += sin(vUv.y * 30.0 + time * 5.0) * 0.15;
    
    vec3 finalColor = mix(waterColor, foamColor, foam * 0.5);
    
    float alpha = opacity * (0.7 + vFlow * 0.3);
    alpha *= smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export const DamViewer = forwardRef<DamViewerRef, DamViewerProps>(function DamViewer({ parameters }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const damMeshRef = useRef<THREE.Group | null>(null);
  const glbModelRef = useRef<THREE.Group | null>(null);
  const labelGroupRef = useRef<THREE.Group | null>(null);
  const waterSystemRef = useRef<THREE.Group | null>(null);
  const particleSystemRef = useRef<THREE.Points | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const waterMaterialsRef = useRef<THREE.ShaderMaterial[]>([]);

  const [showWireframe, setShowWireframe] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [useGLB, setUseGLB] = useState(true);
  const [glbLoaded, setGlbLoaded] = useState(false);
  const [showWater, setShowWater] = useState(true);

  const calculateFlowVelocity = useCallback((params: DamParameters) => {
    const g = 9.81;
    const head = params.waterDepth;
    const velocity = Math.sqrt(2 * g * head) * (params.efficiency / 100);
    return velocity;
  }, []);

  const calculateDischargeVelocity = useCallback((params: DamParameters) => {
    const flowArea = params.flowRate / calculateFlowVelocity(params);
    return Math.min(flowArea, params.bottomWidth * 0.3);
  }, [calculateFlowVelocity]);

  const createWaterSystem = useCallback((scene: THREE.Scene, params: DamParameters) => {
    if (waterSystemRef.current) {
      scene.remove(waterSystemRef.current);
      waterMaterialsRef.current = [];
    }

    const waterGroup = new THREE.Group();
    const velocity = calculateFlowVelocity(params);
    const flowSpeed = velocity * 0.15;
    const waveHeight = Math.min(params.flowRate * 0.02, 2);

    const waterColor = new THREE.Color(0x1a5fb4);
    const foamColor = new THREE.Color(0xffffff);

    const reservoirGeometry = new THREE.PlaneGeometry(
      params.reservoirLength,
      params.length,
      64,
      64
    );
    const reservoirMaterial = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: {
        time: { value: 0 },
        flowSpeed: { value: flowSpeed * 0.3 },
        waveHeight: { value: waveHeight * 0.5 },
        waterColor: { value: waterColor },
        foamColor: { value: foamColor },
        opacity: { value: 0.85 },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });
    waterMaterialsRef.current.push(reservoirMaterial);

    const reservoir = new THREE.Mesh(reservoirGeometry, reservoirMaterial);
    reservoir.rotation.x = -Math.PI / 2;
    reservoir.position.set(
      -params.bottomWidth / 2 - params.reservoirLength / 2,
      params.waterDepth * 0.95,
      0
    );
    waterGroup.add(reservoir);

    const spillwayHeight = params.height * 0.7;
    const spillwayWidth = params.length * 0.6;
    const flowHeight = params.waterDepth * 0.4;
    
    const curvePoints = [];
    const segments = 30;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = params.bottomWidth / 2 + t * params.bottomWidth * 1.5;
      const y = spillwayHeight - t * t * spillwayHeight + Math.sin(t * Math.PI) * flowHeight * 0.2;
      curvePoints.push(new THREE.Vector3(x, Math.max(y, 2), 0));
    }
    const flowCurve = new THREE.CatmullRomCurve3(curvePoints);

    const flowTubeGeometry = new THREE.TubeGeometry(
      flowCurve,
      64,
      flowHeight * 0.5 + params.flowRate * 0.05,
      16,
      false
    );
    const flowMaterial = new THREE.ShaderMaterial({
      vertexShader: flowVertexShader,
      fragmentShader: flowFragmentShader,
      uniforms: {
        time: { value: 0 },
        flowSpeed: { value: flowSpeed * 2 },
        turbulence: { value: params.flowRate * 0.01 },
        waterColor: { value: waterColor },
        foamColor: { value: foamColor },
        opacity: { value: 0.9 },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });
    waterMaterialsRef.current.push(flowMaterial);

    const flowTube = new THREE.Mesh(flowTubeGeometry, flowMaterial);
    waterGroup.add(flowTube);

    const flowSheet = [];
    for (let z = -spillwayWidth / 2; z <= spillwayWidth / 2; z += spillwayWidth / 8) {
      const sheetGeometry = new THREE.TubeGeometry(
        flowCurve,
        48,
        flowHeight * 0.3 + params.flowRate * 0.02,
        8,
        false
      );
      const sheet = new THREE.Mesh(sheetGeometry, flowMaterial.clone());
      sheet.position.z = z;
      waterGroup.add(sheet);
      waterMaterialsRef.current.push(sheet.material as THREE.ShaderMaterial);
    }

    const tailwaterGeometry = new THREE.PlaneGeometry(
      params.bottomWidth * 2,
      params.length,
      32,
      32
    );
    const tailwaterMaterial = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: {
        time: { value: 0 },
        flowSpeed: { value: flowSpeed },
        waveHeight: { value: waveHeight },
        waterColor: { value: waterColor },
        foamColor: { value: foamColor },
        opacity: { value: 0.8 },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });
    waterMaterialsRef.current.push(tailwaterMaterial);

    const tailwater = new THREE.Mesh(tailwaterGeometry, tailwaterMaterial);
    tailwater.rotation.x = -Math.PI / 2;
    tailwater.position.set(
      params.bottomWidth / 2 + params.bottomWidth,
      5,
      0
    );
    waterGroup.add(tailwater);

    scene.add(waterGroup);
    waterSystemRef.current = waterGroup;

    createParticleSystem(scene, params);

    return waterGroup;
  }, [calculateFlowVelocity]);

  const createParticleSystem = useCallback((scene: THREE.Scene, params: DamParameters) => {
    if (particleSystemRef.current) {
      scene.remove(particleSystemRef.current);
    }

    const particleCount = Math.floor(params.flowRate * 50);
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const lifetimes = new Float32Array(particleCount);

    const spillwayX = params.bottomWidth / 2;
    const spillwayY = params.height * 0.7;

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = spillwayX + Math.random() * params.bottomWidth;
      positions[i * 3 + 1] = spillwayY - Math.random() * spillwayY;
      positions[i * 3 + 2] = (Math.random() - 0.5) * params.length * 0.6;

      const velocity = calculateFlowVelocity(params);
      velocities[i * 3] = velocity * 0.5 + Math.random() * 2;
      velocities[i * 3 + 1] = -Math.random() * velocity * 0.3;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 2;

      lifetimes[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.8,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particleSystemRef.current = particles;

    return particles;
  }, [calculateFlowVelocity]);

  const updateParticles = useCallback((deltaTime: number, params: DamParameters) => {
    if (!particleSystemRef.current) return;

    const positions = particleSystemRef.current.geometry.attributes.position.array as Float32Array;
    const velocities = particleSystemRef.current.geometry.attributes.velocity.array as Float32Array;
    const lifetimes = particleSystemRef.current.geometry.attributes.lifetime.array as Float32Array;

    const gravity = 9.81;
    const spillwayX = params.bottomWidth / 2;
    const spillwayY = params.height * 0.7;

    for (let i = 0; i < lifetimes.length; i++) {
      lifetimes[i] -= deltaTime * 0.5;

      if (lifetimes[i] <= 0 || positions[i * 3 + 1] < 0) {
        positions[i * 3] = spillwayX + Math.random() * 5;
        positions[i * 3 + 1] = spillwayY + Math.random() * 5;
        positions[i * 3 + 2] = (Math.random() - 0.5) * params.length * 0.6;
        
        const velocity = calculateFlowVelocity(params);
        velocities[i * 3] = velocity * 0.5 + Math.random() * 2;
        velocities[i * 3 + 1] = Math.random() * 3;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 2;
        
        lifetimes[i] = 1;
      } else {
        velocities[i * 3 + 1] -= gravity * deltaTime;

        positions[i * 3] += velocities[i * 3] * deltaTime;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * deltaTime;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * deltaTime;
      }
    }

    particleSystemRef.current.geometry.attributes.position.needsUpdate = true;
    particleSystemRef.current.geometry.attributes.lifetime.needsUpdate = true;
  }, [calculateFlowVelocity]);

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
    scene.add(dir);

    const ambient = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambient);

    const grid = new THREE.GridHelper(500, 50, 0x9aa7b2, 0xe6eefc);
    scene.add(grid);

    clockRef.current = new THREE.Clock();

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      
      const deltaTime = clockRef.current.getDelta();
      const elapsedTime = clockRef.current.getElapsedTime();

      waterMaterialsRef.current.forEach((material) => {
        if (material.uniforms.time) {
          material.uniforms.time.value = elapsedTime;
        }
      });

      updateParticles(deltaTime, parameters);

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

    if (showWater) {
      createWaterSystem(sceneRef.current, parameters);
    } else {
      if (waterSystemRef.current) {
        sceneRef.current.remove(waterSystemRef.current);
        waterSystemRef.current = null;
      }
      if (particleSystemRef.current) {
        sceneRef.current.remove(particleSystemRef.current);
        particleSystemRef.current = null;
      }
      waterMaterialsRef.current = [];
    }
  }, [parameters, useGLB, showWater, createExtrudedDam, loadGLBModel, createLabels, createWaterSystem]);

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
