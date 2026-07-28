import prisma from "../lib/prisma.js";

export class VendorService {
  async getAll() {
    return prisma.vendor.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  async create(data: { name: string; contactEmail?: string }) {
    return prisma.vendor.create({
      data: {
        name: data.name,
        contactEmail: data.contactEmail || null,
      },
    });
  }

  async getById(id: string) {
    return prisma.vendor.findUnique({
      where: { id },
      include: {
        products: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    // Check if vendor has products
    const productsCount = await prisma.productVendor.count({
      where: { vendorId: id },
    });

    if (productsCount > 0) {
      throw new Error("Cannot delete vendor with associated products");
    }

    return prisma.vendor.delete({
      where: { id },
    });
  }

  async update(
    id: string,
    data: { name?: string; contactEmail?: string | null },
  ) {
    return prisma.vendor.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.contactEmail !== undefined
          ? { contactEmail: data.contactEmail }
          : {}),
      },
    });
  }
}
