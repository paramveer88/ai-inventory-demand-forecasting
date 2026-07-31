import { Router } from "express";
import multer from "multer";
import { ProductController } from "../controllers/product.controller.js";
import { OrderController } from "../controllers/order.controller.js";
import { InventoryController } from "../controllers/inventory.controller.js";
import { SimulationController } from "../controllers/simulation.controller.js";
import { VendorController } from "../controllers/vendor.controller.js";
import { ImportExportController } from "../controllers/import-export.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const productController = new ProductController();
const orderController = new OrderController();
const inventoryController = new InventoryController();
const simulationController = new SimulationController();
const vendorController = new VendorController();
const importExportController = new ImportExportController();

router.get("/products", productController.getAll);
router.get("/products/export", importExportController.exportProducts);
router.get("/products/sample-file", importExportController.getSampleFile);
router.get("/products/:id", productController.getById);
router.post("/products", productController.create);
router.post(
  "/products/import",
  upload.single("file"),
  importExportController.importProducts,
);
router.put("/products/:id", productController.update);
router.delete("/products/:id", productController.delete);

router.get("/vendors", vendorController.getAll);
router.get("/vendors/export", importExportController.exportVendors);
router.get("/vendors/sample-file", importExportController.getVendorSampleFile);
router.post(
  "/vendors/import",
  upload.single("file"),
  importExportController.importVendors,
);
router.get("/vendors/:id", vendorController.getById);
router.post("/vendors", vendorController.create);
router.put("/vendors/:id", vendorController.update);
router.delete("/vendors/:id", vendorController.delete);

router.get("/orders", orderController.getAll);
router.get("/orders/export", importExportController.exportOrders);
router.get("/orders/sample-file", importExportController.getOrderSampleFile);
router.post(
  "/orders/import",
  upload.single("file"),
  importExportController.importOrders,
);
router.post("/orders", orderController.create);

router.get("/inventory", inventoryController.getStatus);
router.get("/inventory/export", importExportController.exportInventory);
router.get("/inventory/sample-file", importExportController.getInventorySampleFile);
router.post(
  "/inventory/import",
  upload.single("file"),
  importExportController.importInventory,
);
router.get("/forecast", inventoryController.getForecast);
router.get("/forecast/history", inventoryController.getForecastHistory);
router.get("/forecast/seed-history", inventoryController.seedForecastHistory);
router.get("/forecast/compare", inventoryController.compareModels);
router.get("/recommendations", inventoryController.getRecommendations);

router.post("/simulate-data", simulationController.simulate);

export default router;
