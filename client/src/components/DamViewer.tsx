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

interface ParticleWaterSystem {
  spillwayParticles: THREE.Points;
  cascadeParticles: THREE.Points;
  splashParticles: THREE.Points;
  mistParticles: THREE.Points;
  reservoirParticles: THREE.Points;
  group: THREE.Group;
}

export const DamViewer = forwardRef<DamViewerRef, DamViewerProps>(function DamViewer({ parameters }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const damMeshRef = useRef<THREE.Group | null>(null);
  const glbModelRef = useRef<THREE.Group | null>(null);
  const waterSystemRef = useRef<ParticleWaterSystem | null>(null);
  const labelGroupRef = useRef<THREE.Group | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const parametersRef = useRef<DamParameters>(parameters);

  const [showWireframe, setShowWireframe] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [useGLB, setUseGLB] = useState(true);
  const [glbLoaded, setGlbLoaded] = useState(false);
  const [showWater, setShowWater] = useState(true);

  useEffect(() => {
    parametersRef.current = parameters;
  }, [parameters]);

  const calculateFlowVelocity = useCallback((params: DamParameters) => {
    const g = 9.81;
    const head = params.waterDepth;
    const velocity = Math.sqrt(2 * g * head);
    return velocity * (params.efficiency / 100);
  }, []);

  const calculateDischargeVelocity = useCallback((params: DamParameters) => {
    const g = 9.81;
    const Cd = 0.62;
    return Cd * Math.sqrt(2 * g * params.waterDepth);
  }, []);

  const createParticleWaterSystem = useCallback((scene: THREE.Scene, params: DamParameters): ParticleWaterSystem => {
    const group = new THREE.Group();
    const g = 9.81;
    const flowVelocity = calculateFlowVelocity(params);
    const dischargeVelocity = calculateDischargeVelocity(params);
    const volumetricFlow = params.flowRate;
    
    const numSpillways = Math.max(3, Math.min(12, Math.floor(params.length / 15)));
    const spillwayWidth = (params.length * 0.6) / numSpillways;
    const spillwaySpacing = params.length / numSpillways;
    
    const particleMultiplier = Math.max(0.5, volumetricFlow / 50);

    const spillwayMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x4fc3f7) },
        flowSpeed: { value: dischargeVelocity },
        damHeight: { value: params.height },
        damWidth: { value: params.bottomWidth },
      },
      vertexShader: `
        uniform float time;
        uniform float flowSpeed;
        uniform float damHeight;
        uniform float damWidth;
        
        attribute float particleIndex;
        attribute float spillwayIndex;
        attribute float randomOffset;
        
        varying float vAlpha;
        varying float vProgress;
        
        void main() {
          float cycleTime = 3.0;
          float t = mod(time * flowSpeed * 0.15 + randomOffset, cycleTime) / cycleTime;
          vProgress = t;
          
          vec3 pos = position;
          
          float fallTime = t * 2.0;
          float horizontalVel = flowSpeed * 0.3;
          
          pos.y = damHeight - (0.5 * 9.81 * fallTime * fallTime * damHeight * 0.1);
          pos.z = damWidth * 0.5 + horizontalVel * fallTime * 3.0;
          
          pos.x += sin(time * 2.0 + randomOffset * 10.0) * 0.5;
          pos.z += sin(time * 3.0 + randomOffset * 8.0) * 0.3;
          
          if (pos.y < 0.0) {
            pos.y = 0.0;
          }
          
          vAlpha = 1.0 - t * 0.3;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = (3.0 + randomOffset * 2.0) * (200.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        
        varying float vAlpha;
        varying float vProgress;
        
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          
          float alpha = (1.0 - smoothstep(0.3, 0.5, dist)) * vAlpha * 0.9;
          
          vec3 finalColor = mix(color, vec3(1.0), vProgress * 0.3);
          
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    const numSpillwayParticles = Math.floor(3000 * particleMultiplier);
    const spillwayPositions = new Float32Array(numSpillwayParticles * 3);
    const spillwayIndices = new Float32Array(numSpillwayParticles);
    const spillwayRandoms = new Float32Array(numSpillwayParticles);
    const spillwaySpillwayIdx = new Float32Array(numSpillwayParticles);
    
    const startX = -(numSpillways - 1) * spillwaySpacing / 2;
    
    for (let i = 0; i < numSpillwayParticles; i++) {
      const spillwayIdx = Math.floor(Math.random() * numSpillways);
      const spillwayX = startX + spillwayIdx * spillwaySpacing;
      
      spillwayPositions[i * 3] = spillwayX + (Math.random() - 0.5) * spillwayWidth * 0.8;
      spillwayPositions[i * 3 + 1] = params.height;
      spillwayPositions[i * 3 + 2] = params.bottomWidth * 0.5;
      
      spillwayIndices[i] = i;
      spillwayRandoms[i] = Math.random();
      spillwaySpillwayIdx[i] = spillwayIdx;
    }
    
    const spillwayGeometry = new THREE.BufferGeometry();
    spillwayGeometry.setAttribute('position', new THREE.BufferAttribute(spillwayPositions, 3));
    spillwayGeometry.setAttribute('particleIndex', new THREE.BufferAttribute(spillwayIndices, 1));
    spillwayGeometry.setAttribute('randomOffset', new THREE.BufferAttribute(spillwayRandoms, 1));
    spillwayGeometry.setAttribute('spillwayIndex', new THREE.BufferAttribute(spillwaySpillwayIdx, 1));
    
    const spillwayParticles = new THREE.Points(spillwayGeometry, spillwayMaterial);
    group.add(spillwayParticles);

    const cascadeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x81d4fa) },
        foamColor: { value: new THREE.Color(0xffffff) },
        flowSpeed: { value: dischargeVelocity },
        damHeight: { value: params.height },
        damWidth: { value: params.bottomWidth },
      },
      vertexShader: `
        uniform float time;
        uniform float flowSpeed;
        uniform float damHeight;
        uniform float damWidth;
        
        attribute float randomOffset;
        attribute float cascadePhase;
        
        varying float vAlpha;
        varying float vFoam;
        
        void main() {
          float cycleTime = 2.5;
          float t = mod(time * flowSpeed * 0.2 + cascadePhase, cycleTime) / cycleTime;
          
          vec3 pos = position;
          
          float gravity = 9.81;
          float fallDist = 0.5 * gravity * t * t * damHeight * 0.15;
          float horizontalDist = flowSpeed * t * 0.5;
          
          pos.y = damHeight * (1.0 - t) - fallDist * 0.5;
          pos.z = damWidth * 0.5 + horizontalDist + t * t * damHeight * 0.3;
          
          pos.x += sin(time * 5.0 + randomOffset * 20.0) * t * 2.0;
          pos.y += sin(time * 8.0 + randomOffset * 15.0) * t * 0.5;
          
          if (pos.y < 0.0) pos.y = 0.0;
          
          vAlpha = 0.8 - t * 0.4;
          vFoam = t;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          float size = 2.0 + randomOffset * 3.0 + t * 2.0;
          gl_PointSize = size * (250.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform vec3 foamColor;
        
        varying float vAlpha;
        varying float vFoam;
        
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          
          float alpha = (1.0 - smoothstep(0.2, 0.5, dist)) * vAlpha;
          
          vec3 finalColor = mix(color, foamColor, vFoam * 0.6);
          
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    const numCascadeParticles = Math.floor(5000 * particleMultiplier);
    const cascadePositions = new Float32Array(numCascadeParticles * 3);
    const cascadeRandoms = new Float32Array(numCascadeParticles);
    const cascadePhases = new Float32Array(numCascadeParticles);
    
    for (let i = 0; i < numCascadeParticles; i++) {
      const spillwayIdx = Math.floor(Math.random() * numSpillways);
      const spillwayX = startX + spillwayIdx * spillwaySpacing;
      
      cascadePositions[i * 3] = spillwayX + (Math.random() - 0.5) * spillwayWidth;
      cascadePositions[i * 3 + 1] = params.height;
      cascadePositions[i * 3 + 2] = params.bottomWidth * 0.5;
      
      cascadeRandoms[i] = Math.random();
      cascadePhases[i] = Math.random() * 2.5;
    }
    
    const cascadeGeometry = new THREE.BufferGeometry();
    cascadeGeometry.setAttribute('position', new THREE.BufferAttribute(cascadePositions, 3));
    cascadeGeometry.setAttribute('randomOffset', new THREE.BufferAttribute(cascadeRandoms, 1));
    cascadeGeometry.setAttribute('cascadePhase', new THREE.BufferAttribute(cascadePhases, 1));
    
    const cascadeParticles = new THREE.Points(cascadeGeometry, cascadeMaterial);
    group.add(cascadeParticles);

    const splashMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xffffff) },
        flowSpeed: { value: dischargeVelocity },
        damHeight: { value: params.height },
      },
      vertexShader: `
        uniform float time;
        uniform float flowSpeed;
        uniform float damHeight;
        
        attribute float randomOffset;
        attribute vec3 velocity;
        
        varying float vAlpha;
        
        void main() {
          float cycleTime = 1.5;
          float t = mod(time * 1.5 + randomOffset * cycleTime, cycleTime) / cycleTime;
          
          vec3 pos = position;
          
          pos += velocity * t * 15.0;
          pos.y -= 0.5 * 9.81 * t * t * 20.0;
          
          if (pos.y < 0.0) pos.y = 0.0;
          
          vAlpha = (1.0 - t) * 0.8;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          float size = (1.0 + randomOffset * 2.0) * (1.0 - t * 0.5);
          gl_PointSize = size * (150.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        
        varying float vAlpha;
        
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          
          float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * vAlpha;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const numSplashParticles = Math.floor(2000 * particleMultiplier);
    const splashPositions = new Float32Array(numSplashParticles * 3);
    const splashRandoms = new Float32Array(numSplashParticles);
    const splashVelocities = new Float32Array(numSplashParticles * 3);
    
    const splashZoneZ = params.bottomWidth * 0.5 + params.height * 0.3;
    
    for (let i = 0; i < numSplashParticles; i++) {
      const spillwayIdx = Math.floor(Math.random() * numSpillways);
      const spillwayX = startX + spillwayIdx * spillwaySpacing;
      
      splashPositions[i * 3] = spillwayX + (Math.random() - 0.5) * spillwayWidth;
      splashPositions[i * 3 + 1] = 2;
      splashPositions[i * 3 + 2] = splashZoneZ;
      
      splashRandoms[i] = Math.random();
      
      splashVelocities[i * 3] = (Math.random() - 0.5) * 2;
      splashVelocities[i * 3 + 1] = 1 + Math.random() * dischargeVelocity * 0.3;
      splashVelocities[i * 3 + 2] = Math.random() * 1.5;
    }
    
    const splashGeometry = new THREE.BufferGeometry();
    splashGeometry.setAttribute('position', new THREE.BufferAttribute(splashPositions, 3));
    splashGeometry.setAttribute('randomOffset', new THREE.BufferAttribute(splashRandoms, 1));
    splashGeometry.setAttribute('velocity', new THREE.BufferAttribute(splashVelocities, 3));
    
    const splashParticles = new THREE.Points(splashGeometry, splashMaterial);
    group.add(splashParticles);

    const mistMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xffffff) },
      },
      vertexShader: `
        uniform float time;
        
        attribute float randomOffset;
        attribute float size;
        
        varying float vAlpha;
        
        void main() {
          float cycleTime = 4.0;
          float t = mod(time * 0.3 + randomOffset * cycleTime, cycleTime) / cycleTime;
          
          vec3 pos = position;
          
          pos.y += t * 25.0;
          pos.x += sin(time * 0.5 + randomOffset * 10.0) * 5.0;
          pos.z += cos(time * 0.3 + randomOffset * 8.0) * 3.0;
          
          vAlpha = (1.0 - t) * 0.25;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (1.0 + t) * (400.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        
        varying float vAlpha;
        
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * vAlpha;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const numMistParticles = Math.floor(800 * particleMultiplier);
    const mistPositions = new Float32Array(numMistParticles * 3);
    const mistRandoms = new Float32Array(numMistParticles);
    const mistSizes = new Float32Array(numMistParticles);
    
    const mistZoneZ = params.bottomWidth * 0.5 + params.height * 0.2;
    
    for (let i = 0; i < numMistParticles; i++) {
      mistPositions[i * 3] = (Math.random() - 0.5) * params.length * 0.8;
      mistPositions[i * 3 + 1] = Math.random() * 5;
      mistPositions[i * 3 + 2] = mistZoneZ + Math.random() * 15;
      
      mistRandoms[i] = Math.random();
      mistSizes[i] = 3 + Math.random() * 5;
    }
    
    const mistGeometry = new THREE.BufferGeometry();
    mistGeometry.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
    mistGeometry.setAttribute('randomOffset', new THREE.BufferAttribute(mistRandoms, 1));
    mistGeometry.setAttribute('size', new THREE.BufferAttribute(mistSizes, 1));
    
    const mistParticles = new THREE.Points(mistGeometry, mistMaterial);
    group.add(mistParticles);

    const reservoirMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x1a5f7a) },
        flowSpeed: { value: flowVelocity * 0.02 },
      },
      vertexShader: `
        uniform float time;
        uniform float flowSpeed;
        
        attribute float randomOffset;
        
        varying float vAlpha;
        
        void main() {
          vec3 pos = position;
          
          pos.y += sin(time * flowSpeed + pos.x * 0.05 + randomOffset * 10.0) * 0.3;
          pos.y += sin(time * flowSpeed * 0.7 + pos.z * 0.03) * 0.2;
          
          vAlpha = 0.6;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = 4.0 * (200.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        
        varying float vAlpha;
        
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          
          float alpha = (1.0 - smoothstep(0.3, 0.5, dist)) * vAlpha;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    const reservoirLength = params.reservoirLength || params.length * 1.5;
    const reservoirDensity = 0.1;
    const numReservoirParticles = Math.floor(params.length * reservoirLength * reservoirDensity);
    const reservoirPositions = new Float32Array(numReservoirParticles * 3);
    const reservoirRandoms = new Float32Array(numReservoirParticles);
    
    for (let i = 0; i < numReservoirParticles; i++) {
      reservoirPositions[i * 3] = (Math.random() - 0.5) * params.length * 1.3;
      reservoirPositions[i * 3 + 1] = params.waterDepth * 0.95;
      reservoirPositions[i * 3 + 2] = -params.bottomWidth * 0.5 - Math.random() * reservoirLength;
      
      reservoirRandoms[i] = Math.random();
    }
    
    const reservoirGeometry = new THREE.BufferGeometry();
    reservoirGeometry.setAttribute('position', new THREE.BufferAttribute(reservoirPositions, 3));
    reservoirGeometry.setAttribute('randomOffset', new THREE.BufferAttribute(reservoirRandoms, 1));
    
    const reservoirParticles = new THREE.Points(reservoirGeometry, reservoirMaterial);
    group.add(reservoirParticles);

    scene.add(group);

    return {
      spillwayParticles,
      cascadeParticles,
      splashParticles,
      mistParticles,
      reservoirParticles,
      group,
    };
  }, [calculateFlowVelocity, calculateDischargeVelocity]);

  const updateParticleWaterSystem = useCallback((waterSystem: ParticleWaterSystem, time: number, params: DamParameters) => {
    const flowVelocity = calculateFlowVelocity(params);
    const dischargeVelocity = calculateDischargeVelocity(params);

    const spillwayMat = waterSystem.spillwayParticles.material as THREE.ShaderMaterial;
    spillwayMat.uniforms.time.value = time;
    spillwayMat.uniforms.flowSpeed.value = dischargeVelocity;
    spillwayMat.uniforms.damHeight.value = params.height;
    spillwayMat.uniforms.damWidth.value = params.bottomWidth;

    const cascadeMat = waterSystem.cascadeParticles.material as THREE.ShaderMaterial;
    cascadeMat.uniforms.time.value = time;
    cascadeMat.uniforms.flowSpeed.value = dischargeVelocity;
    cascadeMat.uniforms.damHeight.value = params.height;
    cascadeMat.uniforms.damWidth.value = params.bottomWidth;

    const splashMat = waterSystem.splashParticles.material as THREE.ShaderMaterial;
    splashMat.uniforms.time.value = time;
    splashMat.uniforms.flowSpeed.value = dischargeVelocity;
    splashMat.uniforms.damHeight.value = params.height;

    const mistMat = waterSystem.mistParticles.material as THREE.ShaderMaterial;
    mistMat.uniforms.time.value = time;

    const reservoirMat = waterSystem.reservoirParticles.material as THREE.ShaderMaterial;
    reservoirMat.uniforms.time.value = time;
    reservoirMat.uniforms.flowSpeed.value = flowVelocity * 0.02;

    const reservoirPos = waterSystem.reservoirParticles.geometry.attributes.position;
    const posArray = reservoirPos.array as Float32Array;
    for (let i = 0; i < posArray.length / 3; i++) {
      posArray[i * 3 + 1] = params.waterDepth * 0.95;
    }
    reservoirPos.needsUpdate = true;
  }, [calculateFlowVelocity, calculateDischargeVelocity]);

  const removeParticleWaterSystem = useCallback((scene: THREE.Scene, waterSystem: ParticleWaterSystem) => {
    scene.remove(waterSystem.group);
    waterSystem.spillwayParticles.geometry.dispose();
    waterSystem.cascadeParticles.geometry.dispose();
    waterSystem.splashParticles.geometry.dispose();
    waterSystem.mistParticles.geometry.dispose();
    waterSystem.reservoirParticles.geometry.dispose();
    (waterSystem.spillwayParticles.material as THREE.Material).dispose();
    (waterSystem.cascadeParticles.material as THREE.Material).dispose();
    (waterSystem.splashParticles.material as THREE.Material).dispose();
    (waterSystem.mistParticles.material as THREE.Material).dispose();
    (waterSystem.reservoirParticles.material as THREE.Material).dispose();
  }, []);

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
      
      const elapsedTime = clockRef.current.getElapsedTime();

      if (waterSystemRef.current) {
        updateParticleWaterSystem(waterSystemRef.current, elapsedTime, parametersRef.current);
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
      if (waterSystemRef.current) {
        removeParticleWaterSystem(sceneRef.current, waterSystemRef.current);
      }
      waterSystemRef.current = createParticleWaterSystem(sceneRef.current, parameters);
    } else {
      if (waterSystemRef.current) {
        removeParticleWaterSystem(sceneRef.current, waterSystemRef.current);
        waterSystemRef.current = null;
      }
    }
  }, [showWater, parameters, createParticleWaterSystem, removeParticleWaterSystem]);

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
