import type { Request, Response } from "express";
import { SimulationService } from "../services/simulation.service.js";

const simulationService = new SimulationService();

export class SimulationController {
  async simulate(req: Request, res: Response) {
    try {
      const result = await simulationService.simulateData();
      res.json(result);
    } catch (error) {
      console.error("Simulation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
