import type { DamResults } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/damCalculations";
import { 
  Zap, 
  Droplets, 
  Box, 
  Gauge, 
  Shield, 
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from "lucide-react";

interface ResultsPanelProps {
  results: DamResults;
}

interface ResultCardProps {
  title: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

function ResultCard({ title, value, unit, icon, highlight }: ResultCardProps) {
  return (
    <Card className={`p-4 transition-all duration-200 ${highlight ? 'ring-2 ring-primary/20' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground truncate" data-testid={`label-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {title}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-mono text-2xl font-semibold tracking-tight" data-testid={`value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </span>
            <span className="text-sm text-muted-foreground">{unit}</span>
          </div>
        </div>
        <div className="text-muted-foreground/60">
          {icon}
        </div>
      </div>
    </Card>
  );
}

export function ResultsPanel({ results }: ResultsPanelProps) {
  const safetyVariant = {
    safe: { badge: "default", icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-600 dark:text-green-400" },
    warning: { badge: "secondary", icon: <AlertTriangle className="h-4 w-4" />, color: "text-yellow-600 dark:text-yellow-400" },
    critical: { badge: "destructive", icon: <XCircle className="h-4 w-4" />, color: "text-red-600 dark:text-red-400" },
  }[results.safetyStatus];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">Calculation Results</h3>
        <Badge 
          variant={safetyVariant.badge as "default" | "secondary" | "destructive"} 
          className="flex items-center gap-1.5"
          data-testid="badge-safety-status"
        >
          {safetyVariant.icon}
          <span className="capitalize">{results.safetyStatus}</span>
          <span className="text-xs opacity-80">(SF: {results.stabilityFactor})</span>
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <ResultCard
          title="Cross-Section"
          value={formatNumber(results.crossSectionalArea, 1)}
          unit="m²"
          icon={<Box className="h-5 w-5" />}
        />
        <ResultCard
          title="Dam Volume"
          value={formatNumber(results.damVolume, 0)}
          unit="m³"
          icon={<Box className="h-5 w-5" />}
        />
        <ResultCard
          title="Concrete Needed"
          value={formatNumber(results.concreteNeeded, 0)}
          unit="m³"
          icon={<Box className="h-5 w-5" />}
        />
        <ResultCard
          title="Reservoir Volume"
          value={formatNumber(results.reservoirVolume, 0)}
          unit="m³"
          icon={<Droplets className="h-5 w-5" />}
        />
        <ResultCard
          title="Head Pressure"
          value={formatNumber(results.headPressure, 1)}
          unit="m"
          icon={<Gauge className="h-5 w-5" />}
        />
        <ResultCard
          title="Hydrostatic Force"
          value={formatNumber(results.hydrostaticForce, 0)}
          unit="N"
          icon={<Activity className="h-5 w-5" />}
        />
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Power Generation</h4>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <ResultCard
            title="Theoretical Power"
            value={formatNumber(results.theoreticalPower, 0)}
            unit="W"
            icon={<Zap className="h-5 w-5" />}
          />
          <ResultCard
            title="Actual Power"
            value={formatNumber(results.actualPower, 0)}
            unit="W"
            icon={<Zap className="h-5 w-5" />}
            highlight
          />
          <ResultCard
            title="Annual Energy"
            value={formatNumber(results.annualEnergy, 0)}
            unit="kWh"
            icon={<TrendingUp className="h-5 w-5" />}
            highlight
          />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Structural Analysis</h4>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <ResultCard
            title="Overturning Moment"
            value={formatNumber(results.overturningMoment, 0)}
            unit="N·m"
            icon={<Activity className="h-5 w-5" />}
          />
          <ResultCard
            title="Stability Factor"
            value={results.stabilityFactor.toFixed(2)}
            unit=""
            icon={<Shield className="h-5 w-5" />}
            highlight
          />
          <div className={`flex items-center justify-center p-4 rounded-lg border ${
            results.safetyStatus === 'safe' 
              ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
              : results.safetyStatus === 'warning'
              ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'
              : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="text-center">
              <div className={safetyVariant.color}>
                {safetyVariant.icon}
              </div>
              <p className={`text-sm font-medium mt-1 ${safetyVariant.color}`}>
                {results.safetyStatus === 'safe' 
                  ? 'Structure is stable' 
                  : results.safetyStatus === 'warning'
                  ? 'Review recommended'
                  : 'Redesign required'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
