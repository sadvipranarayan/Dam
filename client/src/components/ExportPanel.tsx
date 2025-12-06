import { useState } from "react";
import type { DamParameters, DamResults } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";

interface ExportPanelProps {
  parameters: DamParameters;
  results: DamResults;
  onExportGLB: () => void;
}

export function ExportPanel({ parameters, results, onExportGLB }: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const exportCSV = () => {
    setIsExporting("csv");
    
    const headers = [
      "Parameter/Result",
      "Value",
      "Unit"
    ];

    const rows = [
      ["Top Width (a)", parameters.topWidth.toString(), "m"],
      ["Bottom Width (b)", parameters.bottomWidth.toString(), "m"],
      ["Height (h)", parameters.height.toString(), "m"],
      ["Dam Length (L)", parameters.length.toString(), "m"],
      ["Reservoir Length", parameters.reservoirLength.toString(), "m"],
      ["Water Depth", parameters.waterDepth.toString(), "m"],
      ["Flow Rate (Q)", parameters.flowRate.toString(), "m³/s"],
      ["Efficiency (η)", (parameters.efficiency * 100).toString(), "%"],
      ["", "", ""],
      ["Cross-Sectional Area", results.crossSectionalArea.toString(), "m²"],
      ["Dam Volume", results.damVolume.toString(), "m³"],
      ["Concrete Needed", results.concreteNeeded.toString(), "m³"],
      ["Reservoir Volume", results.reservoirVolume.toString(), "m³"],
      ["Head Pressure", results.headPressure.toString(), "m"],
      ["Hydrostatic Force", results.hydrostaticForce.toString(), "N"],
      ["Theoretical Power", results.theoreticalPower.toString(), "W"],
      ["Actual Power", results.actualPower.toString(), "W"],
      ["Annual Energy", results.annualEnergy.toString(), "kWh"],
      ["Overturning Moment", results.overturningMoment.toString(), "N·m"],
      ["Stability Factor", results.stabilityFactor.toString(), ""],
      ["Safety Status", results.safetyStatus, ""],
    ];

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dam_simulation_data.csv";
    link.click();
    URL.revokeObjectURL(url);
    
    setIsExporting(null);
  };

  const exportPDF = async () => {
    setIsExporting("pdf");
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235);
    doc.text("HydroSim Dam Analysis Report", pageWidth / 2, y, { align: "center" });
    y += 15;

    // Date
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: "center" });
    y += 20;

    // Dam Geometry Section
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("Dam Geometry", 20, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const geometryData = [
      `Top Width (a): ${parameters.topWidth} m`,
      `Bottom Width (b): ${parameters.bottomWidth} m`,
      `Height (h): ${parameters.height} m`,
      `Dam Length (L): ${parameters.length} m`,
    ];
    geometryData.forEach(line => {
      doc.text(line, 25, y);
      y += 6;
    });
    y += 8;

    // Reservoir & Flow Section
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("Reservoir & Flow Parameters", 20, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const flowData = [
      `Reservoir Length: ${parameters.reservoirLength} m`,
      `Water Depth: ${parameters.waterDepth} m`,
      `Flow Rate (Q): ${parameters.flowRate} m³/s`,
      `Efficiency (η): ${Math.round(parameters.efficiency * 100)}%`,
    ];
    flowData.forEach(line => {
      doc.text(line, 25, y);
      y += 6;
    });
    y += 8;

    // Results Section
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("Calculation Results", 20, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const resultsData = [
      `Cross-Sectional Area: ${results.crossSectionalArea.toLocaleString()} m²`,
      `Dam Volume: ${results.damVolume.toLocaleString()} m³`,
      `Concrete Needed: ${results.concreteNeeded.toLocaleString()} m³`,
      `Reservoir Volume: ${results.reservoirVolume.toLocaleString()} m³`,
      `Head Pressure: ${results.headPressure} m`,
      `Hydrostatic Force: ${results.hydrostaticForce.toLocaleString()} N`,
    ];
    resultsData.forEach(line => {
      doc.text(line, 25, y);
      y += 6;
    });
    y += 8;

    // Power Generation Section
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("Power Generation", 20, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const powerData = [
      `Theoretical Power: ${results.theoreticalPower.toLocaleString()} W`,
      `Actual Power: ${results.actualPower.toLocaleString()} W`,
      `Annual Energy Production: ${results.annualEnergy.toLocaleString()} kWh`,
    ];
    powerData.forEach(line => {
      doc.text(line, 25, y);
      y += 6;
    });
    y += 8;

    // Structural Analysis Section
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("Structural Analysis", 20, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const structuralData = [
      `Overturning Moment: ${results.overturningMoment.toLocaleString()} N·m`,
      `Stability Factor: ${results.stabilityFactor}`,
    ];
    structuralData.forEach(line => {
      doc.text(line, 25, y);
      y += 6;
    });
    y += 4;

    // Safety Status
    const statusColor = results.safetyStatus === "safe" 
      ? [34, 197, 94] 
      : results.safetyStatus === "warning" 
      ? [245, 158, 11] 
      : [239, 68, 68];
    
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.setFontSize(12);
    doc.text(`Safety Status: ${results.safetyStatus.toUpperCase()}`, 25, y);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("HydroSim - Hydropower Dam Analysis Tool", pageWidth / 2, 285, { align: "center" });

    doc.save("dam_analysis_report.pdf");
    setIsExporting(null);
  };

  return (
    <Card className="p-4">
      <h4 className="text-sm font-medium mb-3">Export Options</h4>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onExportGLB}
          disabled={!!isExporting}
          data-testid="button-export-model"
        >
          <Download className="h-4 w-4 mr-2" />
          3D Model
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={exportCSV}
          disabled={!!isExporting}
          data-testid="button-export-csv"
        >
          {isExporting === "csv" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4 mr-2" />
          )}
          CSV Data
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={exportPDF}
          disabled={!!isExporting}
          data-testid="button-export-pdf"
        >
          {isExporting === "pdf" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}
          PDF Report
        </Button>
      </div>
    </Card>
  );
}
