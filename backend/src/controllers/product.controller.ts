import type { Request, Response } from "express";
import { ProductService } from "../services/product.service.js";
import { ProductSchema, UpdateProductSchema } from "../lib/validation.js";

const productService = new ProductService();

export class ProductController {
  async getAll(req: Request, res: Response) {
    try {
      const { page, limit, search, category, sortBy, sortOrder } = req.query;
      const result = await productService.getAll({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: (search as string) || undefined,
        category: (category as string) || undefined,
        sortBy: (sortBy as string) || undefined,
        sortOrder: (sortOrder as "asc" | "desc") || undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const validatedData = ProductSchema.parse(req.body);
      const { initialStock, ...rest } = validatedData;
      const product = await productService.create({
        ...rest,
        ...(initialStock !== undefined ? { initialStock } : {}),
      } as any);
      res.status(201).json(product);
    } catch (error: any) {
      res.status(400).json({ error: error.message || error });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const product = await productService.getById(id as string);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validatedData = UpdateProductSchema.parse(req.body);
      const product = await productService.update(
        id as string,
        validatedData as any,
      );
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ error: error.message || error });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await productService.delete(id as string);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message || error });
    }
  }
}
