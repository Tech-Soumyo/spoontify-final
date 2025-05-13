import { SpotifyUserData } from "@/types/user.type";
import axios from "axios";

const SPOTIFY_API_URL = "https://api.spotify.com/v1/me";
export const getSpotifyUser = async (
  accessToken: string
): Promise<SpotifyUserData> => {
  try {
    const response = await axios.get(SPOTIFY_API_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    // console.log("useSpotifyUser.ts", response.data);
    return response.data; // Axios already parses the response as JSON
  } catch (error: any) {
    console.log("Error fetching Spotify user data:", error);
    throw error; // Re-throw the error to handle it in the calling function
  }
};
