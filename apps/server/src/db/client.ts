import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "../generated/prisma/client.js";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://pingpong:pingpong_dev@localhost:5432/pingpong_duel?schema=public";

const adapter = new PrismaPg({ connectionString });
export const prisma = new PrismaClient({ adapter });
