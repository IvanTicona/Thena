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
      name: 'Ing. Paul Landaeta',
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

  // ─── Reviewer ─────────────────────────────────────────────────────────────────

  const reviewer1 = await prisma.user.upsert({
    where: { email: 'reviewer@thena.dev' },
    update: { passwordHash },
    create: {
      email: 'reviewer@thena.dev',
      name: 'Lic. Roberto Guzmán',
      role: 'REVIEWER',
      passwordHash,
    },
  });
  console.log(`  Reviewer 1: ${reviewer1.name} (${reviewer1.id})`);

  // ─── Admin ────────────────────────────────────────────────────────────────────

  const admin1 = await prisma.user.upsert({
    where: { email: 'admin@thena.dev' },
    update: { passwordHash },
    create: {
      email: 'admin@thena.dev',
      name: 'Ing. Patricia Salinas',
      role: 'ADMIN',
      passwordHash,
    },
  });
  console.log(`  Admin 1: ${admin1.name} (${admin1.id})`);

  // ─── Super Admin ──────────────────────────────────────────────────────────────

  const superAdmin1 = await prisma.user.upsert({
    where: { email: 'superadmin@thena.dev' },
    update: { passwordHash },
    create: {
      email: 'superadmin@thena.dev',
      name: 'Coordinación Académica',
      role: 'SUPER_ADMIN',
      passwordHash,
    },
  });
  console.log(`  Super Admin 1: ${superAdmin1.name} (${superAdmin1.id})`);

  // ─── Assignments (tutor + reviewer → students) ────────────────────────────────

  // Assign tutor1 + reviewer1 to student1
  await prisma.studentAssignment.upsert({
    where: { studentId: student1.id },
    update: { tutorId: tutor1.id, reviewerId: reviewer1.id },
    create: {
      studentId: student1.id,
      tutorId: tutor1.id,
      reviewerId: reviewer1.id,
    },
  });
  console.log(`  Assignment: ${student1.name} → Tutor: ${tutor1.name}, Reviewer: ${reviewer1.name}`);

  // Assign tutor2 to student2 (no reviewer yet)
  await prisma.studentAssignment.upsert({
    where: { studentId: student2.id },
    update: { tutorId: tutor2.id },
    create: {
      studentId: student2.id,
      tutorId: tutor2.id,
    },
  });
  console.log(`  Assignment: ${student2.name} → Tutor: ${tutor2.name}`);

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
