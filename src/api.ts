import type { Article } from "./data";

type DatabaseStory = {
  id: string;
  author_id?: string;
  title: string;
  excerpt: string;
  content: string;
  cover_url: string | null;
  author: string;
  category: string | null;
  tags?: string[];
  published_at: string | null;
  view_count?: number;
  likes_count?: number;
  comments_count?: number;
  can_edit?: boolean;
  collaborators?: { id: string; name: string; email: string; added_at?: string | null }[];
  last_edited_by?: { id: string | null; name: string; at?: string | null } | null;
  autosaved_at?: string | null;
  status?: "draft" | "published";
  created_at?: string | null;
  updated_at?: string | null;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  bio: string | null;
};

export type DashboardStats = {
  stories: number;
  published: number;
  drafts: number;
  views: number;
  likes: number;
  comments: number;
  bookmarks: number;
  readers: number;
};

export type AdminAnalytics = {
  users: { total: number; active: number; new: number; top_contributors: { name: string; blogs: number; views: number; likes: number }[] };
  blogs: {
    total: number;
    published: number;
    drafts: number;
    most_viewed: DatabaseStory[];
    most_liked: DatabaseStory[];
    trending: DatabaseStory[];
    category_distribution: { category: string; count: number }[];
    top_tags: { tag: string; count: number; views: number; likes: number; comments: number }[];
    avg_read_time: number;
    completion_rate: number;
  };
  engagement: { likes: number; comments: number; bookmarks: number; views: number };
  ai: { requests: number; by_action: { action: string; count: number }[] };
  tables: { users: { name: string; blogs: number; views: number; likes: number }[]; blogs: DatabaseStory[] };
};

export type CollaborationInvite = {
  id: string;
  blogId: string;
  blogTitle: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  invitedEmail: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
};

export type CollaborationInvites = {
  received: CollaborationInvite[];
  sent: CollaborationInvite[];
  pendingCount: number;
};

export type BlogComment = {
  id: string;
  storyId: string;
  userId: string;
  author: string;
  body: string;
  createdAt: string | null;
  updatedAt: string | null;
};

const fallbackImage = "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=85";
const storageKey = "luma-auth-token";

export function plainText(value: string) {
  const document = new DOMParser().parseFromString(value, "text/html");
  return document.body.textContent || "";
}

export function sanitizeHtml(value: string) {
  const document = new DOMParser().parseFromString(value, "text/html");
  const allowed = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "MARK", "H2", "H3", "UL", "OL", "LI", "BLOCKQUOTE", "A", "IMG", "FIGURE", "FIGCAPTION"]);
  document.body.querySelectorAll("*").forEach((element) => {
    if ((element.tagName === "SPAN" || element.tagName === "FONT") && element.getAttribute("style")?.includes("background")) {
      const mark = document.createElement("mark");
      mark.append(...Array.from(element.childNodes));
      element.replaceWith(mark);
      return;
    }
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }
    Array.from(element.attributes).forEach((attribute) => {
      const allowedAttribute =
        (element.tagName === "A" && attribute.name === "href") ||
        (element.tagName === "IMG" && ["src", "alt", "loading"].includes(attribute.name));
      if (!allowedAttribute) element.removeAttribute(attribute.name);
    });
    if (element.tagName === "A" && !/^https?:\/\//i.test(element.getAttribute("href") || "")) element.removeAttribute("href");
    if (element.tagName === "IMG") {
      if (!/^https?:\/\//i.test(element.getAttribute("src") || "")) element.remove();
      element.setAttribute("loading", "lazy");
    }
  });
  return document.body.innerHTML;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(storageKey);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function toArticle(story: DatabaseStory): Article {
  const words = plainText(story.content).trim().split(/\s+/).length;
  return {
    id: story.id,
    title: story.title,
    excerpt: story.excerpt,
    authorId: story.author_id,
    author: story.author,
    initials: story.author.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    category: story.category || "Ideas",
    tags: story.tags || [],
    readTime: `${Math.max(1, Math.ceil(words / 220))} min read`,
    date: story.published_at ? new Date(story.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Draft",
    image: story.cover_url || fallbackImage,
    accent: "#d88f69",
    content: sanitizeHtml(story.content),
    views: story.view_count || 0,
    likes: story.likes_count || 0,
    comments: story.comments_count || 0,
    canEdit: story.can_edit ?? true,
    collaborators: (story.collaborators || []).map((collaborator) => ({ id: collaborator.id, name: collaborator.name, email: collaborator.email, addedAt: collaborator.added_at })),
    lastEditedBy: story.last_edited_by ? { id: story.last_edited_by.id, name: story.last_edited_by.name, at: story.last_edited_by.at } : null,
    autosavedAt: story.autosaved_at,
    status: story.status || (story.published_at ? "published" : "draft"),
    publishedAt: story.published_at,
  };
}

function toComment(comment: any): BlogComment {
  return {
    id: comment.id,
    storyId: comment.story_id,
    userId: comment.user_id,
    author: comment.author,
    body: comment.body,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
  };
}

export async function fetchStories(): Promise<Article[]> {
  const response = await fetch("/api/v1/stories");
  if (!response.ok) throw new Error("Unable to load stories.");
  const data = await response.json();
  return data.stories.map(toArticle);
}

export async function fetchStory(storyId: string): Promise<Article> {
  const response = await fetch(`/api/v1/stories/${storyId}`, { headers: authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load story.");
  return toArticle(data.story);
}

export async function fetchMyStories(): Promise<Article[]> {
  const response = await fetch("/api/v1/stories/mine", { headers: authHeaders() });
  if (!response.ok) throw new Error("Unable to load your stories.");
  const data = await response.json();
  return data.stories.map(toArticle);
}

export async function publishStory(title: string, content: string, tags: string[] = []): Promise<Article> {
  const response = await fetch("/api/v1/stories", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title, content, tags, status: "published" }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to publish story.");
  return toArticle(data.story);
}

export async function updateStory(storyId: string, title: string, content: string, status?: "draft" | "published", tags?: string[]): Promise<Article> {
  const response = await fetch(`/api/v1/stories/${storyId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title, content, status, tags }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to update story.");
  return toArticle(data.story);
}

export async function saveDraft(storyId: string | null, title: string, content: string, tags: string[] = []): Promise<Article> {
  const response = await fetch("/api/v1/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ storyId, title, content, tags }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to save draft.");
  return toArticle(data.draft);
}

export async function fetchLatestDraft(): Promise<Article | null> {
  const response = await fetch("/api/v1/drafts/latest", { headers: authHeaders() });
  if (!response.ok) throw new Error("Unable to load draft.");
  const data = await response.json();
  return data.draft ? toArticle(data.draft) : null;
}

export async function discardDraft(storyId: string): Promise<void> {
  const response = await fetch(`/api/v1/drafts/${storyId}`, { method: "DELETE", headers: authHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Unable to discard draft.");
  }
}

function toInvite(invite: any): CollaborationInvite {
  return {
    id: invite.id,
    blogId: invite.blog_id,
    blogTitle: invite.blog_title,
    senderId: invite.sender_id,
    senderName: invite.sender_name,
    receiverId: invite.receiver_id,
    receiverName: invite.receiver_name,
    invitedEmail: invite.invited_email,
    status: invite.status,
    createdAt: invite.created_at,
    acceptedAt: invite.accepted_at,
    rejectedAt: invite.rejected_at,
  };
}

export async function fetchCollaborationInvites(): Promise<CollaborationInvites> {
  const response = await fetch("/api/v1/collaboration-invites", { headers: authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load collaboration invites.");
  return {
    received: (data.invites.received || []).map(toInvite),
    sent: (data.invites.sent || []).map(toInvite),
    pendingCount: data.invites.pending_count || 0,
  };
}

export async function inviteCollaborator(storyId: string, email: string): Promise<CollaborationInvite> {
  const response = await fetch(`/api/v1/stories/${storyId}/collaborators`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ email }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to invite collaborator.");
  return toInvite(data.invite);
}

export async function acceptCollaborationInvite(inviteId: string): Promise<{ invite: CollaborationInvite; story: Article | null }> {
  const response = await fetch(`/api/v1/collaboration-invites/${inviteId}/accept`, { method: "POST", headers: authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to accept invite.");
  return { invite: toInvite(data.invite), story: data.story ? toArticle(data.story) : null };
}

export async function rejectCollaborationInvite(inviteId: string): Promise<{ invite: CollaborationInvite; story: Article | null }> {
  const response = await fetch(`/api/v1/collaboration-invites/${inviteId}/reject`, { method: "POST", headers: authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to reject invite.");
  return { invite: toInvite(data.invite), story: data.story ? toArticle(data.story) : null };
}

export async function removeCollaborator(storyId: string, userId: string): Promise<Article> {
  const response = await fetch(`/api/v1/stories/${storyId}/collaborators/${userId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to remove collaborator.");
  return toArticle(data.story);
}

export async function fetchAdminAnalytics(range: string): Promise<AdminAnalytics> {
  const response = await fetch(`/api/v1/admin/analytics?range=${encodeURIComponent(range)}`, { headers: authHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load admin analytics.");
  return data.analytics;
}

export async function adminDeleteStory(storyId: string): Promise<void> {
  const response = await fetch(`/api/v1/admin/stories/${storyId}`, { method: "DELETE", headers: authHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Unable to remove story.");
  }
}

export async function deleteStory(storyId: string): Promise<void> {
  const response = await fetch(`/api/v1/stories/${storyId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Unable to delete story.");
  }
}

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("image", file);
  const response = await fetch("/api/v1/uploads/image", {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to upload image.");
  return data.url;
}

export async function fetchMyStats(): Promise<DashboardStats> {
  const response = await fetch("/api/v1/stats/me", { headers: authHeaders() });
  if (!response.ok) throw new Error("Unable to load dashboard stats.");
  const data = await response.json();
  return data.stats;
}

export async function toggleLike(storyId: string): Promise<Article> {
  const response = await fetch(`/api/v1/stories/${storyId}/like`, {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to update like.");
  return toArticle(data.story);
}

export async function recordStoryView(storyId: string): Promise<Article> {
  const response = await fetch(`/api/v1/stories/${storyId}/view`, { method: "POST" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to record view.");
  return toArticle(data.story);
}

export async function fetchComments(storyId: string): Promise<BlogComment[]> {
  const response = await fetch(`/api/v1/stories/${storyId}/comments`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load comments.");
  return data.comments.map(toComment);
}

export async function createComment(storyId: string, body: string): Promise<BlogComment> {
  const response = await fetch(`/api/v1/stories/${storyId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ body }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to add comment.");
  return toComment(data.comment);
}

export async function deleteComment(commentId: string): Promise<void> {
  const response = await fetch(`/api/v1/comments/${commentId}`, { method: "DELETE", headers: authHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Unable to delete comment.");
  }
}

export async function askCopilot(input: {
  mode: "writer" | "reader";
  draft: string;
  question: string;
  memory: string[];
  selectedText?: string;
  action?: string;
  tags?: string[];
}): Promise<string> {
  const response = await fetch("/api/v1/ai/assist", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to ask AI.");
  return data.result;
}

export async function login(email: string, password: string): Promise<{ user: User; token: string }> {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to sign in.");
  localStorage.setItem(storageKey, data.token);
  return data;
}

export async function signup(email: string, name: string, password: string): Promise<{ user: User; token: string }> {
  const response = await fetch("/api/v1/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to sign up.");
  localStorage.setItem(storageKey, data.token);
  return data;
}

export async function fetchMe(): Promise<User> {
  const response = await fetch("/api/v1/auth/me", { headers: authHeaders() });
  if (!response.ok) throw new Error("Not authenticated.");
  const data = await response.json();
  return data.user;
}

export async function logout(): Promise<void> {
  const token = localStorage.getItem(storageKey);
  if (token) {
    await fetch("/api/v1/auth/logout", { method: "POST", headers: { ...authHeaders() } });
  }
  localStorage.removeItem(storageKey);
}

export async function fetchBookmarks(): Promise<Article[]> {
  const response = await fetch("/api/v1/bookmarks", { headers: authHeaders() });
  if (!response.ok) throw new Error("Unable to load bookmarks.");
  const data = await response.json();
  return data.bookmarks.map(toArticle);
}

export async function toggleBookmark(storyId: string): Promise<Article[]> {
  const response = await fetch(`/api/v1/bookmarks/${storyId}`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Unable to update bookmark.");
  const data = await response.json();
  return data.bookmarks.map(toArticle);
}
