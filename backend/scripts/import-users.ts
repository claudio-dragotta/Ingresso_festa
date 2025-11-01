import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { UserRole } from "@prisma/client";

type InputUser = {
  username: string;
  password: string; // plain or bcrypt ($2b$...)
  role?: UserRole | "ADMIN" | "ENTRANCE" | "ORGANIZER" | "SHUTTLE";
};

const isHashed = (value: string) => value.startsWith("$2b$");

const loadUsersFile = (filePath: string): InputUser[] => {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`File non trovato: ${abs}`);
  }
  const raw = fs.readFileSync(abs, "utf8");
  const json = JSON.parse(raw);
  if (Array.isArray(json)) return json as InputUser[];
  if (Array.isArray(json.users)) return json.users as InputUser[];
  throw new Error("Formato non valido. Usa un array o { users: [...] }.");
};

const validateUser = (u: InputUser, index: number) => {
  if (!u.username || typeof u.username !== "string") {
    throw new Error(`users[${index}].username mancante o non valido`);
  }
  if (!u.password || typeof u.password !== "string") {
    throw new Error(`users[${index}].password mancante o non valido`);
  }
  if (
    u.role &&
    u.role !== "ADMIN" &&
    u.role !== "ENTRANCE" &&
    u.role !== "ORGANIZER" &&
    u.role !== "SHUTTLE"
  ) {
    throw new Error(`users[${index}].role deve essere 'ADMIN' | 'ENTRANCE' | 'ORGANIZER' | 'SHUTTLE'`);
  }
};

async function main() {
  const fileArg = process.argv[2];
  const file = fileArg || "users.json";

  console.log(`\n➡️  Import utenti da: ${file}`);
  const inputUsers = loadUsersFile(file);
  let created = 0;
  let updated = 0;

  for (let i = 0; i < inputUsers.length; i++) {
    const u = inputUsers[i];
    validateUser(u, i);
    const role: UserRole = (u.role as UserRole) ?? "ENTRANCE";
    const passwordHash = isHashed(u.password) ? u.password : await bcrypt.hash(u.password, 10);

    const existing = await prisma.user.findUnique({ where: { username: u.username } });
    if (existing) {
      await prisma.user.update({
        where: { username: u.username },
        data: { password: passwordHash, role },
      });
      updated++;
      console.log(`  🔄 Aggiornato: ${u.username} (${role})`);
    } else {
      await prisma.user.create({
        data: { username: u.username, password: passwordHash, role },
      });
      created++;
      console.log(`  ✅ Creato:    ${u.username} (${role})`);
    }
  }

  console.log(`\n✅ Completato. Creati: ${created}, Aggiornati: ${updated}.`);
}

main()
  .catch((err) => {
    console.error("\n❌ Errore import:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
