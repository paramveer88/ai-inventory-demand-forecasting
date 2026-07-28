import prisma from "../lib/prisma.js";
import { parse } from "csv-parse/sync";
import * as xlsx from "xlsx";

function parseFileBuffer(buffer: any, fileType: string): any[] {
  if (fileType === "csv") {
    return parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } else {
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName!];
    if (sheet) {
      return xlsx.utils.sheet_to_json(sheet);
    }
    return [];
  }
}

export class ImportExportService {
  async importProducts(buffer: any, fileType: string) {
    const rows = parseFileBuffer(buffer, fileType);

    const results = {
      total: rows.length,
      success: 0,
      errors: [] as string[],
    };

    const seenProducts = new Set<string>();

    for (const [index, row] of rows.entries()) {
      try {
        const productName = row.productName || row.name;
        const category = row.category || "General";
        const vendorName = row.vendorName || row.vendor;
        const price = row.price;

        if (!productName || !category || !vendorName || !price) {
          results.errors.push(
            `Row ${index + 1}: Missing required fields (productName, category, vendorName, price)`
          );
          continue;
        }

        const productKey = `${productName.toLowerCase()}-${category.toLowerCase()}`;
        if (seenProducts.has(productKey)) {
          results.errors.push(
            `Row ${index + 1}: Duplicate product "${productName}" found in file`
          );
          continue;
        }
        seenProducts.add(productKey);

        // 1. Find or create vendor
        let vendor = await prisma.vendor.findFirst({
          where: { name: { equals: vendorName, mode: "insensitive" } },
        });

        if (!vendor) {
          vendor = await prisma.vendor.create({
            data: { name: vendorName },
          });
        }

        // 2. Find or create product
        let product = await prisma.product.findFirst({
          where: { name: { equals: productName, mode: "insensitive" } },
        });

        if (product) {
          // Update existing product's vendor/price mapping
          await prisma.productVendor.upsert({
            where: {
              productId_vendorId: {
                productId: product.id,
                vendorId: vendor.id,
              },
            },
            create: {
              productId: product.id,
              vendorId: vendor.id,
              price: parseFloat(price),
            },
            update: {
              price: parseFloat(price),
            },
          });
        } else {
          // Create new product with default inventory
          await prisma.product.create({
            data: {
              name: productName,
              category: category,
              inventory: {
                create: {
                  currentStock: 100, // Default for imported products
                  reorderLevel: 20,
                  safetyStock: 10,
                },
              },
              vendors: {
                create: {
                  vendorId: vendor.id,
                  price: parseFloat(price),
                },
              },
            },
          });
        }

        results.success++;
      } catch (error: any) {
        results.errors.push(`Row ${index + 1}: ${error.message}`);
      }
    }

    return results;
  }

  async exportProducts() {
    const products = await prisma.product.findMany({
      include: {
        inventory: true,
        vendors: {
          include: {
            vendor: true,
          },
        },
      },
    });

    const header = "productName,category,currentStock,reorderLevel,vendors\n";
    const rows = products.map((p: any) => {
      const vendorString = p.vendors
        .map((v: any) => `${v.vendor.name} ($${v.price})`)
        .join(" | ");
      return `"${p.name}","${p.category}",${p.inventory?.currentStock || 0},${p.inventory?.reorderLevel || 0},"${vendorString}"`;
    });

    return header + rows.join("\n");
  }

  getSampleCSV() {
    return "productName,category,vendorName,price\nMacBook Pro,Electronics,Apple Store,1999.99\nDell XPS 13,Electronics,Dell,1200.00\n";
  }

  // ── VENDORS ───────────────────────────────────────────────────
  async importVendors(buffer: any, fileType: string) {
    const rows = parseFileBuffer(buffer, fileType);
    const results = {
      total: rows.length,
      success: 0,
      errors: [] as string[],
    };

    for (const [index, row] of rows.entries()) {
      try {
        const name = row.name || row.vendorName;
        const contactEmail = row.contactEmail || row.email || "";

        if (!name) {
          results.errors.push(`Row ${index + 1}: Missing required field (name)`);
          continue;
        }

        const existing = await prisma.vendor.findFirst({
          where: { name: { equals: name, mode: "insensitive" } },
        });

        if (existing) {
          await prisma.vendor.update({
            where: { id: existing.id },
            data: {
              ...(contactEmail ? { contactEmail } : {}),
            },
          });
        } else {
          await prisma.vendor.create({
            data: {
              name,
              contactEmail: contactEmail || null,
            },
          });
        }

        results.success++;
      } catch (error: any) {
        results.errors.push(`Row ${index + 1}: ${error.message}`);
      }
    }

    return results;
  }

  async exportVendors() {
    const vendors = await prisma.vendor.findMany({
      include: {
        products: true,
      },
    });

    const header = "name,contactEmail,productCount,createdAt\n";
    const rows = vendors.map((v: any) => {
      const email = v.contactEmail || "";
      const created = v.createdAt ? v.createdAt.toISOString().split("T")[0] : "";
      return `"${v.name}","${email}",${v.products.length},"${created}"`;
    });

    return header + rows.join("\n");
  }

  getVendorSampleCSV() {
    return "name,contactEmail\nAcme Corp,contact@acme.com\nTech Suppliers,sales@techsuppliers.com\nGlobal Logistics,info@globallogistics.com\n";
  }

  // ── ORDERS ────────────────────────────────────────────────────
  async importOrders(buffer: any, fileType: string) {
    const rows = parseFileBuffer(buffer, fileType);
    const results = {
      total: rows.length,
      success: 0,
      errors: [] as string[],
    };

    for (const [index, row] of rows.entries()) {
      try {
        const productName = row.productName || row.product;
        const qtyRaw = row.quantity || row.qty;
        const dateRaw = row.date;
        const amountRaw = row.totalAmount || row.price;

        if (!productName || qtyRaw === undefined) {
          results.errors.push(`Row ${index + 1}: Missing required fields (productName, quantity)`);
          continue;
        }

        const quantity = parseInt(qtyRaw, 10);
        if (isNaN(quantity) || quantity <= 0) {
          results.errors.push(`Row ${index + 1}: Invalid quantity value "${qtyRaw}"`);
          continue;
        }

        // Find product by name
        let product = await prisma.product.findFirst({
          where: { name: { equals: productName, mode: "insensitive" } },
          include: { vendors: true },
        });

        if (!product) {
          // Auto-create product if it doesn't exist yet
          product = await prisma.product.create({
            data: {
              name: productName,
              category: row.category || "General",
              inventory: {
                create: {
                  currentStock: 100,
                  reorderLevel: 20,
                  safetyStock: 10,
                },
              },
            },
            include: { vendors: true },
          });
        }

        const itemPrice = amountRaw ? parseFloat(amountRaw) : (product.vendors[0]?.price || 50);
        const totalAmount = amountRaw ? parseFloat(amountRaw) : quantity * itemPrice;
        const date = dateRaw ? new Date(dateRaw) : new Date();

        await prisma.$transaction(async (tx: any) => {
          await tx.order.create({
            data: {
              date,
              totalAmount,
              items: {
                create: [
                  {
                    productId: product.id,
                    quantity,
                  },
                ],
              },
            },
          });

          await tx.inventory.upsert({
            where: { productId: product.id },
            update: {
              currentStock: {
                decrement: quantity,
              },
            },
            create: {
              productId: product.id,
              currentStock: 100 - quantity,
              reorderLevel: 20,
              safetyStock: 10,
            },
          });
        });

        results.success++;
      } catch (error: any) {
        results.errors.push(`Row ${index + 1}: ${error.message}`);
      }
    }

    return results;
  }

  async exportOrders() {
    const orders = await prisma.order.findMany({
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    const header = "orderId,date,productName,category,quantity,totalAmount\n";
    const rows: string[] = [];

    for (const order of orders) {
      const dateStr = order.date ? order.date.toISOString() : "";
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          rows.push(
            `"${order.id}","${dateStr}","${item.product?.name || "Unknown"}","${item.product?.category || "General"}",${item.quantity},${order.totalAmount}`
          );
        }
      } else {
        rows.push(`"${order.id}","${dateStr}","N/A","N/A",0,${order.totalAmount}`);
      }
    }

    return header + rows.join("\n");
  }

  getOrderSampleCSV() {
    return "productName,quantity,date,totalAmount\nMacBook Pro,2,2026-07-24,3999.98\nDell XPS 13,1,2026-07-24,1200.00\n";
  }

  // ── INVENTORY ─────────────────────────────────────────────────
  async importInventory(buffer: any, fileType: string) {
    const rows = parseFileBuffer(buffer, fileType);
    const results = {
      total: rows.length,
      success: 0,
      errors: [] as string[],
    };

    for (const [index, row] of rows.entries()) {
      try {
        const productName = row.productName || row.name || row.product;
        const currentStockRaw = row.currentStock || row.stock;
        const reorderLevelRaw = row.reorderLevel;
        const safetyStockRaw = row.safetyStock;
        const leadTimeRaw = row.leadTime;

        if (!productName || currentStockRaw === undefined) {
          results.errors.push(`Row ${index + 1}: Missing required fields (productName, currentStock)`);
          continue;
        }

        const currentStock = parseInt(currentStockRaw, 10);
        const reorderLevel = reorderLevelRaw !== undefined ? parseFloat(reorderLevelRaw) : 20;
        const safetyStock = safetyStockRaw !== undefined ? parseFloat(safetyStockRaw) : 10;
        const leadTime = leadTimeRaw !== undefined ? parseInt(leadTimeRaw, 10) : 7;

        if (isNaN(currentStock)) {
          results.errors.push(`Row ${index + 1}: Invalid currentStock value "${currentStockRaw}"`);
          continue;
        }

        // Find or create product
        let product = await prisma.product.findFirst({
          where: { name: { equals: productName, mode: "insensitive" } },
        });

        if (!product) {
          product = await prisma.product.create({
            data: {
              name: productName,
              category: row.category || "General",
            },
          });
        }

        await prisma.inventory.upsert({
          where: { productId: product.id },
          create: {
            productId: product.id,
            currentStock,
            reorderLevel,
            safetyStock,
            leadTime,
          },
          update: {
            currentStock,
            reorderLevel,
            safetyStock,
            leadTime,
          },
        });

        results.success++;
      } catch (error: any) {
        results.errors.push(`Row ${index + 1}: ${error.message}`);
      }
    }

    return results;
  }

  async exportInventory() {
    const inventoryItems = await prisma.inventory.findMany({
      include: {
        product: true,
      },
    });

    const header = "productName,category,currentStock,reorderLevel,safetyStock,leadTime,status\n";
    const rows = inventoryItems.map((item: any) => {
      const isLowStock = item.currentStock < item.reorderLevel;
      const status = isLowStock ? "LOW_STOCK" : "IN_STOCK";
      return `"${item.product?.name || "Unknown"}","${item.product?.category || "General"}",${item.currentStock},${item.reorderLevel},${item.safetyStock},${item.leadTime},"${status}"`;
    });

    return header + rows.join("\n");
  }

  getInventorySampleCSV() {
    return "productName,category,currentStock,reorderLevel,safetyStock,leadTime\nMacBook Pro,Electronics,150,20,10,7\nDell XPS 13,Electronics,85,15,5,5\nLogitech MX Master 3,Accessories,200,30,15,3\n";
  }
}

