import type { Request, Response } from "express";
import { VendorService } from "../services/vendor.service.js";
import { VendorSchema } from "../lib/validation.js";

const vendorService = new VendorService();

export class VendorController {
  async getAll(req: Request, res: Response) {
    try {
      const vendors = await vendorService.getAll();
      res.json(vendors);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const validatedData = VendorSchema.parse(req.body);
      const { name, contactEmail } = validatedData;
      const vendor = await vendorService.create({
        name,
        ...(contactEmail ? { contactEmail } : {}),
      } as any);
      res.status(201).json(vendor);
    } catch (error: any) {
      res.status(400).json({ error: error.message || error });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const vendor = await vendorService.getById(id as string);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      res.json(vendor);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await vendorService.delete(id as string);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validatedData = VendorSchema.partial().parse(req.body);
      const vendor = await vendorService.update(
        id as string,
        validatedData as any,
      );
      res.json(vendor);
    } catch (error: any) {
      res.status(400).json({ error: error.message || error });
    }
  }
}
