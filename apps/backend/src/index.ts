// apps/express-backend/src/index.ts
import express from "express";
import cors from "cors";
import { prisma } from "@repo/db";
import http from "http";
// import io from "./lib/socket";

const app = express();
const port = process.env.PORT || 5000;

const server = http.createServer(app);

// Attach Socket.IO to the server

app.use(
  cors({
    origin: "*",
  })
);
// io.attach(server);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

server.listen(port, async () => {
  const user = await prisma.user.findFirst();
  console.log(user?.id);
  console.log(user?.email);
  console.log(`Express server listening on port ${port}`);
});
