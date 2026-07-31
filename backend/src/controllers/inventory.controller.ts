import type { Request, Response } from "express";
import { InventoryService } from "../services/inventory.service.js";

const inventoryService = new InventoryService();

export class InventoryController {
  async getStatus(req: Request, res: Response) {
    try {
      const status = await inventoryService.getInventoryStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getForecast(req: Request, res: Response) {
    try {
      const productId = req.query.productId as string;
      const forecast = await inventoryService.getForecast(productId);
      res.json(forecast);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getRecommendations(req: Request, res: Response) {
    try {
      const productId = req.query.productId as string;
      const recommendations =
        await inventoryService.getRecommendations(productId);
      res.json(recommendations);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getForecastHistory(req: Request, res: Response) {
    try {
      const productId = req.query.productId as string;
      if (!productId) {
        return res.status(400).json({ error: "productId is required" });
      }
      const history = await inventoryService.getForecastHistory(productId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async seedForecastHistory(req: Request, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 14;
      const result = await inventoryService.seedBackdatedForecasts(days);
      res.json(result);
    } catch (error) {
      console.error("[seedForecastHistory] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async compareModels(req: Request, res: Response) {
    try {
      const productId = req.query.productId as string;
      if (!productId) {
        return res.status(400).json({ error: "productId is required" });
      }
      const comparison = await inventoryService.compareForecasts(productId);
      res.json(comparison);
    } catch (error) {
      console.error("[compareModels] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
