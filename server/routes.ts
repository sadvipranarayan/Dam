import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/simulations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const simulations = await storage.getSimulationsByUser(userId);
      res.json(simulations);
    } catch (error) {
      console.error("Error fetching simulations:", error);
      res.status(500).json({ message: "Failed to fetch simulations" });
    }
  });

  app.post("/api/simulations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, parameters, results } = req.body;
      
      const simulation = await storage.createSimulation({
        userId,
        name,
        parameters,
        results,
      });
      
      res.json(simulation);
    } catch (error) {
      console.error("Error creating simulation:", error);
      res.status(500).json({ message: "Failed to create simulation" });
    }
  });

  app.delete("/api/simulations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const simulation = await storage.getSimulation(id);
      
      if (!simulation) {
        return res.status(404).json({ message: "Simulation not found" });
      }
      
      if (simulation.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      await storage.deleteSimulation(id);
      res.json({ message: "Simulation deleted" });
    } catch (error) {
      console.error("Error deleting simulation:", error);
      res.status(500).json({ message: "Failed to delete simulation" });
    }
  });

  return httpServer;
}
