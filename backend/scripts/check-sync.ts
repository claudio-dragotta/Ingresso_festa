import { prisma } from '../src/lib/prisma';
import { readPagantiSheet, readGreenSheet } from '../src/services/googleSheetsService';

async function compareSyncData() {
  console.log('=== CONFRONTO GOOGLE SHEETS vs DATABASE ===\n');

  // Leggi dati da Google Sheets
  const [pagantiSheet, greenSheet] = await Promise.all([
    readPagantiSheet(),
    readGreenSheet(),
  ]);

  // Leggi dati dal database
  const [pagantiDB, greenDB] = await Promise.all([
    prisma.invitee.findMany({
      where: { listType: 'PAGANTE' },
      select: { firstName: true, lastName: true, paymentType: true, hasEntered: true },
    }),
    prisma.invitee.findMany({
      where: { listType: 'GREEN' },
      select: { firstName: true, lastName: true, hasEntered: true },
    }),
  ]);

  console.log('📊 NUMERI:');
  console.log(`  Google Sheet PAGANTI: ${pagantiSheet.length}`);
  console.log(`  Database PAGANTI: ${pagantiDB.length}`);
  console.log(`  Google Sheet GREEN: ${greenSheet.length}`);
  console.log(`  Database GREEN: ${greenDB.length}`);

  // Verifica persone nel DB che non sono sul foglio
  console.log('\n--- PAGANTI: Persone nel DB che NON sono sul foglio Google ---');
  const pagantiSheetNames = new Set(
    pagantiSheet.map(s => s.colA.toLowerCase().trim())
  );
  const pagantiNotInSheet = pagantiDB.filter(db => {
    const fullName = `${db.lastName} ${db.firstName}`.toLowerCase().trim();
    return !pagantiSheetNames.has(fullName);
  });

  if (pagantiNotInSheet.length === 0) {
    console.log('✅ Nessuna discrepanza trovata!');
  } else {
    console.log(`❌ Trovate ${pagantiNotInSheet.length} persone nel DB ma non sul foglio:`);
    pagantiNotInSheet.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.lastName} ${p.firstName} [${p.paymentType || 'N/D'}] - Entrato: ${p.hasEntered}`);
    });
  }

  // Verifica GREEN
  console.log('\n--- GREEN: Persone nel DB che NON sono sul foglio Google ---');
  const greenSheetNames = new Set(greenSheet.map(s => s.toLowerCase().trim()));
  const greenNotInSheet = greenDB.filter(db => {
    const fullName = `${db.lastName} ${db.firstName}`.toLowerCase().trim();
    return !greenSheetNames.has(fullName);
  });

  if (greenNotInSheet.length === 0) {
    console.log('✅ Nessuna discrepanza trovata!');
  } else {
    console.log(`❌ Trovate ${greenNotInSheet.length} persone nel DB ma non sul foglio:`);
    greenNotInSheet.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.lastName} ${p.firstName} - Entrato: ${p.hasEntered}`);
    });
  }

  // Check persone entrate
  console.log('\n--- PERSONE ENTRATE (marcate nel DB) ---');
  const pagantiEntered = pagantiDB.filter(p => p.hasEntered);
  const greenEntered = greenDB.filter(p => p.hasEntered);

  console.log(`  PAGANTI entrati: ${pagantiEntered.length}/${pagantiDB.length}`);
  if (pagantiEntered.length > 0) {
    console.log('  Prime 10 persone PAGANTI entrate:');
    pagantiEntered.slice(0, 10).forEach((p, i) => {
      console.log(`    ${i + 1}. ${p.lastName} ${p.firstName}`);
    });
  }

  console.log(`\n  GREEN entrati: ${greenEntered.length}/${greenDB.length}`);
  if (greenEntered.length > 0) {
    console.log('  Persone GREEN entrate:');
    greenEntered.forEach((p, i) => {
      console.log(`    ${i + 1}. ${p.lastName} ${p.firstName}`);
    });
  }

  // Statistiche di sincronizzazione
  console.log('\n=== CONCLUSIONE ===');
  if (pagantiNotInSheet.length === 0 && greenNotInSheet.length === 0) {
    console.log('✅ Il database è perfettamente sincronizzato con Google Sheets');
    console.log('✅ Non ci sono dati "vecchi" o memorizzati localmente');
  } else {
    console.log('⚠️  ATTENZIONE: Ci sono discrepanze tra DB e Google Sheets!');
    console.log('💡 Suggerimento: Esegui un reset completo con:');
    console.log('   npx ts-node scripts/reset-and-sync.ts');
  }
}

compareSyncData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Errore:', error);
    process.exit(1);
  });
