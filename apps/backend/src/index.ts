// apps/express-backend/src/index.ts
import express from "express";
import cors from "cors";
import { prisma } from "@repo/db";
import http from "http";
import { io } from "./lib/socket";
import * as dotenv from "dotenv";
import spotifyroutes from "../src/routes/updated.spotifySong.route";
// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

const server = http.createServer(app);

// Attach Socket.IO to the server
app.use(
  cors({
    origin: "*",
  })
);
io.attach(server);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/spotify/search", spotifyroutes);

// Test database connection before starting server
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log("Successfully connected to database");

    server.listen(port, () => {
      console.log(`Express server listening on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to connect to database:", error);
    process.exit(1);
  }
}

startServer().catch((error) => {
  console.error("Startup error:", error);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log(
    "SIGTERM received. Closing HTTP server and database connection..."
  );
  await prisma.$disconnect();
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});
