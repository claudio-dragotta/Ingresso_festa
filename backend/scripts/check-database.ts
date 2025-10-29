import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Controllo Database...\n');

  // Conta tutti gli invitati
  const allInvitees = await prisma.invitee.findMany({
    orderBy: [{ listType: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }]
  });

  console.log('📊 STATISTICHE TOTALI:');
  console.log(`   Totale persone nel database: ${allInvitees.length}`);

  const pagantiCount = allInvitees.filter(i => i.listType === 'PAGANTE').length;
  const greenCount = allInvitees.filter(i => i.listType === 'GREEN').length;

  console.log(`   - Paganti: ${pagantiCount}`);
  console.log(`   - Green: ${greenCount}`);

  const enteredCount = allInvitees.filter(i => i.hasEntered).length;
  console.log(`   - Già entrati: ${enteredCount}`);
  console.log(`   - Da entrare: ${allInvitees.length - enteredCount}\n`);

  // Mostra tutte le persone
  console.log('👥 LISTA COMPLETA:\n');

  console.log('📘 PAGANTI:');
  const paganti = allInvitees.filter(i => i.listType === 'PAGANTE');
  paganti.forEach((person, index) => {
    const status = person.hasEntered ? '🔴 ENTRATO' : '🟢 NON ENTRATO';
    console.log(`   ${index + 1}. ${person.firstName} ${person.lastName} - ${person.paymentType || 'N/A'} - ${status}`);
  });

  console.log('\n📗 GREEN:');
  const green = allInvitees.filter(i => i.listType === 'GREEN');
  green.forEach((person, index) => {
    const status = person.hasEntered ? '🔴 ENTRATO' : '🟢 NON ENTRATO';
    console.log(`   ${index + 1}. ${person.firstName} ${person.lastName} - ${status}`);
  });

  // Cerca duplicati
  console.log('\n🔍 CONTROLLO DUPLICATI:');
  const duplicates = new Map<string, typeof allInvitees>();

  allInvitees.forEach(person => {
    const key = `${person.firstName.toLowerCase()}_${person.lastName.toLowerCase()}_${person.listType}`;
    if (!duplicates.has(key)) {
      duplicates.set(key, []);
    }
    duplicates.get(key)!.push(person);
  });

  let foundDuplicates = false;
  duplicates.forEach((persons, key) => {
    if (persons.length > 1) {
      foundDuplicates = true;
      console.log(`   ⚠️  DUPLICATO: ${persons[0].firstName} ${persons[0].lastName} (${persons[0].listType})`);
      persons.forEach((p, i) => {
        console.log(`      ${i + 1}. ID: ${p.id} - Creato: ${p.createdAt.toISOString()} - Entrato: ${p.hasEntered}`);
      });
    }
  });

  if (!foundDuplicates) {
    console.log('   ✅ Nessun duplicato trovato');
  }

  console.log('\n💾 Database location:');
  console.log(`   ${process.env.DATABASE_URL}`);
}

main()
  .catch((e) => {
    console.error('❌ Errore:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
