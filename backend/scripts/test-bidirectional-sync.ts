import { createInvitee } from '../src/services/inviteeService';
import { readPagantiSheet, readGreenSheet } from '../src/services/googleSheetsService';
import { prisma } from '../src/lib/prisma';

async function testBidirectionalSync() {
  console.log('=== TEST SINCRONIZZAZIONE BIDIREZIONALE ===\n');

  // Crea un nome univoco per il test
  const timestamp = Date.now();
  const testPerson = {
    firstName: 'TestUser',
    lastName: `Sync${timestamp}`,
    email: `test${timestamp}@example.com`,
    phone: '+39 123 456 7890',
    listType: 'PAGANTE' as const,
    paymentType: 'bonifico',
  };

  console.log('1️⃣  Creazione nuovo invitato nel DB...');
  console.log(`   Nome: ${testPerson.lastName} ${testPerson.firstName}`);
  console.log(`   Email: ${testPerson.email}`);
  console.log(`   Telefono: ${testPerson.phone}`);
  console.log(`   Lista: ${testPerson.listType}`);
  console.log(`   Pagamento: ${testPerson.paymentType}\n`);

  try {
    const created = await createInvitee(testPerson);
    console.log(`✅ Invitato creato nel DB con ID: ${created.id}\n`);

    // Aspetta un po' per dare tempo a Google Sheets di processare
    console.log('⏳ Attendo 3 secondi per la propagazione...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('2️⃣  Verifica su Google Sheets...');
    const pagantiSheet = await readPagantiSheet();

    const fullNameToFind = `${testPerson.lastName} ${testPerson.firstName}`;
    const foundOnSheet = pagantiSheet.find(
      row => row.colA.toLowerCase() === fullNameToFind.toLowerCase()
    );

    if (foundOnSheet) {
      console.log(`✅ SUCCESSO! Persona trovata su Google Sheets:`);
      console.log(`   Nome: ${foundOnSheet.colA}`);
      console.log(`   Tipologia: ${foundOnSheet.colB || 'N/D'}\n`);
    } else {
      console.log(`❌ ERRORE: Persona NON trovata su Google Sheets`);
      console.log(`   Cercavo: "${fullNameToFind}"`);
      console.log(`   Totale righe nel foglio: ${pagantiSheet.length}\n`);
    }

    // Pulizia: rimuovi la persona di test dal DB
    console.log('3️⃣  Pulizia: rimozione persona di test dal DB...');
    await prisma.invitee.delete({ where: { id: created.id } });
    console.log('✅ Persona di test rimossa dal DB\n');

    console.log('⚠️  NOTA: La persona rimarrà su Google Sheets. Rimuovila manualmente se necessario.\n');

    console.log('=== TEST COMPLETATO ===');
    if (foundOnSheet) {
      console.log('✅ La sincronizzazione bidirezionale funziona correttamente!');
    } else {
      console.log('❌ La sincronizzazione bidirezionale ha dei problemi.');
    }

  } catch (error: any) {
    console.error('❌ ERRORE durante il test:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

testBidirectionalSync()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Errore fatale:', error);
    process.exit(1);
  });
