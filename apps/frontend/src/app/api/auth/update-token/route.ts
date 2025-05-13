import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, refreshToken, expiresAt } = body;

    if (!accessToken || !refreshToken || !expiresAt) {
      return NextResponse.json(
        { error: "Missing required token information" },
        { status: 400 }
      );
    } // Get the current user's session and update their tokens
    // This endpoint is called from refreshSpotifyToken which has the user context
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { spotifyRefreshToken: refreshToken },
          { spotifyAccessToken: { not: null } },
        ],
      },
      orderBy: {
        tokenExpiresAt: "desc",
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "No user found with valid Spotify tokens" },
        { status: 404 }
      );
    }

    // Update the user's tokens
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        spotifyAccessToken: accessToken,
        spotifyRefreshToken: refreshToken,
        tokenExpiresAt: new Date(expiresAt),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating tokens:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update tokens" },
      { status: 500 }
    );
  }
}
