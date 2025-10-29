import { PrismaClient } from '@prisma/client';
import { syncGoogleSheetToDatabase } from '../src/services/syncService';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  RESET E SINCRONIZZAZIONE DATABASE\n');

  // Step 1: Cancella tutti i dati
  console.log('1️⃣  Cancellazione dati vecchi...');

  const deletedLogs = await prisma.checkInLog.deleteMany({});
  console.log(`   ✅ Cancellati ${deletedLogs.count} check-in logs`);

  const deletedInvitees = await prisma.invitee.deleteMany({});
  console.log(`   ✅ Cancellati ${deletedInvitees.count} invitati vecchi\n`);

  // Step 2: Sincronizza da Google Sheets
  console.log('2️⃣  Sincronizzazione da Google Sheets...');

  try {
    const result = await syncGoogleSheetToDatabase();

    console.log('\n✨ SINCRONIZZAZIONE COMPLETATA!\n');
    console.log('📊 RISULTATI:');
    console.log(`   📄 ${result.totalFromSheet} persone lette da Google Sheets`);
    console.log(`   ✅ ${result.newImported} nuove persone importate`);
    console.log(`   ⏭️  ${result.alreadyExists} persone già esistenti (saltate)`);
    console.log(`   ❌ ${result.errors.length} errori`);
    console.log(`   ⏱️  Completato in ${result.duration}ms\n`);

    console.log('📋 DETTAGLI:');
    console.log(`   Paganti: ${result.breakdown.paganti.imported} importati, ${result.breakdown.paganti.exists} esistenti`);
    console.log(`   Green: ${result.breakdown.green.imported} importati, ${result.breakdown.green.exists} esistenti\n`);

    // Verifica finale
    const pagantiCount = await prisma.invitee.count({ where: { listType: 'PAGANTE' } });
    const greenCount = await prisma.invitee.count({ where: { listType: 'GREEN' } });

    console.log('📈 STATISTICHE FINALI:');
    console.log(`   Paganti: ${pagantiCount}`);
    console.log(`   Green: ${greenCount}`);
    console.log(`   TOTALE: ${pagantiCount + greenCount}\n`);

  } catch (error) {
    console.error('❌ Errore durante la sincronizzazione:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Errore fatale:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
