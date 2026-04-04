import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const CHAPTER_TITLES = [
  'Marco Referencial',
  'Marco Teórico',
  'Marco Práctico',
  'Resultados',
  'Conclusiones',
  'Recomendaciones',
  'Bibliografía',
  'Anexos',
];

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

  // ─── ThesisDocuments + Chapters ──────────────────────────────────────────────

  const thesesData = [
    {
      student: student1,
      title: 'Sistema de Gestión Hospitalaria Basado en Microservicios',
      tutor: tutor1,
    },
    {
      student: student2,
      title: 'Aplicación Móvil para Monitoreo de Cultivos con IoT',
      tutor: tutor1,
    },
    {
      student: student3,
      title: 'Plataforma de Aprendizaje Adaptativo con Inteligencia Artificial',
      tutor: null, // No tutor assigned
    },
  ];

  for (const { student, title, tutor } of thesesData) {
    // Check if thesis already exists for this student
    const existingThesis = await prisma.thesisDocument.findUnique({
      where: { studentId: student.id },
    });

    let thesis;
    if (existingThesis) {
      thesis = await prisma.thesisDocument.update({
        where: { id: existingThesis.id },
        data: {
          title,
          tutorId: tutor?.id ?? null,
        },
      });
      console.log(`  Updated thesis: "${title}" for ${student.name}`);
    } else {
      thesis = await prisma.thesisDocument.create({
        data: {
          title,
          studentId: student.id,
          tutorId: tutor?.id ?? null,
        },
      });
      console.log(`  Created thesis: "${title}" for ${student.name}`);
    }

    // Create chapters for this thesis (ch1=DRAFT, ch2-8=LOCKED)
    for (let i = 0; i < CHAPTER_TITLES.length; i++) {
      const chapterNumber = i + 1;
      const chapterTitle = CHAPTER_TITLES[i];

      const existing = await prisma.chapter.findUnique({
        where: {
          thesisId_number: {
            thesisId: thesis.id,
            number: chapterNumber,
          },
        },
      });

      if (!existing) {
        const chapter = await prisma.chapter.create({
          data: {
            number: chapterNumber,
            title: chapterTitle,
            status: chapterNumber === 1 ? 'DRAFT' : 'LOCKED',
            thesisId: thesis.id,
          },
        });
        console.log(
          `    Chapter ${chapter.number}: ${chapter.title} [${chapter.status}]`,
        );
      }
    }
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
