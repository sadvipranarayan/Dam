import { useState, useEffect } from "react";
import type { DamParameters } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { 
  Ruler, 
  ArrowUpDown, 
  Droplets, 
  Gauge, 
  Percent,
  Move3d
} from "lucide-react";

interface ParametersPanelProps {
  parameters: DamParameters;
  onChange: (params: DamParameters) => void;
}

interface NumberInputProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit: string;
  icon?: React.ReactNode;
}

function NumberInput({ id, label, value, onChange, min = 0.01, max = 10000, step = 1, unit, icon }: NumberInputProps) {
  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleBlur = () => {
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue) && numValue >= min && numValue <= max) {
      onChange(numValue);
    } else {
      setInputValue(value.toString());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          min={min}
          max={max}
          step={step}
          className="pr-12 font-mono"
          data-testid={`input-${id}`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  );
}

export function ParametersPanel({ parameters, onChange }: ParametersPanelProps) {
  const updateParam = <K extends keyof DamParameters>(key: K, value: DamParameters[K]) => {
    onChange({ ...parameters, [key]: value });
  };

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Move3d className="h-5 w-5 text-primary" />
          Dam Geometry
        </h3>
        <div className="grid gap-4">
          <NumberInput
            id="topWidth"
            label="Top Width (a)"
            value={parameters.topWidth}
            onChange={(v) => updateParam("topWidth", v)}
            min={0.1}
            max={100}
            step={0.1}
            unit="m"
            icon={<Ruler className="h-4 w-4" />}
          />
          <NumberInput
            id="bottomWidth"
            label="Bottom Width (b)"
            value={parameters.bottomWidth}
            onChange={(v) => updateParam("bottomWidth", v)}
            min={0.1}
            max={200}
            step={0.1}
            unit="m"
            icon={<Ruler className="h-4 w-4" />}
          />
          <NumberInput
            id="height"
            label="Height (h)"
            value={parameters.height}
            onChange={(v) => updateParam("height", v)}
            min={0.1}
            max={300}
            step={0.1}
            unit="m"
            icon={<ArrowUpDown className="h-4 w-4" />}
          />
          <NumberInput
            id="length"
            label="Dam Length (L)"
            value={parameters.length}
            onChange={(v) => updateParam("length", v)}
            min={1}
            max={2000}
            step={1}
            unit="m"
            icon={<Ruler className="h-4 w-4" />}
          />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Droplets className="h-5 w-5 text-blue-500" />
          Reservoir & Flow
        </h3>
        <div className="grid gap-4">
          <NumberInput
            id="reservoirLength"
            label="Reservoir Length"
            value={parameters.reservoirLength}
            onChange={(v) => updateParam("reservoirLength", v)}
            min={10}
            max={50000}
            step={10}
            unit="m"
            icon={<Ruler className="h-4 w-4" />}
          />
          <NumberInput
            id="waterDepth"
            label="Water Depth"
            value={parameters.waterDepth}
            onChange={(v) => updateParam("waterDepth", v)}
            min={0.1}
            max={300}
            step={0.1}
            unit="m"
            icon={<Droplets className="h-4 w-4" />}
          />
          <NumberInput
            id="flowRate"
            label="Flow Rate (Q)"
            value={parameters.flowRate}
            onChange={(v) => updateParam("flowRate", v)}
            min={0.1}
            max={10000}
            step={1}
            unit="m³/s"
            icon={<Gauge className="h-4 w-4" />}
          />
          
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Percent className="h-4 w-4" />
              Efficiency (η)
            </Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[parameters.efficiency * 100]}
                onValueChange={(v) => updateParam("efficiency", v[0] / 100)}
                min={1}
                max={100}
                step={1}
                className="flex-1"
                data-testid="slider-efficiency"
              />
              <span className="font-mono text-sm w-12 text-right">
                {Math.round(parameters.efficiency * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
