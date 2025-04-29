import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextAuth";
import { prisma } from "@repo/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const { accessToken, refreshToken, expiresAt } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: "Missing accessToken" });
  }

  try {
    // Update the user's Spotify tokens
    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        spotifyAccessToken: accessToken,
        ...(refreshToken && { spotifyRefreshToken: refreshToken }),
        tokenExpiresAt: new Date(expiresAt), // 1 hour from now
      },
    });

    // Note: This doesn't update the current session, just the database
    // The session will have the updated token on next auth check

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Update token error:", error);
    res.status(500).json({ error: "Failed to update token" });
  }
}
