import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const CHAPTERS = [
  { number: 1, title: 'Marco Referencial' },
  { number: 2, title: 'Marco Teorico' },
  { number: 3, title: 'Marco Practico' },
  { number: 4, title: 'Resultados' },
  { number: 5, title: 'Conclusiones' },
  { number: 6, title: 'Recomendaciones' },
  { number: 7, title: 'Bibliografia' },
  { number: 8, title: 'Anexos' },
];

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('devpassword123', 10);

  // Upsert users
  const student = await prisma.user.upsert({
    where: { email: 'student@thena.dev' },
    update: { passwordHash },
    create: {
      email: 'student@thena.dev',
      name: 'Ivan Torres',
      role: 'STUDENT',
      passwordHash,
    },
  });
  console.log(`  Student: ${student.name} (${student.id})`);

  const tutor = await prisma.user.upsert({
    where: { email: 'tutor@thena.dev' },
    update: { passwordHash },
    create: {
      email: 'tutor@thena.dev',
      name: 'Dr. Marcelo Ticona',
      role: 'TUTOR',
      passwordHash,
    },
  });
  console.log(`  Tutor: ${tutor.name} (${tutor.id})`);

  // Upsert chapters for the student
  for (const ch of CHAPTERS) {
    const chapter = await prisma.chapter.upsert({
      where: {
        studentId_number: {
          studentId: student.id,
          number: ch.number,
        },
      },
      update: {},
      create: {
        number: ch.number,
        title: ch.title,
        status: ch.number === 1 ? 'DRAFT' : 'LOCKED',
        studentId: student.id,
      },
    });
    console.log(
      `  Chapter ${chapter.number}: ${chapter.title} [${chapter.status}]`,
    );
  }

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
