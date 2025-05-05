import refreshSpotifyToken from "@/hooks/refreshToaken";
import { getSpotifyUser } from "@/hooks/useSpotifyUser";

import CredentialsAuth from "@/providers/credential.provider";
import SpotifyAuth from "@/providers/spotify.provider";
import { SpotifyUserData } from "@/types/user.type";

import { prisma } from "@repo/db";
import { DefaultSession, NextAuthOptions } from "next-auth";

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    spotifyUserId?: string;
    spotifyName?: string;
    spotifyEmail?: string;
    spotifyProduct?: boolean;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    error?: string;
    user?: {
      userId: string;
      name: string;
      email: string;
      phone: string;
      spotifyId?: string | null;
      spotifyName?: string | null;
      spotifyEmail?: string | null;
      isPremium?: boolean;
    } & DefaultSession["user"];
  }
}

export const authOptions: NextAuthOptions = {
  providers: [CredentialsAuth, SpotifyAuth],
  secret: process.env.NEXTAUTH_SECRET || "development_secret",
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial login: set all values
      if (account && user) {
        token.userId = user.id;
        token.email = user.email;
        token.name = user.name;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires =
          Number(account.expires_in ?? 3600) * 1000 + Date.now();

        if (account.provider === "spotify" && account.access_token) {
          try {
            const spotyUserData: SpotifyUserData = await getSpotifyUser(
              account.access_token
            );
            if (spotyUserData) {
              token.spotifyUserId = spotyUserData.id!;
              token.spotifyEmail = spotyUserData.email;
              token.spotifyName = spotyUserData.display_name;

              const spoontifyUser = await prisma.user.update({
                where: { email: user.email! },
                data: {
                  spotifyEmail: spotyUserData.email,
                  spotifyId: spotyUserData.id,
                  spotifyName: spotyUserData.display_name,
                  premium: spotyUserData.product === "premium",
                  spotifyAccessToken: token.accessToken,
                  spotifyRefreshToken: token.refreshToken,
                  tokenExpiresAt: new Date(token.accessTokenExpires as number),
                },
              });

              token.spotifyProduct = spoontifyUser.premium;
            }
          } catch (error) {
            console.log("Failed to fetch or update Spotify user data", error);
            token.error = "SpotifyUserSyncError";
          }
        }
        return token;
      }

      // Check if token is expired
      if (Date.now() < (token.accessTokenExpires ?? 0) - 5 * 60 * 1000) {
        return token;
      }

      console.log("Access token expired, refreshing...");
      const refreshedToken = await refreshSpotifyToken(
        token.refreshToken as string
      );

      if (!refreshedToken) {
        console.warn("First refresh failed, retrying...");
        const retryToken = await refreshSpotifyToken(
          token.refreshToken as string
        );
        if (!retryToken) {
          console.log("Retry also failed");
          return { ...token, error: "RefreshAccessTokenError" };
        }
        return { ...token, ...retryToken };
      }

      token.accessToken = refreshedToken.accessToken;
      token.accessTokenExpires = refreshedToken.accessTokenExpires;
      token.refreshToken = refreshedToken.refreshToken;

      // Persist refreshed tokens to database
      try {
        await prisma.user.update({
          where: { email: token.email! },
          data: {
            spotifyAccessToken: refreshedToken.accessToken,
            spotifyRefreshToken: refreshedToken.refreshToken,
            tokenExpiresAt: new Date(refreshedToken.accessTokenExpires),
          },
        });
      } catch (error) {
        console.log("Failed to persist refreshed tokens:", error);
        token.error = "DatabaseUpdateError";
      }

      return token;
    },
    async session({ token, session }) {
      if (token) {
        const spoontifyUser = await prisma.user.findUnique({
          where: { email: token.email! },
        });
        if (spoontifyUser) {
          session.user = {
            userId: spoontifyUser.id,
            name: spoontifyUser.name,
            email: spoontifyUser.email!,
            phone: spoontifyUser.phone || "",
            isPremium: spoontifyUser.premium,
            spotifyEmail: spoontifyUser.spotifyEmail,
            spotifyId: spoontifyUser.spotifyId,
            spotifyName: spoontifyUser.spotifyName,
          };
          session.expires = spoontifyUser.tokenExpiresAt?.getTime().toString()!;
        } else {
          console.warn("User not found in DB, returning fallback session.");
          session.user = {
            userId: token.userId,
            name: token.name!,
            email: token.email!,
            phone: "",
          };
        }
      }
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;

      if (token.error) {
        session.error = token.error;
      }

      // console.info("[NextAuth] Session created:", session);
      return session;
    },
    async redirect({ url, baseUrl }) {
      return baseUrl + "/createjoin";
    },
  },
};
