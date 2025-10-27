import bcrypt from "bcryptjs";

const [password] = process.argv.slice(2);

if (!password) {
  console.error("Uso: npm run hash-password -- <password>");
  process.exit(1);
}

const run = async () => {
  const hash = await bcrypt.hash(password, 12);
  console.log(hash);
};

void run();
