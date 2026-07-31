import prisma from "../lib/prisma.js";
import axios from "axios";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";

export class InventoryService {
  async getInventoryStatus() {
    return (prisma as any).inventory.findMany({
      include: {
        product: {
          include: {
            vendors: { include: { vendor: true } },
          },
        },
      },
    });
  }

  async generateForecast(productId: string) {
    try {
      // Step 0: Anti-Spam Safeguard (Check for recent run in last 1 hour)
      const recentRun = await (prisma as any).forecastRun.findFirst({
        where: {
          productId,
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        include: { forecasts: true },
        orderBy: { createdAt: "desc" },
      });

      if (recentRun && recentRun.forecasts && recentRun.forecasts.length > 0) {
        console.log(
          `[InventoryService] Reusing recent run ${recentRun.id} for product ${productId}`,
        );

        // Still gather real sales history so the dashboard can show the blue line
        const orderItems = await (prisma as any).orderItem.findMany({
          where: { productId },
          include: { order: true },
          orderBy: { order: { date: "asc" } },
        });
        const salesMap = new Map<string, number>();
        orderItems.forEach((item: any) => {
          const d = item.order.date.toISOString().split("T")[0]!;
          salesMap.set(d, (salesMap.get(d) || 0) + item.quantity);
        });
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const start = new Date(today);
        start.setUTCDate(today.getUTCDate() - 30);
        const historicalSales: { date: string; quantity: number }[] = [];
        for (
          let d = new Date(start);
          d <= today;
          d.setUTCDate(d.getUTCDate() + 1)
        ) {
          const dStr = d.toISOString().split("T")[0]!;
          historicalSales.push({
            date: dStr,
            quantity: salesMap.get(dStr) || 0,
          });
        }

        const recommendations = await this.calculateRecommendations(productId, {
          daily_predictions: recentRun.forecasts.map((f: any) => ({
            date: f.date,
            value: f.predictedDemand,
          })),
        });
        return {
          productId,
          forecastRunId: recentRun.id,
          daily_predictions: recentRun.forecasts.map((f: any) => ({
            date: f.date.toISOString().split("T")[0]!,
            value: f.predictedDemand,
          })),
          recommendations,
          historical_sales: historicalSales,
          is_reused: true,
        };
      }

      // 1. Fetch historical order data (UTC)
      const orderItems = await (prisma as any).orderItem.findMany({
        where: { productId },
        include: { order: true },
        orderBy: { order: { date: "asc" } },
      });

      // 2. Preprocessing: Aggregation & Zero-Filling (Local to UTC)
      const salesMap = new Map<string, number>();
      orderItems.forEach((item: any) => {
        const dateStr = item.order.date.toISOString().split("T")[0]!; // UTC Day
        salesMap.set(dateStr, (salesMap.get(dateStr) || 0) + item.quantity);
      });

      // Maintain last 60-90 days timeline
      const salesData: { date: string; quantity: number }[] = [];
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const start = new Date(today);
      start.setUTCDate(today.getUTCDate() - 60);

      for (
        let d = new Date(start);
        d <= today;
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        const dStr = d.toISOString().split("T")[0]!;
        salesData.push({
          date: dStr,
          quantity: salesMap.get(dStr) || 0,
        });
      }

      // Step 12: Edge Case - Insufficient history
      if (salesData.filter((s) => s.quantity > 0).length < 5) {
        return this.getFallbackForecast(productId);
      }

      // 3. Inference from stateless ML Service
      let forecastData;
      try {
        const response = await axios.post(`${ML_SERVICE_URL}/ml/forecast`, {
          productId,
          salesData: salesData.sort((a, b) => a.date.localeCompare(b.date)),
        });
        forecastData = response.data;
      } catch (e) {
        console.error("[InventoryService] ML Service failed:", e);
        return this.getFallbackForecast(productId);
      }

      // 4. Persistence: Create Run and Normalized Forecasts
      const run = await (prisma as any).forecastRun.create({
        data: {
          productId,
          modelVersion: "1.0.0",
          notes: "Auto-generated daily run",
        },
      });

      const predictions = forecastData.daily_predictions.map((p: any) => ({
        productId,
        forecastRunId: run.id,
        date: new Date(p.date as string),
        predictedDemand: p.value as number,
      }));

      await (prisma as any).forecast.createMany({ data: predictions });

      // 5. Update Inventory Recommendations
      const recommendations = await this.calculateRecommendations(
        productId,
        forecastData,
      );

      return {
        productId,
        forecastRunId: run.id,
        daily_predictions: forecastData.daily_predictions,
        recommendations,
        historical_sales: salesData.slice(-30),
      };
    } catch (error) {
      console.error("[InventoryService] Error:", error);
      throw error;
    }
  }

  private async getFallbackForecast(productId: string) {
    const run = await (prisma as any).forecastRun.create({
      data: {
        productId,
        modelVersion: "fallback",
        notes: "Low history fallback",
      },
    });

    const tomorrow = new Date();
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const fallbackPredictions = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(tomorrow);
      d.setUTCDate(tomorrow.getUTCDate() + i);
      const dStr = d.toISOString().split("T")[0]!;
      return {
        date: dStr,
        value: 5.0,
      };
    });

    await (prisma as any).forecast.createMany({
      data: fallbackPredictions.map((p) => ({
        productId,
        forecastRunId: run.id,
        date: new Date(p.date),
        predictedDemand: p.value,
      })),
    });

    const recommendations = await this.calculateRecommendations(productId, {
      daily_predictions: fallbackPredictions,
    });

    return {
      productId,
      forecastRunId: run.id,
      daily_predictions: fallbackPredictions,
      recommendations,
      is_fallback: true,
    };
  }

  async getForecastHistory(productId: string) {
    const forecasts = await (prisma as any).forecast.findMany({
      where: { productId },
      orderBy: { date: "asc" },
      take: 500,
    });

    const orderItems = await (prisma as any).orderItem.findMany({
      where: { productId },
      include: { order: true },
    });

    const salesMap = new Map<string, number>();
    orderItems.forEach((item: any) => {
      const dateStr = item.order.date.toISOString().split("T")[0]!;
      salesMap.set(dateStr, (salesMap.get(dateStr) || 0) + item.quantity);
    });

    return {
      productId,
      data: forecasts.map((f: any) => {
        const dStr = f.date.toISOString().split("T")[0]!;
        return {
          date: dStr,
          predictedDemand: f.predictedDemand,
          actualDemand: salesMap.get(dStr) ?? null,
          runId: f.forecastRunId,
        };
      }),
    };
  }

  async calculateRecommendations(productId: string, forecastData: any) {
    const inventory = (await (prisma as any).inventory.findUnique({
      where: { productId },
    })) as any;

    if (!inventory) throw new Error("Inventory record not found");

    const totalDemand = forecastData.daily_predictions.reduce(
      (s: number, p: any) => s + p.value,
      0,
    );
    const avgDailyDemand = totalDemand / 30;

    const reorderLevel =
      avgDailyDemand * (inventory.leadTime || 7) + (inventory.safetyStock || 0);
    const recommendedStock = reorderLevel + avgDailyDemand * 7; // 1 week buffer

    const updated = (await (prisma as any).inventory.update({
      where: { productId },
      data: { reorderLevel: Math.ceil(reorderLevel) },
    })) as any;

    return {
      avgDailyDemand: parseFloat(avgDailyDemand.toFixed(2)),
      reorderLevel: updated.reorderLevel,
      recommendedStock: Math.ceil(recommendedStock),
      daysUntilStockout:
        avgDailyDemand > 0
          ? Math.floor(inventory.currentStock / avgDailyDemand)
          : 999,
      leadTime: updated.leadTime,
      safetyStock: updated.safetyStock,
    };
  }

  async getForecast(productId: string) {
    return this.generateForecast(productId);
  }

  async getRecommendations(productId: string) {
    const res = await this.generateForecast(productId);
    return (res as any).recommendations;
  }

  /**
   * DEV / DEMO ONLY: Seeds backdated ForecastRun records for the past N days.
   * This lets developers see both the blue (actual) and green (predicted) lines
   * overlapping on the chart without waiting for days of real runs.
   *
   * This method does NOT modify orders, products, or any core data.
   * It only inserts synthetic ForecastRun + Forecast rows.
   */
  async seedBackdatedForecasts(days: number = 14) {
    const allInventory = await (prisma as any).inventory.findMany({
      include: { product: true },
    });

    const seededRuns: string[] = [];

    for (const inv of allInventory) {
      const productId = inv.productId as string;

      // Fetch all actual orders for this product to build a baseline
      const orderItems = await (prisma as any).orderItem.findMany({
        where: { productId },
        include: { order: true },
      });

      const salesMap = new Map<string, number>();
      orderItems.forEach((item: any) => {
        const d = item.order.date.toISOString().split("T")[0]!;
        salesMap.set(d, (salesMap.get(d) || 0) + item.quantity);
      });

      // For each of the past N days, create a synthetic run & predictions
      for (let i = days; i >= 1; i--) {
        const runDate = new Date();
        runDate.setUTCHours(0, 0, 0, 0);
        runDate.setUTCDate(runDate.getUTCDate() - i);

        const runDateStr = runDate.toISOString().split("T")[0]!;

        // Check if a run already exists near this date (within same day)
        const existing = await (prisma as any).forecastRun.findFirst({
          where: {
            productId,
            createdAt: {
              gte: new Date(runDateStr),
              lt: new Date(
                new Date(runDateStr).setUTCDate(
                  new Date(runDateStr).getUTCDate() + 1,
                ),
              ),
            },
          },
        });
        if (existing) continue; // Skip if already seeded

        // Calculate a simple avg from the 30 days before this run date
        const lookbackSales: number[] = [];
        for (let lb = 30; lb >= 1; lb--) {
          const d = new Date(runDate);
          d.setUTCDate(d.getUTCDate() - lb);
          const dStr = d.toISOString().split("T")[0]!;
          lookbackSales.push(salesMap.get(dStr) || 0);
        }
        const avgSale =
          lookbackSales.reduce((a, b) => a + b, 0) /
          Math.max(lookbackSales.filter((v) => v > 0).length, 1);

        // Create the backdated run record
        const run = await (prisma as any).forecastRun.create({
          data: {
            productId,
            modelVersion: "seeded-demo",
            notes: `Backdated demo seed for ${runDateStr}`,
            createdAt: runDate,
          },
        });

        // Generate 30-day predictions from this run date
        const predictions = Array.from({ length: 30 }, (_, k) => {
          const predDate = new Date(runDate);
          predDate.setUTCDate(runDate.getUTCDate() + k + 1);
          const trendNoise = 1 + (Math.random() * 0.1 - 0.05); // ±5% noise
          return {
            productId,
            forecastRunId: run.id,
            date: predDate,
            predictedDemand: Math.max(0, avgSale * trendNoise),
            createdAt: runDate,
          };
        });

        await (prisma as any).forecast.createMany({ data: predictions });
        seededRuns.push(run.id);
      }
    }

    return {
      message: `Seeded ${seededRuns.length} backdated forecast runs across ${allInventory.length} products.`,
      runsCreated: seededRuns.length,
      productsSeeded: allInventory.length,
    };
  }

  async compareForecasts(productId: string) {
    const orderItems = await (prisma as any).orderItem.findMany({
      where: { productId },
      include: { order: true },
      orderBy: { order: { date: "asc" } },
    });

    const salesMap = new Map<string, number>();
    orderItems.forEach((item: any) => {
      const dateStr = item.order.date.toISOString().split("T")[0]!;
      salesMap.set(dateStr, (salesMap.get(dateStr) || 0) + item.quantity);
    });

    const salesData: { date: string; quantity: number }[] = [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const start = new Date(today);
    start.setUTCDate(today.getUTCDate() - 60);

    for (
      let d = new Date(start);
      d <= today;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const dStr = d.toISOString().split("T")[0]!;
      salesData.push({
        date: dStr,
        quantity: salesMap.get(dStr) || 0,
      });
    }

    try {
      const response = await axios.post(`${ML_SERVICE_URL}/ml/compare`, {
        productId,
        salesData: salesData.sort((a, b) => a.date.localeCompare(b.date)),
      });
      return response.data;
    } catch (e) {
      console.error("[InventoryService] ML Compare failed, using high-quality simulation fallback:", e);
      return this.getMockComparison(productId, salesData);
    }
  }

  private getMockComparison(productId: string, salesData: any[]) {
    const models = [
      { key: "lr", name: "Linear Regression", mae: 5.2, rmse: 6.8, mape: 12.5, r2: 0.15, latency: 1.2, info: "Fits a straight line indicating long-term growth or decline trend." },
      { key: "xgboost", name: "XGBoost", mae: 3.1, rmse: 4.2, mape: 8.3, r2: 0.65, latency: 15.4, info: "Gradient boosted decision trees that model complex non-linear lag correlations." },
      { key: "lightgbm", name: "LightGBM", mae: 3.3, rmse: 4.4, mape: 8.8, r2: 0.62, latency: 8.2, info: "Highly efficient histogram-based tree booster designed for scale." },
      { key: "prophet", name: "Prophet", mae: 2.8, rmse: 3.9, mape: 7.5, r2: 0.71, latency: 125.0, info: "Meta's additive model capturing holiday effects and seasonal cycles." },
      { key: "lstm", name: "LSTM", mae: 3.5, rmse: 4.7, mape: 9.1, r2: 0.58, latency: 310.5, info: "Recurrent neural network capable of learning sequence history." },
      { key: "tft", name: "TFT", mae: 2.6, rmse: 3.6, mape: 6.9, r2: 0.74, latency: 450.2, info: "Multi-horizon transformer network applying self-attention." },
      { key: "timesfm", name: "TimesFM", mae: 2.4, rmse: 3.3, mape: 6.2, r2: 0.78, latency: 680.0, info: "Google's pre-trained Zero-Shot Time-Series foundation model." },
    ];

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const modelResults = models.map((m) => {
      const preds = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today);
        d.setUTCDate(today.getUTCDate() + i + 1);
        const dayIdx = i + 60;
        let baseVal = 15 + Math.sin(dayIdx * (2 * Math.PI / 7)) * 3;
        if (m.key === "lr") baseVal = 15 + dayIdx * 0.05;
        else if (m.key === "timesfm") baseVal += Math.sin(dayIdx * (2 * Math.PI / 30)) * 2;
        
        const noise = (Math.random() - 0.5) * (m.mae * 0.5);
        return {
          date: d.toISOString().split("T")[0]!,
          value: parseFloat(Math.max(0, baseVal + noise).toFixed(2)),
        };
      });

      return {
        model_key: m.key,
        model_name: m.name,
        status: "simulated",
        info: m.info,
        next_30_days: parseFloat(preds.reduce((sum, p) => sum + p.value, 0).toFixed(2)),
        daily_predictions: preds,
        metrics: {
          mae: m.mae,
          rmse: m.rmse,
          mape: m.mape,
          r2: m.r2,
        },
        latency_ms: m.latency,
        trend: m.key === "lr" ? "increasing" : "stable",
      };
    });

    return {
      productId,
      historical_sales: salesData,
      models: modelResults,
    };
  }
}
