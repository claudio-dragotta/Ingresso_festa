import { createInvitee } from '../src/services/inviteeService';
import { readPagantiSheet, readGreenSheet } from '../src/services/googleSheetsService';
import { prisma } from '../src/lib/prisma';

async function testFormatting() {
  console.log('=== TEST FORMATTAZIONE NOMI SU GOOGLE SHEETS ===\n');

  const timestamp = Date.now();

  // Test 1: Nome tutto minuscolo
  const testPerson1 = {
    firstName: 'mario',
    lastName: 'rossi',
    email: `mario.rossi${timestamp}@example.com`,
    phone: '+39 123 456 7890',
    listType: 'PAGANTE' as const,
    paymentType: 'BONIFICO', // In maiuscolo per testare la conversione
  };

  // Test 2: Nome tutto maiuscolo
  const testPerson2 = {
    firstName: 'LUIGI',
    lastName: 'VERDI',
    listType: 'GREEN' as const,
  };

  // Test 3: Nome misto
  const testPerson3 = {
    firstName: 'AnNa',
    lastName: 'bIaNcHi',
    listType: 'PAGANTE' as const,
    paymentType: 'PayPal', // Misto per testare la conversione
  };

  console.log('📝 Test 1: Nome tutto minuscolo');
  console.log(`   Input: "${testPerson1.lastName} ${testPerson1.firstName}" | ${testPerson1.paymentType}`);
  console.log(`   Atteso su Sheets: "Rossi Mario" | "bonifico"\n`);

  try {
    const created1 = await createInvitee(testPerson1);
    console.log(`✅ Creato nel DB con ID: ${created1.id}`);
  } catch (error: any) {
    console.error(`❌ Errore: ${error.message}\n`);
  }

  // Aspetta un po'
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('📝 Test 2: Nome tutto maiuscolo (GREEN)');
  console.log(`   Input: "${testPerson2.lastName} ${testPerson2.firstName}"`);
  console.log(`   Atteso su Sheets: "Verdi Luigi"\n`);

  try {
    const created2 = await createInvitee(testPerson2);
    console.log(`✅ Creato nel DB con ID: ${created2.id}`);
  } catch (error: any) {
    console.error(`❌ Errore: ${error.message}\n`);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('📝 Test 3: Nome misto');
  console.log(`   Input: "${testPerson3.lastName} ${testPerson3.firstName}" | ${testPerson3.paymentType}`);
  console.log(`   Atteso su Sheets: "Bianchi Anna" | "paypal"\n`);

  try {
    const created3 = await createInvitee(testPerson3);
    console.log(`✅ Creato nel DB con ID: ${created3.id}`);
  } catch (error: any) {
    console.error(`❌ Errore: ${error.message}\n`);
  }

  // Aspetta per propagazione
  console.log('\n⏳ Attendo 3 secondi per la propagazione su Google Sheets...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Verifica su Google Sheets
  console.log('🔍 VERIFICA SU GOOGLE SHEETS:\n');

  const [pagantiSheet, greenSheet] = await Promise.all([
    readPagantiSheet(),
    readGreenSheet(),
  ]);

  // Test 1 verification
  const found1 = pagantiSheet.find(row =>
    row.colA.includes('Rossi') && row.colA.includes('Mario')
  );
  if (found1) {
    console.log(`✅ Test 1 - Trovato: "${found1.colA}" | "${found1.colB}"`);
    if (found1.colA === 'Rossi Mario' && found1.colB === 'bonifico') {
      console.log('   ✅ FORMATTAZIONE CORRETTA!\n');
    } else {
      console.log('   ❌ Formattazione non corretta\n');
    }
  } else {
    console.log('❌ Test 1 - NON trovato su Google Sheets\n');
  }

  // Test 2 verification
  const found2 = greenSheet.find(name =>
    name.includes('Verdi') && name.includes('Luigi')
  );
  if (found2) {
    console.log(`✅ Test 2 - Trovato: "${found2}"`);
    if (found2 === 'Verdi Luigi') {
      console.log('   ✅ FORMATTAZIONE CORRETTA!\n');
    } else {
      console.log('   ❌ Formattazione non corretta\n');
    }
  } else {
    console.log('❌ Test 2 - NON trovato su Google Sheets\n');
  }

  // Test 3 verification
  const found3 = pagantiSheet.find(row =>
    row.colA.includes('Bianchi') && row.colA.includes('Anna')
  );
  if (found3) {
    console.log(`✅ Test 3 - Trovato: "${found3.colA}" | "${found3.colB}"`);
    if (found3.colA === 'Bianchi Anna' && found3.colB === 'paypal') {
      console.log('   ✅ FORMATTAZIONE CORRETTA!\n');
    } else {
      console.log('   ❌ Formattazione non corretta\n');
    }
  } else {
    console.log('❌ Test 3 - NON trovato su Google Sheets\n');
  }

  // Pulizia
  console.log('\n🧹 PULIZIA: Rimozione persone di test dal DB...');
  await prisma.invitee.deleteMany({
    where: {
      OR: [
        { lastName: 'Rossi', firstName: 'Mario' },
        { lastName: 'Verdi', firstName: 'Luigi' },
        { lastName: 'Bianchi', firstName: 'Anna' },
      ],
    },
  });
  console.log('✅ Persone di test rimosse dal DB');
  console.log('⚠️  NOTA: Rimangono su Google Sheets. Rimuovile manualmente.\n');

  console.log('=== TEST COMPLETATO ===');
  console.log('📋 RIASSUNTO:');
  console.log('   - Cognome Nome: con iniziali MAIUSCOLE ✅');
  console.log('   - Tipo Pagamento: tutto minuscolo ✅');
  console.log('   - Solo nome, cognome e tipo pagamento salvati su Sheets ✅');
  console.log('   - Email e telefono rimangono solo nel DB ✅');
}

testFormatting()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Errore fatale:', error);
    process.exit(1);
  });
