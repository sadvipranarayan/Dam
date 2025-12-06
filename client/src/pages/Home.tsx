import { useState, useCallback, useRef } from "react";
import type { DamParameters } from "@shared/schema";
import { calculateDamResults } from "@/lib/damCalculations";
import { useAuth } from "@/hooks/useAuth";
import { DamViewer, type DamViewerRef } from "@/components/DamViewer";
import { ParametersPanel } from "@/components/ParametersPanel";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ExportPanel } from "@/components/ExportPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Waves, LogOut, User } from "lucide-react";

const defaultParameters: DamParameters = {
  topWidth: 10,
  bottomWidth: 50,
  height: 20,
  length: 200,
  reservoirLength: 1000,
  waterDepth: 20,
  flowRate: 20,
  efficiency: 0.85,
};

export default function Home() {
  const { user } = useAuth();
  const [parameters, setParameters] = useState<DamParameters>(defaultParameters);
  const results = calculateDamResults(parameters);
  const damViewerRef = useRef<DamViewerRef>(null);

  const handleParameterChange = useCallback((newParams: DamParameters) => {
    setParameters(newParams);
  }, []);

  const handleExportGLB = useCallback(() => {
    damViewerRef.current?.exportGLB();
  }, []);

  const userInitials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Waves className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">HydroSim</h1>
              <p className="text-xs text-muted-foreground">Dam Analysis Tool</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="relative h-9 w-9 rounded-full"
                  data-testid="button-user-menu"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage 
                      src={user?.profileImageUrl || undefined} 
                      alt={user?.firstName || "User"} 
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/api/logout" className="cursor-pointer" data-testid="button-logout">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4">
        <div className="grid lg:grid-cols-[360px_1fr] gap-6 h-[calc(100vh-100px)]">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4 pb-4">
              <ParametersPanel 
                parameters={parameters} 
                onChange={handleParameterChange} 
              />
              
              <ExportPanel 
                parameters={parameters}
                results={results}
                onExportGLB={handleExportGLB}
              />
            </div>
          </ScrollArea>

          <div className="flex flex-col gap-4 h-full min-h-0">
            <Card className="flex-1 min-h-[400px] overflow-hidden">
              <DamViewer 
                ref={damViewerRef}
                parameters={parameters}
              />
            </Card>

            <Card className="p-6 overflow-auto max-h-[400px]">
              <ResultsPanel results={results} />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
