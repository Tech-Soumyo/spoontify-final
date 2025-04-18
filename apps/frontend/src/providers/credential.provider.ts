import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@repo/db";
import bcrypt from "bcryptjs";

const CredentialsAuth = CredentialsProvider({
  name: "Credentials",
  credentials: {
    email: { label: "Email", type: "email", required: true },
    password: { label: "Password", type: "password", required: true },
  },
  async authorize(credentials) {
    if (!credentials?.email || !credentials?.password) {
      throw new Error("Email and Password are required");
    }

    const user = await prisma.user.findUnique({
      where: { email: credentials.email },
    });

    if (
      !user ||
      !(await bcrypt.compare(credentials.password, user.password as string))
    ) {
      throw new Error("Invalid email or password");
    }

    return { id: user.id, name: user.name, email: user.email }; // ✅ This user is passed to `jwt` callback
  },
});

export default CredentialsAuth;
