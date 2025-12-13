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

interface WaterSystem {
  reservoir: THREE.Mesh;
  spillways: THREE.Group;
  splashParticles: THREE.Points;
  mist: THREE.Points;
  materials: {
    reservoir: THREE.ShaderMaterial;
    spillway: THREE.ShaderMaterial;
    splash: THREE.ShaderMaterial;
    mist: THREE.ShaderMaterial;
  };
}

export const DamViewer = forwardRef<DamViewerRef, DamViewerProps>(function DamViewer({ parameters }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const damMeshRef = useRef<THREE.Group | null>(null);
  const glbModelRef = useRef<THREE.Group | null>(null);
  const waterSystemRef = useRef<WaterSystem | null>(null);
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

  const createWaterSystem = useCallback((scene: THREE.Scene, params: DamParameters): WaterSystem => {
    const g = 9.81;
    const flowVelocity = calculateFlowVelocity(params);
    const dischargeVelocity = calculateDischargeVelocity(params);
    const volumetricFlow = params.flowRate;
    const numSpillways = Math.max(3, Math.min(12, Math.floor(params.length / 15)));
    const spillwayWidth = (params.length * 0.7) / numSpillways;

    const reservoirMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        waterColor: { value: new THREE.Color(0x1a5f7a) },
        deepColor: { value: new THREE.Color(0x0a2f3a) },
        foamColor: { value: new THREE.Color(0xc8e6f0) },
        opacity: { value: 0.85 },
        waveIntensity: { value: volumetricFlow / 200 },
        flowSpeed: { value: flowVelocity * 0.05 },
        waterDepth: { value: params.waterDepth },
      },
      vertexShader: `
        uniform float time;
        uniform float waveIntensity;
        uniform float flowSpeed;
        
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying float vDepth;
        
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          
          vec3 pos = position;
          
          float wave1 = sin(pos.x * 0.05 + pos.z * 0.03 + time * flowSpeed) * waveIntensity * 0.5;
          float wave2 = sin(pos.x * 0.08 - time * flowSpeed * 0.7) * waveIntensity * 0.3;
          float wave3 = cos(pos.z * 0.06 + time * flowSpeed * 0.5) * waveIntensity * 0.2;
          
          pos.y += wave1 + wave2 + wave3;
          vDepth = pos.y;
          
          vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
          vWorldPosition = worldPosition.xyz;
          
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 waterColor;
        uniform vec3 deepColor;
        uniform vec3 foamColor;
        uniform float opacity;
        uniform float time;
        uniform float flowSpeed;
        uniform float waterDepth;
        
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying float vDepth;
        
        void main() {
          vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
          float diffuse = max(dot(vNormal, lightDir), 0.0);
          
          float depthFactor = clamp(vDepth / waterDepth, 0.0, 1.0);
          vec3 baseColor = mix(deepColor, waterColor, depthFactor);
          
          float fresnel = pow(1.0 - max(dot(vNormal, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
          
          float foam = 0.0;
          foam += smoothstep(0.7, 1.0, sin(vUv.x * 50.0 + time * 2.0) * 0.5 + 0.5) * 0.1;
          
          vec3 finalColor = baseColor;
          finalColor = mix(finalColor, foamColor, foam);
          finalColor += fresnel * 0.15;
          finalColor *= (0.6 + diffuse * 0.4);
          
          float sparkle = pow(max(0.0, sin(vWorldPosition.x * 3.0 + time * 2.5) * sin(vWorldPosition.z * 3.0 + time * 2.0)), 12.0);
          finalColor += sparkle * 0.15;
          
          gl_FragColor = vec4(finalColor, opacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const reservoirLength = params.reservoirLength || params.length * 2;
    const reservoirGeometry = new THREE.PlaneGeometry(
      params.length * 1.5,
      reservoirLength,
      64,
      64
    );
    reservoirGeometry.rotateX(-Math.PI / 2);
    
    const reservoir = new THREE.Mesh(reservoirGeometry, reservoirMaterial);
    reservoir.position.set(0, params.waterDepth * 0.95, -reservoirLength / 2 - params.bottomWidth / 2);
    scene.add(reservoir);

    const reservoirDepthGeometry = new THREE.BoxGeometry(
      params.length * 1.5,
      params.waterDepth,
      reservoirLength
    );
    const reservoirDepthMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a3040,
      transparent: true,
      opacity: 0.6,
      side: THREE.BackSide,
    });
    const reservoirDepth = new THREE.Mesh(reservoirDepthGeometry, reservoirDepthMaterial);
    reservoirDepth.position.set(0, params.waterDepth / 2, -reservoirLength / 2 - params.bottomWidth / 2);
    scene.add(reservoirDepth);

    const spillwayMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        waterColor: { value: new THREE.Color(0x4fa8c7) },
        foamColor: { value: new THREE.Color(0xffffff) },
        flowSpeed: { value: dischargeVelocity * 0.3 },
        turbulence: { value: volumetricFlow / 100 },
        damHeight: { value: params.height },
      },
      vertexShader: `
        uniform float time;
        uniform float flowSpeed;
        uniform float turbulence;
        uniform float damHeight;
        
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying float vFlowProgress;
        varying float vTurbulence;
        
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          
          vec3 pos = position;
          
          float flowProgress = 1.0 - (pos.y / damHeight);
          vFlowProgress = flowProgress;
          
          float speedIncrease = 1.0 + flowProgress * 2.0;
          float lateralWave = sin(pos.x * 0.5 + time * flowSpeed * speedIncrease) * turbulence * 0.3;
          float verticalWave = sin(pos.y * 0.3 - time * flowSpeed * speedIncrease * 2.0) * turbulence * 0.2;
          float cascade = sin(pos.y * 2.0 - time * flowSpeed * 3.0) * turbulence * 0.4 * flowProgress;
          
          pos.z += lateralWave + cascade;
          pos.x += verticalWave * 0.5;
          
          vTurbulence = abs(lateralWave) + abs(cascade);
          
          vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
          vWorldPosition = worldPosition.xyz;
          
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 waterColor;
        uniform vec3 foamColor;
        uniform float time;
        uniform float flowSpeed;
        uniform float turbulence;
        
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying float vFlowProgress;
        varying float vTurbulence;
        
        void main() {
          vec3 lightDir = normalize(vec3(0.3, 0.8, 0.5));
          float diffuse = max(dot(vNormal, lightDir), 0.0);
          
          float foam = smoothstep(0.2, 0.8, vTurbulence / turbulence);
          foam += sin(vUv.y * 100.0 - time * flowSpeed * 5.0) * 0.2 * vFlowProgress;
          foam += pow(vFlowProgress, 2.0) * 0.3;
          foam = clamp(foam, 0.0, 1.0);
          
          float streak = sin(vUv.x * 30.0 + vUv.y * 5.0 - time * flowSpeed * 3.0) * 0.5 + 0.5;
          streak = pow(streak, 3.0) * 0.3;
          
          vec3 cascadeColor = mix(waterColor, vec3(0.7, 0.9, 1.0), vFlowProgress * 0.5);
          vec3 finalColor = mix(cascadeColor, foamColor, foam * 0.7 + streak);
          
          finalColor *= (0.5 + diffuse * 0.5);
          
          float opacity = 0.9 - vFlowProgress * 0.2;
          
          gl_FragColor = vec4(finalColor, opacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const spillways = new THREE.Group();
    const spillwayStartX = -(numSpillways - 1) * spillwayWidth / 2;
    
    for (let i = 0; i < numSpillways; i++) {
      const spillwayHeight = params.height * 0.95;
      const curvePoints: THREE.Vector3[] = [];
      const segments = 30;
      
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        const y = params.height * (1 - t);
        const parabolicDrop = Math.pow(t, 1.5);
        const z = params.bottomWidth / 2 + parabolicDrop * params.height * 0.4;
        curvePoints.push(new THREE.Vector3(0, y, z));
      }
      
      const curve = new THREE.CatmullRomCurve3(curvePoints);
      const tubeGeometry = new THREE.TubeGeometry(curve, 40, spillwayWidth * 0.4, 12, false);
      
      const spillwayMesh = new THREE.Mesh(tubeGeometry, spillwayMaterial.clone());
      spillwayMesh.position.x = spillwayStartX + i * spillwayWidth * 1.2;
      spillways.add(spillwayMesh);

      const sheetGeometry = new THREE.PlaneGeometry(spillwayWidth * 0.8, spillwayHeight, 20, 40);
      const sheetMaterial = spillwayMaterial.clone();
      (sheetMaterial as THREE.ShaderMaterial).uniforms.turbulence.value = volumetricFlow / 150;
      
      const sheetMesh = new THREE.Mesh(sheetGeometry, sheetMaterial);
      sheetMesh.position.set(
        spillwayStartX + i * spillwayWidth * 1.2,
        spillwayHeight / 2,
        params.bottomWidth / 2 + 2
      );
      spillways.add(sheetMesh);
    }
    
    scene.add(spillways);

    const splashMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        particleColor: { value: new THREE.Color(0xffffff) },
        flowRate: { value: volumetricFlow },
        velocity: { value: dischargeVelocity },
      },
      vertexShader: `
        uniform float time;
        uniform float flowRate;
        uniform float velocity;
        
        attribute float size;
        attribute float life;
        attribute vec3 velocity3;
        
        varying float vLife;
        varying float vSize;
        
        void main() {
          vLife = life;
          vSize = size;
          
          vec3 pos = position;
          
          float phase = fract(time * 0.5 + life);
          float gravity = 9.81;
          
          pos += velocity3 * phase * 2.0;
          pos.y -= 0.5 * gravity * phase * phase * 4.0;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z) * (1.0 - phase * 0.5);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 particleColor;
        
        varying float vLife;
        varying float vSize;
        
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          
          if (dist > 0.5) discard;
          
          float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
          alpha *= 0.7;
          
          gl_FragColor = vec4(particleColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const numParticles = Math.floor(1000 * (volumetricFlow / 100));
    const splashPositions = new Float32Array(numParticles * 3);
    const splashSizes = new Float32Array(numParticles);
    const splashLives = new Float32Array(numParticles);
    const splashVelocities = new Float32Array(numParticles * 3);
    
    const splashZoneWidth = params.length * 0.8;
    const splashZoneZ = params.bottomWidth / 2 + params.height * 0.3;
    
    for (let i = 0; i < numParticles; i++) {
      splashPositions[i * 3] = (Math.random() - 0.5) * splashZoneWidth;
      splashPositions[i * 3 + 1] = Math.random() * 5;
      splashPositions[i * 3 + 2] = splashZoneZ + Math.random() * 10;
      
      splashSizes[i] = 0.5 + Math.random() * 1.5;
      splashLives[i] = Math.random();
      
      splashVelocities[i * 3] = (Math.random() - 0.5) * 5;
      splashVelocities[i * 3 + 1] = 5 + Math.random() * dischargeVelocity * 0.5;
      splashVelocities[i * 3 + 2] = Math.random() * 3;
    }
    
    const splashGeometry = new THREE.BufferGeometry();
    splashGeometry.setAttribute('position', new THREE.BufferAttribute(splashPositions, 3));
    splashGeometry.setAttribute('size', new THREE.BufferAttribute(splashSizes, 1));
    splashGeometry.setAttribute('life', new THREE.BufferAttribute(splashLives, 1));
    splashGeometry.setAttribute('velocity3', new THREE.BufferAttribute(splashVelocities, 3));
    
    const splashParticles = new THREE.Points(splashGeometry, splashMaterial);
    scene.add(splashParticles);

    const mistMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        mistColor: { value: new THREE.Color(0xffffff) },
        flowRate: { value: volumetricFlow },
      },
      vertexShader: `
        uniform float time;
        uniform float flowRate;
        
        attribute float size;
        attribute float phase;
        
        varying float vAlpha;
        
        void main() {
          vec3 pos = position;
          
          float t = fract(time * 0.2 + phase);
          pos.y += t * 20.0;
          pos.x += sin(time * 0.5 + phase * 10.0) * 3.0;
          pos.z += cos(time * 0.3 + phase * 8.0) * 2.0;
          
          vAlpha = (1.0 - t) * 0.3;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (400.0 / -mvPosition.z) * (1.0 - t * 0.3);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 mistColor;
        
        varying float vAlpha;
        
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          
          float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * vAlpha;
          
          gl_FragColor = vec4(mistColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const numMistParticles = Math.floor(500 * (volumetricFlow / 100));
    const mistPositions = new Float32Array(numMistParticles * 3);
    const mistSizes = new Float32Array(numMistParticles);
    const mistPhases = new Float32Array(numMistParticles);
    
    const mistZoneWidth = params.length;
    const mistZoneZ = params.bottomWidth / 2 + params.height * 0.2;
    
    for (let i = 0; i < numMistParticles; i++) {
      mistPositions[i * 3] = (Math.random() - 0.5) * mistZoneWidth;
      mistPositions[i * 3 + 1] = Math.random() * 10;
      mistPositions[i * 3 + 2] = mistZoneZ + Math.random() * 20;
      
      mistSizes[i] = 3 + Math.random() * 5;
      mistPhases[i] = Math.random();
    }
    
    const mistGeometry = new THREE.BufferGeometry();
    mistGeometry.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
    mistGeometry.setAttribute('size', new THREE.BufferAttribute(mistSizes, 1));
    mistGeometry.setAttribute('phase', new THREE.BufferAttribute(mistPhases, 1));
    
    const mist = new THREE.Points(mistGeometry, mistMaterial);
    scene.add(mist);

    const poolLength = params.height * 0.8;
    const poolGeometry = new THREE.PlaneGeometry(params.length * 1.5, poolLength, 32, 32);
    poolGeometry.rotateX(-Math.PI / 2);
    
    const poolMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        waterColor: { value: new THREE.Color(0x2a7a9a) },
        foamColor: { value: new THREE.Color(0xffffff) },
        flowSpeed: { value: dischargeVelocity * 0.1 },
        turbulence: { value: volumetricFlow / 50 },
      },
      vertexShader: `
        uniform float time;
        uniform float flowSpeed;
        uniform float turbulence;
        
        varying vec2 vUv;
        varying vec3 vNormal;
        varying float vTurbulence;
        
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          
          vec3 pos = position;
          
          float distFromCenter = length(pos.xz) * 0.02;
          float wave = sin(distFromCenter * 10.0 - time * flowSpeed * 2.0) * turbulence * 0.5;
          wave += sin(pos.x * 0.2 + time * flowSpeed) * turbulence * 0.3;
          
          pos.y += wave;
          vTurbulence = abs(wave);
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 waterColor;
        uniform vec3 foamColor;
        uniform float time;
        uniform float flowSpeed;
        uniform float turbulence;
        
        varying vec2 vUv;
        varying vec3 vNormal;
        varying float vTurbulence;
        
        void main() {
          float foam = smoothstep(0.0, turbulence, vTurbulence);
          
          float ripples = sin((vUv.x + vUv.y) * 50.0 - time * flowSpeed * 3.0) * 0.5 + 0.5;
          ripples = pow(ripples, 4.0) * (1.0 - vUv.y);
          
          vec3 finalColor = mix(waterColor, foamColor, foam * 0.5 + ripples * 0.3);
          
          float fresnel = pow(1.0 - max(dot(vNormal, vec3(0.0, 1.0, 0.0)), 0.0), 2.0);
          finalColor += fresnel * 0.1;
          
          gl_FragColor = vec4(finalColor, 0.9);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
    
    const pool = new THREE.Mesh(poolGeometry, poolMaterial);
    pool.position.set(0, 2, params.bottomWidth / 2 + poolLength / 2 + params.height * 0.2);
    scene.add(pool);

    return {
      reservoir,
      spillways,
      splashParticles,
      mist,
      materials: {
        reservoir: reservoirMaterial,
        spillway: spillwayMaterial,
        splash: splashMaterial,
        mist: mistMaterial,
      },
    };
  }, [calculateFlowVelocity, calculateDischargeVelocity]);

  const updateWaterSystem = useCallback((waterSystem: WaterSystem, time: number, params: DamParameters) => {
    const flowVelocity = calculateFlowVelocity(params);
    const dischargeVelocity = calculateDischargeVelocity(params);
    const volumetricFlow = params.flowRate;

    waterSystem.materials.reservoir.uniforms.time.value = time;
    waterSystem.materials.reservoir.uniforms.flowSpeed.value = flowVelocity * 0.05;
    waterSystem.materials.reservoir.uniforms.waveIntensity.value = volumetricFlow / 200;
    waterSystem.materials.reservoir.uniforms.waterDepth.value = params.waterDepth;

    waterSystem.spillways.children.forEach((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.ShaderMaterial) {
        child.material.uniforms.time.value = time;
        child.material.uniforms.flowSpeed.value = dischargeVelocity * 0.3;
        child.material.uniforms.turbulence.value = volumetricFlow / 100;
      }
    });

    waterSystem.materials.splash.uniforms.time.value = time;
    waterSystem.materials.splash.uniforms.flowRate.value = volumetricFlow;
    waterSystem.materials.splash.uniforms.velocity.value = dischargeVelocity;

    waterSystem.materials.mist.uniforms.time.value = time;
    waterSystem.materials.mist.uniforms.flowRate.value = volumetricFlow;

    waterSystem.reservoir.position.y = params.waterDepth * 0.95;
    
    const reservoirScale = params.waterDepth / 50;
    waterSystem.reservoir.scale.y = Math.max(0.5, reservoirScale);
  }, [calculateFlowVelocity, calculateDischargeVelocity]);

  const removeWaterSystem = useCallback((scene: THREE.Scene, waterSystem: WaterSystem) => {
    scene.remove(waterSystem.reservoir);
    scene.remove(waterSystem.spillways);
    scene.remove(waterSystem.splashParticles);
    scene.remove(waterSystem.mist);
    
    scene.children
      .filter(child => child instanceof THREE.Mesh && child.geometry instanceof THREE.PlaneGeometry)
      .forEach(child => {
        if ((child as THREE.Mesh).material instanceof THREE.ShaderMaterial) {
          const mat = (child as THREE.Mesh).material as THREE.ShaderMaterial;
          if (mat.uniforms.turbulence) {
            scene.remove(child);
          }
        }
      });

    scene.children
      .filter(child => child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry)
      .forEach(child => {
        const mesh = child as THREE.Mesh;
        if (mesh.material instanceof THREE.MeshStandardMaterial && mesh.material.opacity === 0.6) {
          scene.remove(child);
        }
      });
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
        updateWaterSystem(waterSystemRef.current, elapsedTime, parametersRef.current);
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
        removeWaterSystem(sceneRef.current, waterSystemRef.current);
      }
      waterSystemRef.current = createWaterSystem(sceneRef.current, parameters);
    } else {
      if (waterSystemRef.current) {
        removeWaterSystem(sceneRef.current, waterSystemRef.current);
        waterSystemRef.current = null;
      }
    }
  }, [showWater, parameters, createWaterSystem, removeWaterSystem]);

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
