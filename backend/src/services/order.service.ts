import prisma from "../lib/prisma.js";

export class OrderService {
  async createOrder(data: {
    items: { productId: string; quantity: number }[];
  }) {
    let totalAmount = 0;
    // In a real app, we'd fetch prices. Here we assume a fixed price or items have prices.
    // Let's assume a default total for now or calculate based on dummy price.
    totalAmount = data.items.reduce((acc, item) => acc + item.quantity * 10, 0);

    return await prisma.$transaction(async (tx: any) => {
      const order = await tx.order.create({
        data: {
          totalAmount,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
        include: { items: true },
      });

      // Update Inventory
      for (const item of data.items) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: {
            currentStock: {
              decrement: item.quantity,
            },
          },
        });
      }

      return order;
    });
  }

  async getAllOrders(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count(),
    ]);

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getHistoricalData(productId: string) {
    // Fetch last 60 days of orders for this product
    const orderItems = await prisma.orderItem.findMany({
      where: { productId },
      include: { order: true },
      orderBy: { order: { date: "asc" } },
    });

    return orderItems.map((oi: any) => ({
      date: oi.order.date,
      quantity: oi.quantity,
    }));
  }
}
