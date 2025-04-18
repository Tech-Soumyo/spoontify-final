import axios from "axios";

async function refreshSpotifyToken(refreshToken: string) {
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

    return {
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000, // Expires in milliseconds
      refreshToken: refreshedTokens.refresh_token || refreshToken, // Use new or fallback to old refresh token
    };
  } catch (error: any) {
    console.error(
      "Error refreshing Spotify token:",
      error.response?.data || error.message
    );
    return null;
  }
}
export default refreshSpotifyToken;
