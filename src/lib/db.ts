import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var __talentlinkPool: Pool | undefined;
  var __talentlinkPrisma: PrismaClient | undefined;
}

const pool =
  global.__talentlinkPool ??
  new Pool({ connectionString: process.env.DATABASE_URL });

const adapter = new PrismaPg(pool);

export const prisma = global.__talentlinkPrisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  global.__talentlinkPool = pool;
  global.__talentlinkPrisma = prisma;
}
