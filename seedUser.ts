import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://dummy:dummy@localhost:5432/qcv" // The fallback string won't work to actually connect to neon!
    }
  }
});

// We should use the actual env URL or just use Prisma normally assuming env variables are loaded
import * as dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres")
  ? process.env.DATABASE_URL
  : "postgresql://dummy:dummy@localhost:5432/qcv";

const realPrisma = new PrismaClient({
  datasources: { db: { url: dbUrl } }
});

async function main() {
  const email = 'shaoncmd@gmail.com';
  const password = 'vnc1122';
  
  const existing = await realPrisma.user.findUnique({ where: { email } });
  const hashedPassword = await bcrypt.hash(password, 10);

  if (existing) {
    await realPrisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    });
    console.log('User already existed. Updated password.');
  } else {
    await realPrisma.user.create({
      data: { email, password: hashedPassword }
    });
    console.log('Creator account created successfully!');
  }
}

main()
  .catch(console.error)
  .finally(() => realPrisma.$disconnect());
