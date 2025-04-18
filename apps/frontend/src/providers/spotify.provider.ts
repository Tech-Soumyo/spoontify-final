import SpotifyProvider from "next-auth/providers/spotify";

const SpotifyAuth = SpotifyProvider({
  clientId: process.env.SPOTIFY_CLIENT_ID!,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
  authorization:
    "https://accounts.spotify.com/authorize?scope=streaming user-read-private user-read-email user-library-read playlist-read-private playlist-read-collaborative user-modify-playback-state user-read-playback-state",
});

export default SpotifyAuth;
