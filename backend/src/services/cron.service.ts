import cron from "node-cron";
import prisma from "../lib/prisma.js";
import { ProductService } from "./product.service.js";
import { OrderService } from "./order.service.js";

const productService = new ProductService();
const orderService = new OrderService();

export class CronService {
  startJobs() {
    if (process.env.ENABLE_CRON !== "true") {
      console.log("[Cron] Background jobs are disabled.");
      return;
    }

    console.log("[Cron] Starting automated data generation jobs...");

    // 1. Create a random order every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
      try {
        const { products } = await productService.getAll();
        if (!products || products.length === 0) return;

        const randomProduct =
          products[Math.floor(Math.random() * products.length)];
        if (!randomProduct) return;

        const quantity = Math.floor(Math.random() * 5) + 1;

        await orderService.createOrder({
          items: [{ productId: randomProduct.id, quantity }],
        });

        console.log(
          `[Cron] Generated order for ${randomProduct.name} (qty: ${quantity})`,
        );
      } catch (error) {
        console.error("[Cron] Error generating order:", error);
      }
    });

    // 2. Create a new product every hour (at minute 0)
    cron.schedule("0 * * * *", async () => {
      try {
        const categories = [
          "Electronics",
          "Home",
          "Apparel",
          "Industrial",
          "Food",
        ];
        const names = [
          "X-Series Gadget",
          "Pro-Tech tool",
          "Smart Device",
          "Eco-Ware",
          "Ultra-Kit",
        ];

        const name = `${names[Math.floor(Math.random() * names.length)] || "New Item"} ${Math.floor(Math.random() * 1000)}`;
        const category =
          categories[Math.floor(Math.random() * categories.length)] ||
          "General";

        const vendors = await prisma.vendor.findMany();
        if (vendors.length === 0) return;

        await productService.create({
          name,
          category,
          initialStock: 100 + Math.floor(Math.random() * 900),
          vendors: [
            { vendorId: vendors[0]!.id, price: 10 + Math.random() * 100 },
          ],
        });

        console.log(`[Cron] Generated new product: ${name} in ${category}`);
      } catch (error) {
        console.error("[Cron] Error generating product:", error);
      }
    });
  }
}
