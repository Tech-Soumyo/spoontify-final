import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextAuth";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { accessToken, refreshToken, expiresAt } = body;

    if (!accessToken || !expiresAt) {
      return NextResponse.json(
        { error: "Missing accessToken or expiresAt" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        spotifyAccessToken: accessToken,
        ...(refreshToken && { spotifyRefreshToken: refreshToken }),
        tokenExpiresAt: new Date(expiresAt),
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.log("Update token error:", error);
    return NextResponse.json(
      { error: "Failed to update token" },
      { status: 500 }
    );
  }
}
