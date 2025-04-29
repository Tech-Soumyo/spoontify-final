import axios from "axios";

type SpotifyRefreshResponse = {
  accessToken: string;
  accessTokenExpires: number;
  refreshToken: string;
} | null;

async function refreshSpotifyToken(
  refreshToken: string
): Promise<SpotifyRefreshResponse> {
  try {
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

    if (!refreshToken) {
      console.error("Missing refresh token");
      return null;
    }

    return {
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000, // Expires in milliseconds
      refreshToken: refreshedTokens.refresh_token || refreshToken, // Use new or fallback to old refresh token
    };
  } catch (error: any) {
    console.error(
      "Error refreshing Spotify token:",
      error.response?.data?.error || error.message
    );
    return null;
  }
}
export default refreshSpotifyToken;
