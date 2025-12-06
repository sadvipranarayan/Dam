import type { DamParameters, DamResults } from "@shared/schema";

const GRAVITY = 9.81; // m/s²
const WATER_DENSITY = 1000; // kg/m³
const CONCRETE_DENSITY = 2400; // kg/m³
const HOURS_PER_YEAR = 8760;

export function calculateDamResults(params: DamParameters): DamResults {
  const { topWidth, bottomWidth, height, length, reservoirLength, waterDepth, flowRate, efficiency } = params;

  // Cross-sectional area (trapezoidal)
  const crossSectionalArea = ((topWidth + bottomWidth) / 2) * height;

  // Dam volume
  const damVolume = crossSectionalArea * length;

  // Concrete needed (in cubic meters, accounting for ~5% waste)
  const concreteNeeded = damVolume * 1.05;

  // Reservoir volume (simplified as rectangular)
  const reservoirVolume = reservoirLength * length * waterDepth;

  // Head pressure (water depth)
  const headPressure = waterDepth;

  // Theoretical power: P = ρ * g * Q * H (Watts)
  const theoreticalPower = WATER_DENSITY * GRAVITY * flowRate * headPressure;

  // Actual power with efficiency
  const actualPower = theoreticalPower * efficiency;

  // Annual energy production (kWh)
  const annualEnergy = (actualPower / 1000) * HOURS_PER_YEAR;

  // Hydrostatic force: F = 0.5 * ρ * g * h² * L
  const hydrostaticForce = 0.5 * WATER_DENSITY * GRAVITY * Math.pow(waterDepth, 2) * length;

  // Overturning moment: M = F * h/3 (force acts at 1/3 height from base)
  const overturningMoment = hydrostaticForce * (waterDepth / 3);

  // Weight of dam
  const damWeight = damVolume * CONCRETE_DENSITY * GRAVITY;

  // Restoring moment: M_r = W * (2/3 * b) for trapezoidal section
  const centroidFromToe = (bottomWidth * (bottomWidth + 2 * topWidth)) / (3 * (topWidth + bottomWidth));
  const restoringMoment = damWeight * centroidFromToe;

  // Stability factor (factor of safety against overturning)
  const stabilityFactor = restoringMoment / (overturningMoment || 1);

  // Safety status
  let safetyStatus: 'safe' | 'warning' | 'critical';
  if (stabilityFactor >= 2.0) {
    safetyStatus = 'safe';
  } else if (stabilityFactor >= 1.5) {
    safetyStatus = 'warning';
  } else {
    safetyStatus = 'critical';
  }

  return {
    crossSectionalArea: Math.round(crossSectionalArea * 100) / 100,
    damVolume: Math.round(damVolume * 100) / 100,
    concreteNeeded: Math.round(concreteNeeded * 100) / 100,
    reservoirVolume: Math.round(reservoirVolume),
    headPressure: Math.round(headPressure * 100) / 100,
    theoreticalPower: Math.round(theoreticalPower),
    actualPower: Math.round(actualPower),
    annualEnergy: Math.round(annualEnergy),
    hydrostaticForce: Math.round(hydrostaticForce),
    overturningMoment: Math.round(overturningMoment),
    stabilityFactor: Math.round(stabilityFactor * 100) / 100,
    safetyStatus,
  };
}

export function formatNumber(value: number, decimals: number = 0): string {
  if (value >= 1e9) {
    return (value / 1e9).toFixed(decimals) + ' B';
  } else if (value >= 1e6) {
    return (value / 1e6).toFixed(decimals) + ' M';
  } else if (value >= 1e3) {
    return (value / 1e3).toFixed(decimals) + ' K';
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals });
}
