import { Router } from "express";
import { authenticate, requireRole } from "../auth/auth.middleware.js";
import {
  getArchiveCard,
  getArchiveGraph,
  listArchiveBoards,
  listArchiveCards,
  operateArchive,
} from "./archive.service.js";
export const archiveRouter = Router();
archiveRouter.use(authenticate, requireRole("MASTER"));
archiveRouter.get("/boards", async (req, res) =>
  res.json({
    boards: await listArchiveBoards({
      userId: req.user!.sub,
      role: req.user!.role,
    }),
  }),
);
archiveRouter.get("/boards/:id", async (req, res) =>
  res.json(
    await getArchiveGraph(
      { userId: req.user!.sub, role: req.user!.role },
      String(req.params.id),
    ),
  ),
);
archiveRouter.get("/cards", async (req, res) =>
  res.json({
    cards: await listArchiveCards({
      userId: req.user!.sub,
      role: req.user!.role,
    }),
  }),
);
archiveRouter.get("/cards/:id", async (req, res) =>
  res.json(
    await getArchiveCard(
      { userId: req.user!.sub, role: req.user!.role },
      String(req.params.id),
    ),
  ),
);
archiveRouter.post("/operations", async (req, res) =>
  res.json(
    await operateArchive(
      { userId: req.user!.sub, role: req.user!.role },
      req.body,
    ),
  ),
);
