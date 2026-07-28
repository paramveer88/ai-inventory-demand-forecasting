import { z } from "zod";

export const ProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  category: z.string().min(1, "Category is required"),
  initialStock: z.number().int().nonnegative().optional(),
  vendors: z
    .array(
      z.object({
        vendorId: z.string(),
        price: z.number().positive(),
      }),
    )
    .min(1, "At least one vendor is required"),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(1, "Product name is required").optional(),
  category: z.string().min(1, "Category is required").optional(),
  vendors: z
    .array(
      z.object({
        vendorId: z.string(),
        price: z.number().positive(),
      }),
    )
    .optional(),
});

export const VendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required"),
  contactEmail: z.string().email().optional().or(z.literal("")),
});
