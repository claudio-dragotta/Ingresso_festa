import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Inizializzazione utenti...\n');

  // Crea utente admin
  const adminExists = await prisma.user.findUnique({
    where: { username: 'admin' },
  });

  if (!adminExists) {
    const adminPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        username: 'admin',
        password: adminPassword,
        role: 'ADMIN',
      },
    });
    console.log('✅ Utente ADMIN creato (username: admin, password: admin123)');
  } else {
    console.log('ℹ️  Utente admin già esistente');
  }

  // Crea utente ingresso di esempio
  const entranceExists = await prisma.user.findUnique({
    where: { username: 'ingresso1' },
  });

  if (!entranceExists) {
    const entrancePassword = await bcrypt.hash('ingresso123', 10);
    await prisma.user.create({
      data: {
        username: 'ingresso1',
        password: entrancePassword,
        role: 'ENTRANCE',
      },
    });
    console.log('✅ Utente ENTRANCE creato (username: ingresso1, password: ingresso123)');
  } else {
    console.log('ℹ️  Utente ingresso1 già esistente');
  }

  console.log('\n✨ Inizializzazione completata!');
  console.log('\n📝 Credenziali:');
  console.log('   Admin: username=admin, password=admin123');
  console.log('   Ingresso: username=ingresso1, password=ingresso123');
  console.log('\n⚠️  IMPORTANTE: Cambia queste password in produzione!');
}

main()
  .catch((e) => {
    console.error('❌ Errore:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
