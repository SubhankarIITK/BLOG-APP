import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const mongoUri = process.env.MONGODB_URI || "";
const jwtSecret = process.env.JWT_SECRET || "replace-this-secret-in-env";
const tokenTtl = "30d";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: "writer", enum: ["writer", "admin"] },
  avatarUrl: { type: String, default: null },
  bio: { type: String, default: "" },
}, { timestamps: true });

const storySchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  authorName: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  excerpt: { type: String, default: "" },
  content: { type: String, required: true },
  coverUrl: { type: String, default: null },
  category: { type: String, default: "Ideas", index: true },
  tags: [{ type: String, trim: true, index: true }],
  status: { type: String, enum: ["draft", "published"], default: "published", index: true },
  featured: { type: Boolean, default: false },
  viewCount: { type: Number, default: 0 },
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  publishedAt: { type: Date, default: null, index: true },
  autosavedAt: { type: Date, default: null, index: true },
  collaborators: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    addedAt: { type: Date, default: Date.now },
  }],
  lastEditedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, default: "" },
    at: { type: Date, default: null },
  },
}, { timestamps: true });

const bookmarkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  storyId: { type: mongoose.Schema.Types.ObjectId, ref: "Story", required: true, index: true },
}, { timestamps: true });
bookmarkSchema.index({ userId: 1, storyId: 1 }, { unique: true });

const likeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  storyId: { type: mongoose.Schema.Types.ObjectId, ref: "Story", required: true, index: true },
}, { timestamps: true });
likeSchema.index({ userId: 1, storyId: 1 }, { unique: true });

const commentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  storyId: { type: mongoose.Schema.Types.ObjectId, ref: "Story", required: true, index: true },
  authorName: { type: String, required: true },
  body: { type: String, required: true, trim: true, maxlength: 2000 },
}, { timestamps: true });

const aiUsageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  mode: { type: String, default: "writer", index: true },
  action: { type: String, default: "chat", index: true },
}, { timestamps: true });

const collaborationInviteSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  blogId: { type: mongoose.Schema.Types.ObjectId, ref: "Story", required: true, index: true },
  invitedEmail: { type: String, required: true, lowercase: true, trim: true },
  status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending", index: true },
  acceptedAt: { type: Date, default: null },
  rejectedAt: { type: Date, default: null },
}, { timestamps: true });
collaborationInviteSchema.index({ receiverId: 1, blogId: 1, status: 1 });

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Story = mongoose.models.Story || mongoose.model("Story", storySchema);
const Bookmark = mongoose.models.Bookmark || mongoose.model("Bookmark", bookmarkSchema);
const Like = mongoose.models.Like || mongoose.model("Like", likeSchema);
const Comment = mongoose.models.Comment || mongoose.model("Comment", commentSchema);
const AiUsage = mongoose.models.AiUsage || mongoose.model("AiUsage", aiUsageSchema);
const CollaborationInvite = mongoose.models.CollaborationInvite || mongoose.model("CollaborationInvite", collaborationInviteSchema);

let connectionPromise;

function requireMongoUri() {
  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing. Paste your MongoDB Atlas connection string into .env.");
  }
}

export async function connectDatabase() {
  requireMongoUri();
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || undefined });
  }
  await connectionPromise;
  await ensureAdminUser();
  await seedStarterContent();
  return mongoose.connection;
}

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function plainText(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeTags(tags = []) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 12))];
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    avatar_url: user.avatarUrl,
    bio: user.bio,
  };
}

function publicStory(story) {
  if (!story) return null;
  return {
    id: String(story._id),
    author_id: String(story.authorId),
    author: story.authorName,
    category: story.category,
    tags: story.tags || [],
    title: story.title,
    slug: story.slug,
    excerpt: story.excerpt,
    content: story.content,
    cover_url: story.coverUrl,
    status: story.status,
    featured: story.featured ? 1 : 0,
    view_count: story.viewCount,
    likes_count: story.likesCount,
    comments_count: story.commentsCount,
    collaborators: (story.collaborators || []).map((collaborator) => ({
      id: String(collaborator.userId),
      name: collaborator.name,
      email: collaborator.email,
      added_at: collaborator.addedAt?.toISOString() || null,
    })),
    last_edited_by: story.lastEditedBy?.name ? {
      id: story.lastEditedBy.userId ? String(story.lastEditedBy.userId) : null,
      name: story.lastEditedBy.name,
      at: story.lastEditedBy.at?.toISOString() || null,
    } : null,
    autosaved_at: story.autosavedAt?.toISOString() || null,
    published_at: story.publishedAt?.toISOString() || null,
    created_at: story.createdAt?.toISOString() || null,
    updated_at: story.updatedAt?.toISOString() || null,
    can_edit: !story.publishedAt || Date.now() - new Date(story.publishedAt).getTime() <= 24 * 60 * 60 * 1000,
  };
}

function publicInvite(invite) {
  if (!invite) return null;
  const story = invite.blogId && typeof invite.blogId === "object" ? invite.blogId : null;
  const sender = invite.senderId && typeof invite.senderId === "object" ? invite.senderId : null;
  const receiver = invite.receiverId && typeof invite.receiverId === "object" ? invite.receiverId : null;
  return {
    id: String(invite._id),
    blog_id: story?._id ? String(story._id) : String(invite.blogId),
    blog_title: story?.title || "",
    sender_id: sender?._id ? String(sender._id) : String(invite.senderId),
    sender_name: sender?.name || "",
    receiver_id: receiver?._id ? String(receiver._id) : String(invite.receiverId),
    receiver_name: receiver?.name || "",
    invited_email: invite.invitedEmail,
    status: invite.status,
    created_at: invite.createdAt?.toISOString() || null,
    accepted_at: invite.acceptedAt?.toISOString() || null,
    rejected_at: invite.rejectedAt?.toISOString() || null,
  };
}

function publicComment(comment) {
  if (!comment) return null;
  return {
    id: String(comment._id),
    story_id: String(comment.storyId),
    user_id: String(comment.userId),
    author: comment.authorName,
    body: comment.body,
    created_at: comment.createdAt?.toISOString() || null,
    updated_at: comment.updatedAt?.toISOString() || null,
  };
}

function isOwner(story, user) {
  return String(story.authorId) === String(user.id);
}

function isCollaborator(story, user) {
  return (story.collaborators || []).some((collaborator) => String(collaborator.userId) === String(user.id));
}

function canEditStory(story, user) {
  return isOwner(story, user) || isCollaborator(story, user);
}

function canReadStory(story, user) {
  return story.status === "published" || (user && canEditStory(story, user));
}

function rangeDate(range = "all") {
  const now = new Date();
  if (range === "day") return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (range === "week") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === "month") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
}

function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, jwtSecret, { expiresIn: tokenTtl });
}

export async function getUserFromToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await User.findById(payload.sub);
    return publicUser(user);
  } catch {
    return null;
  }
}

export async function createUser(email, name, password) {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) return null;
  const passwordHash = await bcrypt.hash(password, 12);
  const firstUser = await User.countDocuments() === 0;
  const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const role = firstUser || (adminEmail && adminEmail === normalizedEmail) ? "admin" : "writer";
  const user = await User.create({ email: normalizedEmail, name: name.trim(), passwordHash, role });
  return publicUser(user);
}

export async function loginUser(email, password) {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return { user: publicUser(user), token: signToken(user._id) };
}

export async function createSessionForUser(userId) {
  return signToken(userId);
}

export async function listStories() {
  const stories = await Story.find({ status: "published" }).sort({ publishedAt: -1, createdAt: -1 }).limit(100);
  return stories.map(publicStory);
}

export async function listStoriesForUser(userId) {
  const stories = await Story.find({ $or: [{ authorId: userId }, { "collaborators.userId": userId }] }).sort({ updatedAt: -1 });
  return stories.map(publicStory);
}

export async function getStory(id, user = null) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const story = await Story.findById(id);
  if (!story || !canReadStory(story, user)) return null;
  return publicStory(story);
}

export async function createStory(input, user) {
  const status = input.status === "draft" ? "draft" : "published";
  const story = await Story.create({
    authorId: user.id,
    authorName: user.name,
    title: input.title.trim(),
    slug: `${slugify(input.title)}-${randomUUID().slice(0, 6)}`,
    excerpt: input.excerpt?.trim() || plainText(input.content).slice(0, 150),
    content: input.content.trim(),
    coverUrl: input.coverUrl || null,
    tags: normalizeTags(input.tags),
    status,
    publishedAt: status === "published" ? new Date() : null,
  });
  return publicStory(story);
}

export async function updateStory(id, input, user) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const story = await Story.findById(id);
  if (!story) return null;
  if (!canEditStory(story, user)) {
    const error = new Error("You do not have edit permission for this story.");
    error.status = 403;
    throw error;
  }
  if (input.status === "published" && !isOwner(story, user)) {
    const error = new Error("Only the owner can publish this story.");
    error.status = 403;
    throw error;
  }
  if (story.publishedAt && Date.now() - new Date(story.publishedAt).getTime() > 24 * 60 * 60 * 1000) {
    const error = new Error("Editing window expired");
    error.status = 403;
    throw error;
  }
  if (input.title !== undefined) story.title = input.title.trim();
  if (input.excerpt !== undefined) story.excerpt = input.excerpt.trim();
  if (input.content !== undefined) story.content = input.content.trim();
  if (input.coverUrl !== undefined) story.coverUrl = input.coverUrl || null;
  if (input.tags !== undefined) story.tags = normalizeTags(input.tags);
  if (input.autosavedAt !== undefined) story.autosavedAt = input.autosavedAt;
  if (input.status !== undefined) {
    story.status = input.status === "draft" ? "draft" : "published";
    if (story.status === "published" && !story.publishedAt) story.publishedAt = new Date();
    if (story.status === "published") story.autosavedAt = null;
  }
  story.lastEditedBy = { userId: user.id, name: user.name, at: new Date() };
  await story.save();
  return publicStory(story);
}

export async function deleteStory(id, user) {
  if (!mongoose.Types.ObjectId.isValid(id)) return false;
  const criteria = user.role === "admin" ? { _id: id } : { _id: id, authorId: user.id };
  const result = await Story.deleteOne(criteria);
  if (result.deletedCount) await Promise.all([Bookmark.deleteMany({ storyId: id }), Like.deleteMany({ storyId: id }), Comment.deleteMany({ storyId: id })]);
  return result.deletedCount > 0;
}

export async function createCollaborationInvite(storyId, owner, invitedEmail) {
  if (!mongoose.Types.ObjectId.isValid(storyId)) return null;
  const story = await Story.findById(storyId);
  if (!story) return null;
  if (!isOwner(story, owner)) {
    const error = new Error("Only the owner can invite collaborators.");
    error.status = 403;
    throw error;
  }
  const email = String(invitedEmail || "").toLowerCase().trim();
  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("No registered user found for that email.");
    error.status = 404;
    throw error;
  }
  if (String(user._id) === String(story.authorId)) {
    const error = new Error("You cannot invite yourself.");
    error.status = 400;
    throw error;
  }
  if (isCollaborator(story, { id: user._id })) {
    const error = new Error("This user is already an accepted collaborator.");
    error.status = 409;
    throw error;
  }
  const existing = await CollaborationInvite.findOne({ blogId: story._id, receiverId: user._id });
  if (existing) {
    const error = new Error(`An invite already exists for this user with status: ${existing.status}.`);
    error.status = 409;
    throw error;
  }
  const invite = await CollaborationInvite.create({
    senderId: owner.id,
    receiverId: user._id,
    blogId: story._id,
    invitedEmail: user.email,
  });
  await invite.populate([{ path: "blogId" }, { path: "senderId" }, { path: "receiverId" }]);
  return publicInvite(invite);
}

export async function removeCollaborator(storyId, owner, collaboratorId) {
  if (!mongoose.Types.ObjectId.isValid(storyId) || !mongoose.Types.ObjectId.isValid(collaboratorId)) return null;
  const story = await Story.findById(storyId);
  if (!story) return null;
  if (!isOwner(story, owner)) {
    const error = new Error("Only the owner can remove collaborators.");
    error.status = 403;
    throw error;
  }
  story.collaborators = (story.collaborators || []).filter((collaborator) => String(collaborator.userId) !== String(collaboratorId));
  await story.save();
  return publicStory(story);
}

export async function listCollaborationInvites(user) {
  const [received, sent] = await Promise.all([
    CollaborationInvite.find({ receiverId: user.id }).sort({ createdAt: -1 }).populate(["blogId", "senderId", "receiverId"]),
    CollaborationInvite.find({ senderId: user.id }).sort({ createdAt: -1 }).populate(["blogId", "senderId", "receiverId"]),
  ]);
  return {
    received: received.map(publicInvite),
    sent: sent.map(publicInvite),
    pending_count: received.filter((invite) => invite.status === "pending").length,
  };
}

export async function respondToCollaborationInvite(inviteId, user, decision) {
  if (!mongoose.Types.ObjectId.isValid(inviteId)) return null;
  const invite = await CollaborationInvite.findById(inviteId).populate(["blogId", "senderId", "receiverId"]);
  if (!invite || String(invite.receiverId._id || invite.receiverId) !== String(user.id)) return null;
  if (invite.status !== "pending") {
    const error = new Error("This invite has already been answered.");
    error.status = 409;
    throw error;
  }
  if (decision === "accepted") {
    const story = await Story.findById(invite.blogId._id || invite.blogId);
    if (!story) return null;
    if (!isCollaborator(story, user)) {
      story.collaborators.push({ userId: user.id, name: user.name, email: user.email });
      await story.save();
    }
    invite.status = "accepted";
    invite.acceptedAt = new Date();
    await invite.save();
    await invite.populate(["blogId", "senderId", "receiverId"]);
    return { invite: publicInvite(invite), story: publicStory(story) };
  }
  invite.status = "rejected";
  invite.rejectedAt = new Date();
  await invite.save();
  await invite.populate(["blogId", "senderId", "receiverId"]);
  return { invite: publicInvite(invite), story: null };
}

export async function saveDraft(input, user) {
  const title = (input.title || "Untitled draft").trim().slice(0, 180) || "Untitled draft";
  const content = (input.content || "<p><br></p>").trim();
  if (input.storyId && mongoose.Types.ObjectId.isValid(input.storyId)) {
    const existing = await Story.findById(input.storyId);
    if (existing?.status === "published") {
      const error = new Error("Published stories cannot be converted back into autosaved drafts.");
      error.status = 400;
      throw error;
    }
    return updateStory(input.storyId, { title, content, tags: input.tags, status: "draft", autosavedAt: new Date() }, user);
  }
  const story = await Story.create({
    authorId: user.id,
    authorName: user.name,
    title,
    slug: `${slugify(title)}-${randomUUID().slice(0, 6)}`,
    excerpt: plainText(content).slice(0, 150),
    content,
    status: "draft",
    tags: normalizeTags(input.tags),
    autosavedAt: new Date(),
    lastEditedBy: { userId: user.id, name: user.name, at: new Date() },
  });
  return publicStory(story);
}

export async function getLatestDraft(user) {
  const story = await Story.findOne({
    status: "draft",
    $or: [{ authorId: user.id }, { "collaborators.userId": user.id }],
  }).sort({ autosavedAt: -1, updatedAt: -1 });
  return publicStory(story);
}

export async function discardDraft(storyId, user) {
  if (!mongoose.Types.ObjectId.isValid(storyId)) return false;
  const story = await Story.findById(storyId);
  if (!story || story.status !== "draft" || !canEditStory(story, user)) return false;
  if (!isOwner(story, user) && String(story.authorId) !== String(user.id)) {
    const error = new Error("Only the owner can discard this draft.");
    error.status = 403;
    throw error;
  }
  await Promise.all([Bookmark.deleteMany({ storyId }), Like.deleteMany({ storyId }), Comment.deleteMany({ storyId }), story.deleteOne()]);
  return true;
}

export async function listCommentsForStory(storyId) {
  if (!mongoose.Types.ObjectId.isValid(storyId)) return [];
  const story = await Story.findOne({ _id: storyId, status: "published" });
  if (!story) return [];
  const comments = await Comment.find({ storyId }).sort({ createdAt: -1 }).limit(100);
  return comments.map(publicComment);
}

export async function createComment(storyId, body, user) {
  if (!mongoose.Types.ObjectId.isValid(storyId)) return null;
  const story = await Story.findOne({ _id: storyId, status: "published" });
  if (!story) return null;
  const text = String(body || "").trim();
  if (text.length < 2 || text.length > 2000) {
    const error = new Error("Comment must be between 2 and 2,000 characters.");
    error.status = 400;
    throw error;
  }
  const comment = await Comment.create({ storyId, userId: user.id, authorName: user.name, body: text });
  await Story.updateOne({ _id: storyId }, { $inc: { commentsCount: 1 } });
  return publicComment(comment);
}

export async function deleteComment(commentId, user) {
  if (!mongoose.Types.ObjectId.isValid(commentId)) return false;
  const comment = await Comment.findById(commentId);
  if (!comment) return false;
  const story = await Story.findById(comment.storyId);
  const canDelete = user.role === "admin" || String(comment.userId) === String(user.id) || (story && String(story.authorId) === String(user.id));
  if (!canDelete) {
    const error = new Error("You do not have permission to delete this comment.");
    error.status = 403;
    throw error;
  }
  await comment.deleteOne();
  await Story.updateOne({ _id: comment.storyId, commentsCount: { $gt: 0 } }, { $inc: { commentsCount: -1 } });
  return true;
}

export async function listBookmarksForUser(userId) {
  const rows = await Bookmark.find({ userId }).sort({ createdAt: -1 }).populate("storyId");
  return rows.map((row) => publicStory(row.storyId)).filter(Boolean);
}

export async function toggleBookmark(userId, storyId) {
  if (!mongoose.Types.ObjectId.isValid(storyId)) return listBookmarksForUser(userId);
  const existing = await Bookmark.findOne({ userId, storyId });
  if (existing) {
    await existing.deleteOne();
  } else {
    const story = await Story.findOne({ _id: storyId, status: "published" });
    if (story) await Bookmark.create({ userId, storyId });
  }
  return listBookmarksForUser(userId);
}

export async function toggleLike(userId, storyId) {
  if (!mongoose.Types.ObjectId.isValid(storyId)) return null;
  const existing = await Like.findOne({ userId, storyId });
  if (existing) {
    await existing.deleteOne();
    await Story.updateOne({ _id: storyId, likesCount: { $gt: 0 } }, { $inc: { likesCount: -1 } });
  } else {
    const story = await Story.findOne({ _id: storyId, status: "published" });
    if (!story) return null;
    await Like.create({ userId, storyId });
    await Story.updateOne({ _id: storyId }, { $inc: { likesCount: 1 } });
  }
  return getStory(storyId);
}

export async function incrementStoryView(storyId) {
  if (!mongoose.Types.ObjectId.isValid(storyId)) return null;
  const story = await Story.findOneAndUpdate(
    { _id: storyId, status: "published" },
    { $inc: { viewCount: 1 } },
    { new: true },
  );
  return publicStory(story);
}

export async function getUserStats(userId) {
  const userStories = await Story.find({ $or: [{ authorId: userId }, { "collaborators.userId": userId }] });
  const storyIds = userStories.map((story) => story._id);
  const [bookmarks, totalReaders] = await Promise.all([
    Bookmark.countDocuments({ storyId: { $in: storyIds } }),
    Bookmark.distinct("userId", { storyId: { $in: storyIds } }),
  ]);
  return {
    stories: userStories.length,
    published: userStories.filter((story) => story.status === "published").length,
    drafts: userStories.filter((story) => story.status === "draft").length,
    views: userStories.reduce((sum, story) => sum + (story.viewCount || 0), 0),
    likes: userStories.reduce((sum, story) => sum + (story.likesCount || 0), 0),
    comments: userStories.reduce((sum, story) => sum + (story.commentsCount || 0), 0),
    bookmarks,
    readers: totalReaders.length,
  };
}

export async function recordAiUsage(input = {}) {
  await AiUsage.create({
    userId: mongoose.Types.ObjectId.isValid(input.userId) ? input.userId : null,
    mode: input.mode || "writer",
    action: input.action || "chat",
  });
}

export async function getAdminAnalytics(range = "all") {
  const since = rangeDate(range);
  const sinceFilter = since ? { createdAt: { $gte: since } } : {};
  const [users, newUsers, activeUserIds, stories, bookmarks, likes, aiUsage, aiByAction, categories, tags] = await Promise.all([
    User.countDocuments(),
    User.countDocuments(sinceFilter),
    Promise.all([
      Story.distinct("authorId", since ? { updatedAt: { $gte: since } } : {}),
      Bookmark.distinct("userId", sinceFilter),
      Like.distinct("userId", sinceFilter),
    ]),
    Story.find().sort({ updatedAt: -1 }).limit(500),
    Bookmark.countDocuments(sinceFilter),
    Like.countDocuments(sinceFilter),
    AiUsage.countDocuments(sinceFilter),
    AiUsage.aggregate([{ $match: sinceFilter }, { $group: { _id: "$action", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Story.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Story.aggregate([{ $unwind: "$tags" }, { $group: { _id: "$tags", count: { $sum: 1 }, views: { $sum: "$viewCount" }, likes: { $sum: "$likesCount" }, comments: { $sum: "$commentsCount" } } }, { $sort: { views: -1, count: -1 } }, { $limit: 20 }]),
  ]);
  const activeUsers = new Set(activeUserIds.flat().map(String));
  const totalWords = stories.reduce((sum, story) => sum + plainText(story.content || "").split(/\s+/).filter(Boolean).length, 0);
  const topContributors = await Story.aggregate([
    { $group: { _id: "$authorId", name: { $first: "$authorName" }, blogs: { $sum: 1 }, views: { $sum: "$viewCount" }, likes: { $sum: "$likesCount" } } },
    { $sort: { blogs: -1, views: -1 } },
    { $limit: 8 },
  ]);
  const publicStories = stories.map(publicStory);
  const trendingBlogs = [...publicStories].sort((a, b) => ((b.view_count || 0) + (b.likes_count || 0) * 3) - ((a.view_count || 0) + (a.likes_count || 0) * 3)).slice(0, 8);
  return {
    users: { total: users, active: activeUsers.size, new: newUsers, top_contributors: topContributors },
    blogs: {
      total: stories.length,
      published: stories.filter((story) => story.status === "published").length,
      drafts: stories.filter((story) => story.status === "draft").length,
      most_viewed: [...publicStories].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 8),
      most_liked: [...publicStories].sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0)).slice(0, 8),
      trending: trendingBlogs,
      category_distribution: categories.map((item) => ({ category: item._id || "Ideas", count: item.count })),
      top_tags: tags.map((item) => ({ tag: item._id, count: item.count, views: item.views, likes: item.likes, comments: item.comments })),
      avg_read_time: stories.length ? Math.max(1, Math.ceil((totalWords / stories.length) / 220)) : 0,
      completion_rate: stories.length ? Math.round((stories.filter((story) => story.status === "published").length / stories.length) * 100) : 0,
    },
    engagement: {
      likes,
      comments: await Comment.countDocuments(sinceFilter),
      bookmarks,
      views: stories.reduce((sum, story) => sum + (story.viewCount || 0), 0),
    },
    ai: { requests: aiUsage, by_action: aiByAction.map((item) => ({ action: item._id || "chat", count: item.count })) },
    tables: { users: topContributors, blogs: publicStories.slice(0, 50) },
  };
}

export async function databaseInfo() {
  return {
    driver: "mongodb-atlas",
    configured: Boolean(mongoUri),
    state: mongoose.connection.readyState,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
    stories: mongoose.connection.readyState === 1 ? await Story.countDocuments() : 0,
    users: mongoose.connection.readyState === 1 ? await User.countDocuments() : 0,
  };
}

async function seedStarterContent() {
  const users = await User.countDocuments();
  if (users > 0) return;
  const passwordHash = await bcrypt.hash("demo1234", 12);
  const demo = await User.create({ name: "Demo Writer", email: "demo@luma.local", passwordHash });
  await Story.create([
    {
      authorId: demo._id,
      authorName: demo.name,
      title: "The quiet art of building things that last",
      slug: "the-quiet-art-of-building-things-that-last",
      excerpt: "In a world obsessed with speed, a different kind of ambition is emerging: the patience to make work with a longer half-life.",
      content: "<p>Durable work comes from knowing which details deserve another pass and which ones are ready to breathe on their own.</p>",
      coverUrl: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1400&q=85",
      category: "Ideas",
      status: "published",
      featured: true,
      publishedAt: new Date(),
      viewCount: 8240,
    },
    {
      authorId: demo._id,
      authorName: demo.name,
      title: "The case for a personal archive",
      slug: "the-case-for-a-personal-archive",
      excerpt: "What we save shapes what we remember. A small system for keeping the ideas that keep you moving.",
      content: "<p>A personal archive is less about collecting everything and more about keeping what changes the way you see.</p>",
      coverUrl: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=85",
      category: "Ideas",
      status: "published",
      publishedAt: new Date(),
      viewCount: 3651,
    },
  ]);
}

async function ensureAdminUser() {
  const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || !password || password.length < 8) return;
  const name = process.env.ADMIN_NAME || "Luma Admin";
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== "admin") {
      existing.role = "admin";
      await existing.save();
    }
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({ name, email, passwordHash, role: "admin" });
}
