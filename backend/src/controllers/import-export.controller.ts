import type { Request, Response } from "express";
import { ImportExportService } from "../services/import-export.service.js";

const importExportService = new ImportExportService();

export class ImportExportController {
  async importProducts(req: Request, res: Response) {
    try {
      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileType = file.originalname.endsWith(".csv") ? "csv" : "excel";
      const results = await importExportService.importProducts(
        file.buffer,
        fileType,
      );

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async exportProducts(req: Request, res: Response) {
    try {
      const csv = await importExportService.exportProducts();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=products_export_${new Date().toISOString().split("T")[0]}.csv`,
      );
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getSampleFile(req: Request, res: Response) {
    try {
      const csv = importExportService.getSampleCSV();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=products_sample.csv",
      );
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ── VENDORS ───────────────────────────────────────────────────
  async importVendors(req: Request, res: Response) {
    try {
      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileType = file.originalname.endsWith(".csv") ? "csv" : "excel";
      const results = await importExportService.importVendors(
        file.buffer,
        fileType,
      );
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async exportVendors(req: Request, res: Response) {
    try {
      const csv = await importExportService.exportVendors();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=vendors_export_${new Date().toISOString().split("T")[0]}.csv`,
      );
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getVendorSampleFile(req: Request, res: Response) {
    try {
      const csv = importExportService.getVendorSampleCSV();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=vendors_sample.csv",
      );
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ── ORDERS ────────────────────────────────────────────────────
  async importOrders(req: Request, res: Response) {
    try {
      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileType = file.originalname.endsWith(".csv") ? "csv" : "excel";
      const results = await importExportService.importOrders(
        file.buffer,
        fileType,
      );
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async exportOrders(req: Request, res: Response) {
    try {
      const csv = await importExportService.exportOrders();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=orders_export_${new Date().toISOString().split("T")[0]}.csv`,
      );
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getOrderSampleFile(req: Request, res: Response) {
    try {
      const csv = importExportService.getOrderSampleCSV();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=orders_sample.csv",
      );
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ── INVENTORY ─────────────────────────────────────────────────
  async importInventory(req: Request, res: Response) {
    try {
      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileType = file.originalname.endsWith(".csv") ? "csv" : "excel";
      const results = await importExportService.importInventory(
        file.buffer,
        fileType,
      );
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async exportInventory(req: Request, res: Response) {
    try {
      const csv = await importExportService.exportInventory();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=inventory_export_${new Date().toISOString().split("T")[0]}.csv`,
      );
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getInventorySampleFile(req: Request, res: Response) {
    try {
      const csv = importExportService.getInventorySampleCSV();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=inventory_sample.csv",
      );
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
