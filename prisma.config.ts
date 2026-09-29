import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://pingpong:pingpong_dev@localhost:5432/pingpong_duel?schema=public",
  },
});
