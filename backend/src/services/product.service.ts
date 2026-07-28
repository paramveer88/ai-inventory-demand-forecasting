import prisma from "../lib/prisma.js";

export class ProductService {
  async getAll(
    params: {
      page?: number | undefined;
      limit?: number | undefined;
      search?: string | undefined;
      category?: string | undefined;
      sortBy?: string | undefined;
      sortOrder?: "asc" | "desc" | undefined;
    } = {},
  ) {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }
    if (category) {
      where.category = category;
    }

    const orderBy: any = {};
    if (sortBy === "stock" || sortBy === "inventory") {
      orderBy.inventory = { currentStock: sortOrder };
    } else {
      orderBy[sortBy] = sortOrder;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          inventory: true,
          vendors: {
            include: {
              vendor: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(data: {
    name: string;
    category: string;
    initialStock?: number;
    vendors: { vendorId: string; price: number }[];
  }) {
    const product = await prisma.product.create({
      data: {
        name: data.name,
        category: data.category,
        inventory: {
          create: {
            currentStock: data.initialStock || 0,
            reorderLevel: 0,
            safetyStock: 0,
          },
        },
        vendors: {
          create: data.vendors.map((v) => ({
            vendorId: v.vendorId,
            price: v.price,
          })),
        },
      },
      include: {
        inventory: true,
        vendors: {
          include: {
            vendor: true,
          },
        },
      },
    });
    return product;
  }

  async getById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        inventory: true,
        vendors: {
          include: {
            vendor: true,
          },
        },
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      category?: string;
      vendors?: { vendorId: string; price: number }[];
    },
  ) {
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.category) updateData.category = data.category;

    if (data.vendors) {
      // For MongoDB, we can replace the relations or handle carefully.
      // Easiest is to delete existing relations and create new ones.
      await prisma.productVendor.deleteMany({
        where: { productId: id },
      });

      updateData.vendors = {
        create: data.vendors.map((v) => ({
          vendorId: v.vendorId,
          price: v.price,
        })),
      };
    }

    return prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        inventory: true,
        vendors: {
          include: {
            vendor: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    // Check for active orders
    const orderCount = await prisma.orderItem.count({
      where: { productId: id },
    });

    if (orderCount > 0) {
      throw new Error("Cannot delete product with active orders");
    }

    // Delete related ProductVendor and Inventory first (Prisma might handle this via Cascade but let's be explicit if needed)
    // Actually, Prisma for MongoDB @relation usually needs careful deletion if not cascading.
    // In our schema we didn't specify onUpdate/onDelete actions.

    return prisma.$transaction([
      prisma.inventory.delete({ where: { productId: id } }),
      prisma.productVendor.deleteMany({ where: { productId: id } }),
      prisma.forecast.deleteMany({ where: { productId: id } }),
      prisma.product.delete({ where: { id } }),
    ]);
  }
}
