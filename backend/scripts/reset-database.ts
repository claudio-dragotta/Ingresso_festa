import { PrismaClient } from '@prisma/client';
import readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('⚠️  ATTENZIONE: Questo script cancellerà TUTTI i dati dal database!\n');

  const answer = await question('Sei sicuro di voler procedere? Scrivi "CONFERMA" per continuare: ');

  if (answer.trim() !== 'CONFERMA') {
    console.log('❌ Operazione annullata.');
    rl.close();
    return;
  }

  console.log('\n🗑️  Cancellazione dati in corso...\n');

  // Cancella tutti i check-in logs
  const deletedLogs = await prisma.checkInLog.deleteMany({});
  console.log(`✅ Cancellati ${deletedLogs.count} check-in logs`);

  // Cancella tutti gli invitati
  const deletedInvitees = await prisma.invitee.deleteMany({});
  console.log(`✅ Cancellati ${deletedInvitees.count} invitati`);

  console.log('\n✨ Database pulito con successo!');
  console.log('\n📝 Ora puoi:');
  console.log('   1. Sincronizzare da Google Sheets');
  console.log('   2. O aggiungere persone manualmente\n');

  rl.close();
}

main()
  .catch((e) => {
    console.error('❌ Errore:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
