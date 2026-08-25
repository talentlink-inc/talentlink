import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const subdomain = process.env.DEFAULT_TENANT_SUBDOMAIN ?? "digitallinks";

  const tenant = await prisma.tenant.upsert({
    where: { subdomain },
    update: {},
    create: {
      name: "Digital Links Inc.",
      subdomain,
    },
  });

  console.log(`Tenant ready: ${tenant.name} (${tenant.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
