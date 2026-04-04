import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('devpassword123', 10);

  // ─── Users ───────────────────────────────────────────────────────────────────

  const student1 = await prisma.user.upsert({
    where: { email: 'student@thena.dev' },
    update: { passwordHash },
    create: {
      email: 'student@thena.dev',
      name: 'Ivan Torres',
      role: 'STUDENT',
      passwordHash,
    },
  });
  console.log(`  Student 1: ${student1.name} (${student1.id})`);

  const student2 = await prisma.user.upsert({
    where: { email: 'student2@thena.dev' },
    update: { passwordHash },
    create: {
      email: 'student2@thena.dev',
      name: 'María Condori',
      role: 'STUDENT',
      passwordHash,
    },
  });
  console.log(`  Student 2: ${student2.name} (${student2.id})`);

  const student3 = await prisma.user.upsert({
    where: { email: 'student3@thena.dev' },
    update: { passwordHash },
    create: {
      email: 'student3@thena.dev',
      name: 'Carlos Mamani',
      role: 'STUDENT',
      passwordHash,
    },
  });
  console.log(`  Student 3: ${student3.name} (${student3.id})`);

  const tutor1 = await prisma.user.upsert({
    where: { email: 'tutor@thena.dev' },
    update: { passwordHash },
    create: {
      email: 'tutor@thena.dev',
      name: 'Dr. Marcelo Ticona',
      role: 'TUTOR',
      passwordHash,
    },
  });
  console.log(`  Tutor 1: ${tutor1.name} (${tutor1.id})`);

  const tutor2 = await prisma.user.upsert({
    where: { email: 'tutor2@thena.dev' },
    update: { passwordHash },
    create: {
      email: 'tutor2@thena.dev',
      name: 'Dra. Ana Flores',
      role: 'TUTOR',
      passwordHash,
    },
  });
  console.log(`  Tutor 2: ${tutor2.name} (${tutor2.id})`);

  // No thesis or chapters created — students go through onboarding flow on first login

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
