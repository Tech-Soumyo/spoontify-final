import axios from "axios";

export type SpotifyRefreshResponse = {
  accessToken: string;
  accessTokenExpires: number;
  refreshToken: string;
} | null;

async function refreshSpotifyToken(
  refreshToken: string
): Promise<SpotifyRefreshResponse> {
  if (!refreshToken) {
    console.log("Missing refresh token");
    return null;
  }
  try {
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      console.error("Missing Spotify credentials");
      return null;
    }

    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const refreshedTokens = response.data;
    console.log("Refreshed tokens:", JSON.stringify(refreshedTokens));

    const result = {
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token || refreshToken,
    };

    // Persist tokens
    const baseUrl =
      typeof window === "undefined"
        ? process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        : "";

    await axios.post(`${baseUrl}/api/auth/update-token`, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.accessTokenExpires,
    });

    return result;
  } catch (error: any) {
    console.error(
      "Error refreshing Spotify token:",
      error.response?.data || error.message || error
    );

    // Check for specific error cases
    if (
      error.response?.status === 400 &&
      error.response?.data?.error === "invalid_grant"
    ) {
      console.error("Invalid refresh token - user may need to re-authenticate");
    } else if (error.response?.status === 401) {
      console.error(
        "Invalid client credentials - check SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET"
      );
    }

    return null;
  }
}

export default refreshSpotifyToken;
