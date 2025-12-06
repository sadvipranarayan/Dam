import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  Waves, 
  Zap, 
  Shield, 
  BarChart3, 
  Box, 
  Download,
  ArrowRight,
  Lock
} from "lucide-react";

const features = [
  {
    icon: <Box className="h-6 w-6" />,
    title: "Interactive 3D Visualization",
    description: "View and manipulate dam geometry in real-time with our advanced Three.js powered 3D viewer."
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: "Power Generation Analysis",
    description: "Calculate theoretical and actual power output, annual energy production with adjustable efficiency."
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Structural Stability",
    description: "Evaluate hydrostatic forces, overturning moments, and safety factors for dam design."
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: "Comprehensive Results",
    description: "Get detailed calculations including dam volume, reservoir capacity, and concrete requirements."
  },
  {
    icon: <Waves className="h-6 w-6" />,
    title: "Reservoir Modeling",
    description: "Configure water depth, flow rates, and reservoir dimensions for accurate simulations."
  },
  {
    icon: <Download className="h-6 w-6" />,
    title: "Export Capabilities",
    description: "Download 3D models (GLB), data exports (CSV), and professional PDF reports."
  }
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Waves className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">HydroSim</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild data-testid="button-login-header">
              <a href="/api/login">
                <Lock className="h-4 w-4 mr-2" />
                Sign In
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div 
            className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-blue-500/10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%232563eb' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
          <div className="max-w-6xl mx-auto px-6 py-24 md:py-32 relative">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                Hydropower Dam
                <span className="text-primary"> Analysis</span>
                <br />Made Simple
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl">
                Professional-grade 3D dam simulation tool for engineers. Design, analyze, and optimize 
                hydropower dam structures with real-time calculations and interactive visualization.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" asChild data-testid="button-get-started">
                  <a href="/api/login">
                    Get Started
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild data-testid="button-learn-more">
                  <a href="#features">Learn More</a>
                </Button>
              </div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-6 pb-12">
            <Card className="p-4 bg-card/50 backdrop-blur overflow-hidden">
              <div className="aspect-[16/9] bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-950 dark:to-blue-900 rounded-lg flex items-center justify-center">
                <div className="text-center p-8">
                  <Box className="h-16 w-16 mx-auto mb-4 text-primary/60" />
                  <p className="text-lg font-medium text-muted-foreground">
                    Interactive 3D Dam Visualization
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Sign in to access the full simulator
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section id="features" className="py-20 bg-muted/30">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Powerful Engineering Tools
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need for comprehensive hydropower dam analysis and design
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card 
                  key={index} 
                  className="p-6"
                  data-testid={`card-feature-${index}`}
                >
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Built for Engineering Precision
                </h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    HydroSim combines advanced 3D visualization with rigorous engineering 
                    calculations to help you design safer, more efficient hydropower dams.
                  </p>
                  <p>
                    Our real-time analysis engine calculates power generation potential, 
                    structural stability factors, and reservoir characteristics as you 
                    adjust parameters.
                  </p>
                  <p>
                    Export your designs as industry-standard GLB files, detailed CSV data, 
                    or professional PDF reports ready for presentations and documentation.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <Card className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-medium">Safety Factor Analysis</p>
                    <p className="text-sm text-muted-foreground">Automatic stability calculations</p>
                  </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-medium">Power Generation</p>
                    <p className="text-sm text-muted-foreground">Real-time energy calculations</p>
                  </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <Box className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-medium">3D Model Export</p>
                    <p className="text-sm text-muted-foreground">GLB format for CAD integration</p>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-primary text-primary-foreground">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <Lock className="h-12 w-12 mx-auto mb-6 opacity-80" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Private & Secure
            </h2>
            <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
              Your dam designs and simulation data are kept completely private. 
              Sign in to access your personal workspace.
            </p>
            <Button 
              size="lg" 
              variant="secondary" 
              asChild
              data-testid="button-cta-signin"
            >
              <a href="/api/login">
                Sign In to Start
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-muted-foreground">
          <p>HydroSim - Hydropower Dam Analysis Tool</p>
          <p className="text-sm mt-2">Private access only. All data processed locally.</p>
        </div>
      </footer>
    </div>
  );
}
