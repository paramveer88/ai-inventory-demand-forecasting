import app from "./app.js";
import { CronService } from "./services/cron.service.js";

const PORT = process.env.PORT || 5000;

// Initialize Cron Jobs
const cronService = new CronService();
cronService.startJobs();

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Backend server running on http://0.0.0.0:${PORT}`);
});

// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();

// async function testDB() {
//   await prisma.product.create({
//     data: {
//       name: "Test Product",
//       category: "Demo"
//     }
//   });

//   console.log("Inserted!");
// }

// testDB();
