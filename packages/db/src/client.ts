import {
  PrismaClient,
  User as PrismaUser,
} from "../generated/client/client.js";
// import dotenv from "dotenv";

// dotenv.config();

// export const DATABASE_URL = process.env.DATABASE_URL;

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
