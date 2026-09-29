import { prisma } from "./client.js";

try {
  await prisma.$queryRaw`SELECT 1`;
  console.log("Database connection successful.");
} catch (error) {
  console.error("Database connection failed.", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
