// import express, { Request, Response } from "express";

// import rateLimit from "express-rate-limit";
// import axios from "axios";
// import { prisma } from "@repo/db";
// const searchLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 50, // 50 requests per window
// });
// const router = express.Router();

// interface SpotifyTrack {
//   id: string;
//   name: string;
//   artists: Array<{ name: string }>;
//   album: {
//     name: string;
//     images: Array<{ url: string }>;
//   };
//   preview_url: string;
//   popularity: number;
//   uri: string;
//   duration_ms: number;
// }

// export interface FormattedTrack {
//   id: string;
//   name: string;
//   artists: string[];
//   album: {
//     name: string;
//     imageUrl: string;
//   };
//   previewUrl: string | null;
//   popularity: number;
//   uri: string;
//   duration: number;
// }

// export const searchSongs = async (
//   accessToken: string,
//   query: string
// ): Promise<FormattedTrack[]> => {
//   if (!query.trim()) {
//     return [];
//   }

//   try {
//     const response = await axios.get<{ tracks: { items: SpotifyTrack[] } }>(
//       "https://api.spotify.com/v1/search",
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//         },
//         params: {
//           q: query.trim(),
//           type: "track",
//           limit: 10,
//         },
//       }
//     );

//     return response.data.tracks.items.map((track) => ({
//       id: track.id,
//       name: track.name,
//       artists: track.artists.map((artist) => artist.name),
//       album: {
//         name: track.album.name,
//         imageUrl: track.album.images[0]?.url || "",
//       },
//       previewUrl: track.preview_url || null,
//       popularity: track.popularity,
//       uri: track.uri,
//       duration: track.duration_ms,
//     }));
//   } catch (error) {
//     console.error("Spotify API Error:", error);
//     throw new Error("Failed to search songs on Spotify");
//   }
// };

// router.post(
//   "/search",
//   searchLimiter,
//   async (req: Request, res: Response): Promise<void> => {
//     const { roomCode, query } = req.body;

//     try {
//       const roomKey = `room:${roomCode}:meta`;
//       const owner = await prisma.room.findUnique({
//         where: {
//           roomCode,
//         },
//         include: {
//           owner: true,
//         },
//       });
//       const ownerToken = owner?.owner.spotifyAccessToken;
//       console.log("Owner", ownerToken);

//       if (!ownerToken) {
//         res.status(400).json({ error: "Room owner not connected to Spotify" });
//         return;
//       }

//       const results = await searchSongs(ownerToken, query);

//       res.json({ results });

//       return;
//     } catch (error) {
//       console.error("Search error:", error);
//       res.status(500).json({
//         error:
//           error instanceof Error ? error.message : "Failed to search songs",
//       });
//       return;
//     }
//   }
// );

// export default router;
