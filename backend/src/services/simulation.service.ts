import prisma from "../lib/prisma.js";

export class SimulationService {
  async simulateData() {
    // 1. CLEAR OLD DATA
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.forecast.deleteMany({});

    // 2. ENSURE PRODUCTS & VENDORS EXIST
    let vendors = await prisma.vendor.findMany();
    if (vendors.length === 0) {
      const v = await prisma.vendor.create({
        data: {
          name: "OmniCorp Logistics",
          contactEmail: "orders@omnicorp.com",
        },
      });
      vendors = [v];
    }

    let products = await prisma.product.findMany({
      include: { vendors: true },
    });
    if (products.length === 0) {
      const p1 = await prisma.product.create({
        data: {
          name: "Quantum Chip S1",
          category: "Electronics",
          vendors: { create: { vendorId: vendors[0]!.id, price: 299.99 } },
          inventory: {
            create: { currentStock: 450, reorderLevel: 100, safetyStock: 50 },
          },
        },
        include: { vendors: true },
      });
      const p2 = await prisma.product.create({
        data: {
          name: "Neural Link v2",
          category: "Electronics",
          vendors: { create: { vendorId: vendors[0]!.id, price: 850.0 } },
          inventory: {
            create: { currentStock: 120, reorderLevel: 30, safetyStock: 15 },
          },
        },
        include: { vendors: true },
      });
      const p3 = await prisma.product.create({
        data: {
          name: "Titanium Chassis",
          category: "Manufacturing",
          vendors: { create: { vendorId: vendors[0]!.id, price: 1200.0 } },
          inventory: {
            create: { currentStock: 45, reorderLevel: 10, safetyStock: 5 },
          },
        },
        include: { vendors: true },
      });
      products = [p1, p2, p3];
    }

    const allProducts = await prisma.product.findMany({
      include: { vendors: true },
    });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 120); // 4 months of data

    console.log(
      `Starting data simulation for ${allProducts.length} products...`,
    );

    for (let i = 0; i <= 120; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      if (i % 30 === 0) console.log(`[Simulation] Progress: Day ${i}/120...`);

      // Seasonality & Trends
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const month = currentDate.getMonth();

      // Base demand with a slight upward trend over 120 days (Refined Step 11)
      const trendMultiplier = 1 + i / 500; // Faster growth for more visible trend

      for (const product of allProducts) {
        // Product specific behavior
        let baseQuantity = 2;
        if (product.category === "Electronics") baseQuantity = 5;

        // Random variation + spikes (Step 11 Rules)
        // 1. Base + Trend
        let quantity = baseQuantity * trendMultiplier;

        // 2. Weekend multiplier (1.3x)
        if (isWeekend) quantity *= 1.3;

        // 3. Holiday spike (December)
        if (month === 11) quantity *= 1.8;

        // 4. Random noise (±10%)
        const noise = 0.9 + Math.random() * 0.2;
        quantity *= noise;

        const finalQuantity = Math.floor(quantity);

        if (finalQuantity > 0) {
          try {
            await prisma.order.create({
              data: {
                date: new Date(currentDate),
                totalAmount: finalQuantity * 50,
                items: {
                  create: [{ productId: product.id, quantity: finalQuantity }],
                },
              },
            });
          } catch (e) {
            console.error(
              `[Simulation] Failed to create order for ${product.id} on ${currentDate.toISOString()}:`,
              e,
            );
          }
        }
      }
    }

    console.log("Data simulation successfully completed.");

    return {
      message: "High-fidelity simulation complete",
      days: 120,
      productsCached: allProducts.length,
    };
  }
}
