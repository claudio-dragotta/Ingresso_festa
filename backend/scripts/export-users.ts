import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";

async function main() {
  const outArg = process.argv[2];
  const outPath = outArg || "users-export.json";
  const abs = path.resolve(process.cwd(), outPath);

  const users = await prisma.user.findMany({
    select: {
      username: true,
      password: true, // hash bcrypt
      role: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const payload = { exportedAt: new Date().toISOString(), users };
  fs.writeFileSync(abs, JSON.stringify(payload, null, 2), "utf8");
  console.log(`\n✅ Esportati ${users.length} utenti in ${abs}`);
}

main()
  .catch((err) => {
    console.error("\n❌ Errore export:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

