import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { createContextualMessages, createPrompt } from "./prompts.js";
import {
  connectDatabase,
  createSessionForUser,
  createStory,
  createUser,
  createCollaborationInvite,
  createComment,
  databaseInfo,
  deleteComment,
  deleteStory,
  discardDraft,
  getAdminAnalytics,
  getLatestDraft,
  getStory,
  getUserStats,
  incrementStoryView,
  getUserFromToken,
  listCollaborationInvites,
  listBookmarksForUser,
  listCommentsForStory,
  listStories,
  listStoriesForUser,
  loginUser,
  recordAiUsage,
  removeCollaborator,
  respondToCollaborationInvite,
  saveDraft,
  toggleLike,
  toggleBookmark,
  updateStory,
} from "./database.js";

const app = express();
const port = Number(process.env.PORT || 8787);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.set("trust proxy", 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      "default-src": ["'self'"],
      "img-src": ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "connect-src": ["'self'", "https://api.groq.com"],
    },
  },
}));
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") || ["http://localhost:5173"], methods: ["GET", "POST", "PUT", "DELETE"] }));
app.use(express.json({ limit: "128kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 80, standardHeaders: "draft-7", legacyHeaders: false }));

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

async function authenticate(request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  return token ? getUserFromToken(token) : null;
}

async function requireAuth(request, response) {
  const user = await authenticate(request);
  if (!user) {
    response.status(401).json({ error: "Please sign in to continue." });
    return null;
  }
  return user;
}

async function requireAdmin(request, response) {
  const user = await requireAuth(request, response);
  if (!user) return null;
  if (user.role !== "admin") {
    response.status(403).json({ error: "Admin access required." });
    return null;
  }
  return user;
}

app.get("/api/v1/health", asyncRoute(async (_, response) => {
  response.json({
    status: "ok",
    service: "luma-api",
    database: await databaseInfo(),
    groq: { configured: Boolean(process.env.GROQ_API_KEY), model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile" },
    timestamp: new Date().toISOString(),
  });
}));

app.post("/api/v1/auth/signup", asyncRoute(async (request, response) => {
  const { email = "", name = "", password = "" } = request.body || {};
  if (typeof email !== "string" || typeof name !== "string" || typeof password !== "string") {
    return response.status(400).json({ error: "Email, name, and password are required." });
  }
  if (!email.includes("@") || email.length < 5) return response.status(400).json({ error: "A valid email is required." });
  if (name.trim().length < 2) return response.status(400).json({ error: "Name must be at least 2 characters." });
  if (password.length < 8) return response.status(400).json({ error: "Password must be at least 8 characters." });
  const user = await createUser(email, name, password);
  if (!user) return response.status(409).json({ error: "Email is already in use." });
  const token = await createSessionForUser(user.id);
  response.status(201).json({ user, token });
}));

app.post("/api/v1/auth/login", asyncRoute(async (request, response) => {
  const { email = "", password = "" } = request.body || {};
  if (typeof email !== "string" || typeof password !== "string" || !email.includes("@")) {
    return response.status(400).json({ error: "A valid email and password are required." });
  }
  const result = await loginUser(email, password);
  if (!result) return response.status(401).json({ error: "Invalid email or password." });
  response.json(result);
}));

app.post("/api/v1/auth/logout", (_, response) => {
  response.status(204).end();
});

app.get("/api/v1/auth/me", asyncRoute(async (request, response) => {
  const user = await authenticate(request);
  if (!user) return response.status(401).json({ error: "Not authenticated." });
  response.json({ user });
}));

app.get("/api/v1/bookmarks", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  response.json({ bookmarks: await listBookmarksForUser(user.id) });
}));

app.get("/api/v1/stats/me", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  response.json({ stats: await getUserStats(user.id) });
}));

app.get("/api/v1/admin/analytics", asyncRoute(async (request, response) => {
  const user = await requireAdmin(request, response);
  if (!user) return;
  response.json({ analytics: await getAdminAnalytics(String(request.query.range || "all")) });
}));

app.delete("/api/v1/admin/stories/:id", asyncRoute(async (request, response) => {
  const user = await requireAdmin(request, response);
  if (!user) return;
  if (!await deleteStory(request.params.id, user)) return response.status(404).json({ error: "Story not found." });
  response.status(204).end();
}));

app.post("/api/v1/bookmarks/:storyId", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  response.json({ bookmarks: await toggleBookmark(user.id, request.params.storyId) });
}));

app.post("/api/v1/stories/:id/like", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const story = await toggleLike(user.id, request.params.id);
  if (!story) return response.status(404).json({ error: "Story not found." });
  response.json({ story });
}));

app.post("/api/v1/stories/:id/view", asyncRoute(async (request, response) => {
  const story = await incrementStoryView(request.params.id);
  if (!story) return response.status(404).json({ error: "Story not found." });
  response.json({ story });
}));

app.get("/api/v1/stories/:id/comments", asyncRoute(async (request, response) => {
  response.json({ comments: await listCommentsForStory(request.params.id) });
}));

app.post("/api/v1/stories/:id/comments", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const { body = "" } = request.body || {};
  if (typeof body !== "string") return response.status(400).json({ error: "Comment text is required." });
  const comment = await createComment(request.params.id, body, user);
  if (!comment) return response.status(404).json({ error: "Story not found." });
  response.status(201).json({ comment });
}));

app.delete("/api/v1/comments/:id", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  if (!await deleteComment(request.params.id, user)) return response.status(404).json({ error: "Comment not found." });
  response.status(204).end();
}));

app.post("/api/v1/uploads/image", upload.single("image"), asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  if (!request.file) return response.status(400).json({ error: "Image file is required." });
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return response.status(500).json({ error: "Cloudinary is not configured. Add Cloudinary variables to .env." });
  }
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "luma-journal/posts", resource_type: "image" },
      (error, uploadResult) => error ? reject(error) : resolve(uploadResult),
    );
    stream.end(request.file.buffer);
  });
  response.status(201).json({ url: result.secure_url, publicId: result.public_id });
}));

app.get("/api/v1/stories", asyncRoute(async (_, response) => {
  response.json({ stories: await listStories() });
}));

app.get("/api/v1/stories/mine", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  response.json({ stories: await listStoriesForUser(user.id) });
}));

app.get("/api/v1/collaboration-invites", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  response.json({ invites: await listCollaborationInvites(user) });
}));

app.post("/api/v1/collaboration-invites/:id/accept", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const result = await respondToCollaborationInvite(request.params.id, user, "accepted");
  if (!result) return response.status(404).json({ error: "Invite not found." });
  response.json(result);
}));

app.post("/api/v1/collaboration-invites/:id/reject", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const result = await respondToCollaborationInvite(request.params.id, user, "rejected");
  if (!result) return response.status(404).json({ error: "Invite not found." });
  response.json(result);
}));

app.get("/api/v1/drafts/latest", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  response.json({ draft: await getLatestDraft(user) });
}));

app.post("/api/v1/drafts", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const { storyId = "", title = "", content = "", tags = [] } = request.body || {};
  if (typeof title !== "string" || typeof content !== "string") {
    return response.status(400).json({ error: "Title and content are required." });
  }
  if (content.length > 50_000) return response.status(400).json({ error: "Draft is too long." });
  response.json({ draft: await saveDraft({ storyId, title, content, tags }, user) });
}));

app.delete("/api/v1/drafts/:id", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  if (!await discardDraft(request.params.id, user)) return response.status(404).json({ error: "Draft not found." });
  response.status(204).end();
}));

app.get("/api/v1/stories/:id", asyncRoute(async (request, response) => {
  const user = await authenticate(request);
  const story = await getStory(request.params.id, user);
  if (!story) return response.status(404).json({ error: "Story not found." });
  response.json({ story });
}));

app.post("/api/v1/stories", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const { title = "", content = "", excerpt = "", coverUrl = "", status = "published", tags = [] } = request.body || {};
  if (typeof title !== "string" || title.trim().length < 5 || title.length > 180) {
    return response.status(400).json({ error: "Title must be between 5 and 180 characters." });
  }
  if (typeof content !== "string" || content.trim().length < 20 || content.length > 50_000) {
    return response.status(400).json({ error: "Content must be between 20 and 50,000 characters." });
  }
  response.status(201).json({ story: await createStory({ title, content, excerpt, coverUrl, status, tags }, user) });
}));

app.put("/api/v1/stories/:id", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const { title, content, excerpt, coverUrl, status, tags } = request.body || {};
  if (title !== undefined && (typeof title !== "string" || title.trim().length < 5 || title.length > 180)) {
    return response.status(400).json({ error: "Title must be between 5 and 180 characters." });
  }
  if (content !== undefined && (typeof content !== "string" || content.trim().length < 20 || content.length > 50_000)) {
    return response.status(400).json({ error: "Content must be between 20 and 50,000 characters." });
  }
  const story = await updateStory(request.params.id, { title, content, excerpt, coverUrl, status, tags }, user);
  if (!story) return response.status(404).json({ error: "Story not found." });
  response.json({ story });
}));

app.post("/api/v1/stories/:id/collaborators", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const { email = "", invite = "" } = request.body || {};
  const invitedEmail = email || invite;
  if (typeof invitedEmail !== "string" || !invitedEmail.includes("@")) {
    return response.status(400).json({ error: "Enter a registered email address." });
  }
  const createdInvite = await createCollaborationInvite(request.params.id, user, invitedEmail);
  if (!createdInvite) return response.status(404).json({ error: "Story not found." });
  response.status(201).json({ invite: createdInvite });
}));

app.delete("/api/v1/stories/:id/collaborators/:userId", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const story = await removeCollaborator(request.params.id, user, request.params.userId);
  if (!story) return response.status(404).json({ error: "Story not found." });
  response.json({ story });
}));

app.delete("/api/v1/stories/:id", asyncRoute(async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  if (!await deleteStory(request.params.id, user)) {
    return response.status(404).json({ error: "Story not found, or you do not own it." });
  }
  response.status(204).end();
}));

app.post("/api/v1/ai/assist", asyncRoute(async (request, response) => {
  const currentUser = await authenticate(request);
  const { action = "improve", content = "", draft = "", question = "", memory = [], selectedText = "", mode = "writer", tags = [] } = request.body || {};
  const context = draft || content;
  if (typeof context !== "string" || context.trim().length < 10 || context.length > 50_000) {
    return response.status(400).json({ error: "Draft/article context must be between 10 and 50,000 characters." });
  }
  if (!process.env.GROQ_API_KEY) {
    await recordAiUsage({ userId: currentUser?.id, mode, action });
    return response.json({
      result: "Try grounding the opening in one vivid moment. Your central idea is already clear; one specific detail will give the reader a stronger way into it.",
      source: "demo",
    });
  }
  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: question
        ? createContextualMessages({ mode, draft: context, selectedText, memory, question, action, tags })
        : [{ role: "system", content: "You are Luma AI, a calm and practical editorial assistant. Be concise." }, { role: "user", content: createPrompt(action, context, tags) }],
      temperature: 0.55,
      max_tokens: question ? 950 : 420,
    }),
  });
  if (!groqResponse.ok) throw new Error(`Groq request failed with status ${groqResponse.status}`);
  const data = await groqResponse.json();
  await recordAiUsage({ userId: currentUser?.id, mode, action });
  response.json({ result: data.choices?.[0]?.message?.content || "No suggestion generated.", source: "groq" });
}));

app.use(express.static(path.join(root, "dist")));
app.get("*", (_, response) => response.sendFile(path.join(root, "dist", "index.html")));
app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.status || 500).json({ error: error.message || "Something went wrong. Please try again." });
});

connectDatabase()
  .then(() => app.listen(port, () => console.log(`Luma API listening on http://localhost:${port}`)))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
