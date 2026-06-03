import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight, BarChart3, Bell, Bookmark, BookOpen, Check, ChevronRight, CircleUserRound,
  Feather, FileText, Heart, Highlighter, ImagePlus, Italic, LayoutDashboard, Link, List, ListOrdered,
  Menu, MessageCircle, Moon, PenLine, Plus, Quote, Redo2, Search, Settings, Shield, Sparkles, Sun, Underline,
  Trash2, Undo2, UserPlus, Users, X, Zap,
} from "lucide-react";
import { Article, topics } from "./data";
import { acceptCollaborationInvite, adminDeleteStory, askCopilot, createComment, deleteComment, deleteStory, discardDraft, fetchAdminAnalytics, fetchCollaborationInvites, fetchComments, fetchLatestDraft, fetchStories, fetchBookmarks, fetchMyStats, fetchMyStories, fetchStory, inviteCollaborator, login, logout, fetchMe, plainText, publishStory, recordStoryView, rejectCollaborationInvite, removeCollaborator, sanitizeHtml, saveDraft, toggleBookmark, toggleLike, signup, updateStory, uploadImage, type AdminAnalytics, type BlogComment, type CollaborationInvites, type DashboardStats, type User } from "./api";

type View = "home" | "article" | "studio" | "dashboard" | "login" | "admin";
type DashboardTab = "Overview" | "Stories" | "Invites" | "Reading list" | "Analytics" | "Settings";
const TAG_OPTIONS = [
  "Machine Learning", "Deep Learning", "Artificial Intelligence", "Neural Networks", "Computer Vision", "NLP", "Python", "C++", "JavaScript", "Backend", "Frontend", "React", "Node.js", "SQL", "Database", "MongoDB", "System Design", "DSA", "Competitive Programming", "Civil Engineering", "Mathematics", "Physics", "Finance", "Football", "Gaming", "Tutorial", "Case Study", "Career Guidance", "Interview Prep", "Opinion", "Research", "Education",
];

const SEMANTIC_HINTS: Record<string, string[]> = {
  "machine learning": ["ml", "ai", "artificial intelligence", "model", "training", "neural", "deep learning"],
  "deep learning": ["neural", "cnn", "rnn", "transformer", "ai", "machine learning"],
  "computer vision": ["cnn", "image", "vision", "classification", "detection"],
  backend: ["api", "server", "node", "express", "database", "mongodb"],
  frontend: ["react", "ui", "client", "javascript", "interface"],
  tutorial: ["guide", "beginner", "basics", "how to", "learn"],
  football: ["soccer", "match", "player", "team", "league"],
};

const IconButton = ({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) => (
  <button className="icon-button" aria-label={label} onClick={onClick}>{children}</button>
);

function Logo({ onClick }: { onClick: () => void }) {
  return <button className="logo" onClick={onClick}><span>l</span>luma<span className="logo-dot">.</span></button>;
}

function Avatar({ initials, tone = "" }: { initials: string; tone?: string }) {
  return <span className={`avatar ${tone}`}>{initials}</span>;
}

function Header({ view, setView, dark, setDark, onSearch, onTopics, notify, user, inviteCount, onSignOut }: { view: View; setView: (view: View) => void; dark: boolean; setDark: (v: boolean) => void; onSearch: () => void; onTopics: () => void; notify: (message: string) => void; user: User | null; inviteCount: number; onSignOut: () => void; }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Logo onClick={() => setView("home")} />
        <nav className={`main-nav ${open ? "is-open" : ""}`}>
          <button className={view === "home" ? "active" : ""} onClick={() => { setView("home"); setOpen(false); }}>Discover</button>
          <button onClick={() => { setView("home"); setOpen(false); setTimeout(onTopics, 20); }}>Topics</button>
          <button onClick={() => { setView(user ? "studio" : "login"); setOpen(false); }}>For writers</button>
          <button className="mobile-only" onClick={() => setView("dashboard")}>Dashboard</button>
        </nav>
        <div className="nav-actions">
          <IconButton label="Search" onClick={onSearch}><Search size={18} /></IconButton>
          <IconButton label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</IconButton>
          {user && <button className="notify-button" onClick={() => { setView("dashboard"); notify(inviteCount ? `${inviteCount} pending collaboration invite${inviteCount === 1 ? "" : "s"}.` : "No pending collaboration invites."); }}><Bell size={18} />{inviteCount > 0 && <span>{inviteCount}</span>}</button>}
          {user ? (
            <>
              <button className="text-button hide-mobile" onClick={onSignOut}>Sign out</button>
              {user.role === "admin" && <button className="text-button hide-mobile" onClick={() => setView("admin")}><Shield size={14} /> Admin</button>}
              <button className="button button-dark hide-mobile" onClick={() => setView("dashboard")}><PenLine size={15} /> Dashboard</button>
            </>
          ) : (
            <>
              <button className="text-button hide-mobile" onClick={() => setView("login")}>Sign in</button>
              <button className="button button-dark hide-mobile" onClick={() => setView("login")}><PenLine size={15} /> Start writing</button>
            </>
          )}
          <IconButton label="Open menu" onClick={() => setOpen(!open)}><span className="mobile-only">{open ? <X size={19} /> : <Menu size={20} />}</span></IconButton>
        </div>
      </div>
    </header>
  );
}

function ArticleCard({ article, onOpen, onBookmark, saved, wide = false }: { article: Article; onOpen: () => void; onBookmark: () => void; saved: boolean; wide?: boolean }) {
  return (
    <article className={`article-card ${wide ? "wide" : ""}`}>
      <button className="card-image-wrap" onClick={onOpen}>
        <img src={article.image} alt="" className="card-image" />
        <span className="category-pill">{article.category}</span>
      </button>
      <div className="card-body">
        <div className="article-meta"><span>{article.date}</span><span className="meta-dot" /><span>{article.readTime}</span></div>
        <button className="article-title" onClick={onOpen}>{article.title}</button>
        <p>{article.excerpt}</p>
        <div className="card-footer">
          <span className="author"><Avatar initials={article.initials} /><span>{article.author}</span></span>
          <IconButton label={saved ? "Remove bookmark" : "Bookmark article"} onClick={onBookmark}><Bookmark size={17} fill={saved ? "currentColor" : "none"} /></IconButton>
        </div>
      </div>
    </article>
  );
}

function Home({ setView, openArticle, stories, notify, user, bookmarks, onToggleBookmark }: { setView: (view: View) => void; openArticle: (a: Article) => void; stories: Article[]; notify: (message: string) => void; user: User | null; bookmarks: Article[]; onToggleBookmark: (storyId: string) => void }) {
  const featured = stories[0];
  const latestStories = stories.slice(1);
  const popularStories = [...stories].sort((a, b) => ((b.views || 0) + (b.likes || 0)) - ((a.views || 0) + (a.likes || 0))).slice(0, 3);
  const [topic, setTopic] = useState("All");
  const [showAll, setShowAll] = useState(false);
  const [email, setEmail] = useState("");
  const filteredStories = topic === "All" ? latestStories : latestStories.filter((article) => article.category === topic);
  return (
    <>
      <main>
        <section className="hero">
          <div className="ambient ambient-one" />
          <div className="ambient ambient-two" />
          <div className="hero-inner">
            <span className="eyebrow"><Sparkles size={14} /> An independent home for ideas</span>
            <h1>Stories that stay<br /><em>with you.</em></h1>
            <p className="hero-copy">A slower, more thoughtful place to read, write, and discover ideas worth keeping.</p>
            <div className="hero-actions">
              <button className="button button-dark button-large" onClick={() => document.querySelector("#latest")?.scrollIntoView({ behavior: "smooth" })}>Start exploring <ArrowRight size={17} /></button>
              <button className="button button-quiet button-large" onClick={() => setView(user ? "studio" : "login")}><PenLine size={16} /> Share your story</button>
            </div>
          </div>
          <div className="hero-note note-one"><span className="note-icon"><Feather size={14} /></span><span><strong>Curated daily</strong><small>Ideas with a longer half-life</small></span></div>
          <div className="hero-note note-two"><span className="note-icon warm"><BookOpen size={14} /></span><span><strong>Made for focus</strong><small>No noisy feeds, no distractions</small></span></div>
        </section>

        <section className="section featured-section">
          <div className="section-heading"><div><span className="kicker">Editor's pick</span><h2>A story worth your time</h2></div></div>
          {featured ? <article className="feature-card">
            <button className="feature-image-wrap" onClick={() => openArticle(featured)}>
              <img src={featured.image} alt="" className="feature-image" />
              <span className="category-pill">{featured.category}</span>
            </button>
            <div className="feature-copy">
              <div className="article-meta"><span>{featured.date}</span><span className="meta-dot" /><span>{featured.readTime}</span></div>
              <button onClick={() => openArticle(featured)}><h2>{featured.title}</h2></button>
              <p>{featured.excerpt}</p>
              <button className="read-link" onClick={() => openArticle(featured)}>Read the story <ArrowRight size={16} /></button>
              <div className="feature-author"><Avatar initials={featured.initials} tone="peach" /><span><strong>{featured.author}</strong><small>{featured.views || 0} views {"\u00B7"} {featured.likes || 0} likes</small></span></div>
            </div>
          </article> : <div className="empty-state"><strong>No public stories yet.</strong><p>Sign in and publish the first post.</p></div>}
        </section>

        <section className="topic-strip" id="topics">
          <div className="section topic-inner">
            <span className="kicker">Explore by topic</span>
            <div className="topic-list"><button className={`topic-chip ${topic === "All" ? "selected" : ""}`} onClick={() => setTopic("All")}><span>00</span>All</button>{topics.map((item, index) => <button key={item} className={`topic-chip ${topic === item ? "selected" : ""}`} onClick={() => { setTopic(item); document.querySelector("#latest")?.scrollIntoView({ behavior: "smooth" }); }}><span>0{index + 1}</span>{item}</button>)}</div>
          </div>
        </section>

        <section className="section latest" id="latest">
          <div className="section-heading">
            <div><span className="kicker">Fresh perspectives</span><h2>Latest stories</h2></div>
            <button className="read-link" onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer stories" : "View all stories"} <ArrowRight size={16} /></button>
          </div>
          <div className="article-grid">{filteredStories.slice(0, showAll ? filteredStories.length : 3).map((article) => <ArticleCard key={article.id} article={article} onOpen={() => openArticle(article)} onBookmark={() => onToggleBookmark(String(article.id))} saved={bookmarks.some((bookmark) => String(bookmark.id) === String(article.id))} />)}</div>
          {filteredStories.length === 0 && <div className="empty-state"><strong>No stories in {topic} yet.</strong><p>Choose another topic or publish the first one.</p></div>}
        </section>

        <section className="newsletter">
          <div className="newsletter-orb" />
          <div className="newsletter-copy">
            <span className="eyebrow"><Zap size={14} /> The Sunday Edition</span>
            <h2>A quieter corner<br />of your inbox.</h2>
            <p>Five thoughtful reads, one original essay, and a small idea to carry into your week.</p>
            <form className="subscribe" onSubmit={(event) => { event.preventDefault(); if (!email.includes("@")) return notify("Enter a valid email address."); notify("Subscribed. Your Sunday reading list is on its way."); setEmail(""); }}>
              <input type="email" placeholder="Your email address" aria-label="Email address" value={email} onChange={(event) => setEmail(event.target.value)} />
              <button className="button button-dark">Subscribe <ArrowRight size={15} /></button>
            </form>
            <small>No noise. Just one good letter, every Sunday.</small>
          </div>
        </section>

        <section className="section latest">
          <div className="section-heading"><div><span className="kicker">Community favorites</span><h2>Popular this week</h2></div></div>
          <div className="popular-grid">{popularStories.map((article, index) => (
            <button className="popular-item" key={article.id} onClick={() => openArticle(article)}>
              <span className="popular-number">0{index + 1}</span>
              <span><span className="mini-category">{article.category}</span><strong>{article.title}</strong><small>{article.views || 0} views {"\u00B7"} {article.likes || 0} likes</small></span>
            </button>
          ))}</div>
          {popularStories.length === 0 && <div className="empty-state"><strong>No popular stories yet.</strong><p>Publish and read posts to build this list.</p></div>}
        </section>
      </main>
      <Footer setView={setView} notify={notify} />
    </>
  );
}

function ArticleView({ article, setView, saved, user, notify, recommendations, openArticle, onBookmark, onLike, onCommentCountChange }: { article: Article; setView: (view: View) => void; saved: boolean; user: User | null; notify: (message: string) => void; recommendations: Article[]; openArticle: (article: Article) => void; onBookmark: () => void; onLike: () => void; onCommentCountChange: (delta: number) => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [memory, setMemory] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);
  useEffect(() => {
    if (!/^[a-f\d]{24}$/i.test(String(article.id))) return setComments([]);
    fetchComments(String(article.id)).then(setComments).catch(() => setComments([]));
  }, [article.id]);
  const askArticle = async () => {
    if (!question.trim()) return;
    setAsking(true);
    try {
      const result = await askCopilot({ mode: "reader", draft: plainText(article.content || article.excerpt), question, memory, tags: article.tags || [] });
      setAnswer(result);
      setMemory((current) => [...current, question].slice(-5));
      setQuestion("");
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "Unable to ask AI.");
    } finally {
      setAsking(false);
    }
  };
  const submitComment = async () => {
    if (!user) return notify("Sign in to comment.");
    if (!commentText.trim()) return;
    setCommenting(true);
    try {
      const comment = await createComment(String(article.id), commentText);
      setComments((current) => [comment, ...current]);
      setCommentText("");
      onCommentCountChange(1);
      notify("Comment posted.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to post comment.");
    } finally {
      setCommenting(false);
    }
  };
  const removeComment = async (commentId: string) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await deleteComment(commentId);
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      onCommentCountChange(-1);
      notify("Comment deleted.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to delete comment.");
    }
  };
  return (
    <main className="article-page">
      <section className="article-hero section">
        <button className="back-link" onClick={() => setView("home")}>{"\u2190"} Back to discover</button>
        <span className="kicker">{article.category}</span>
        <h1>{article.title}</h1>
        {(article.tags || []).length > 0 && <div className="article-tags">{article.tags?.map((tag) => <span key={tag}>{tag}</span>)}</div>}
        <p className="article-deck">{article.excerpt}</p>
        <div className="article-byline"><Avatar initials={article.initials} tone="peach" /><span><strong>{article.author}</strong><small>{article.date} {"\u00B7"} {article.readTime}</small></span></div>
      </section>
      <div className="article-cover"><img src={article.image} alt="" /></div>
      <section className="article-layout section">
        <aside className="share-rail">
          <button onClick={onLike}><Heart size={18} /><small>{article.likes || 0}</small></button>
          <button onClick={onBookmark}><Bookmark size={18} fill={saved ? "currentColor" : "none"} /></button>
        </aside>
        {article.content ? <article className="prose published-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }} /> : <article className="prose">
          <p className="lead">There is a particular kind of satisfaction in making something slowly. It asks for attention, care, and a willingness to keep looking after the first answer arrives.</p>
          <p>We live inside systems tuned for momentum. Ship the update. Share the thought. Move to whatever comes next. Speed is useful, but it can become a default setting that quietly shapes the work itself.</p>
          <h2>The value of a longer view</h2>
          <p>The alternative is not perfectionism. It is a clearer relationship with time. Durable work comes from knowing which details deserve another pass and which ones are ready to breathe on their own.</p>
          <blockquote>{"\u201C"}The goal is not to move slowly. It is to move at the speed the work deserves.{"\u201D"}</blockquote>
          <p>Small choices compound: a sentence rewritten until it says only what it means, an interaction made more generous, an idea allowed to sit overnight. They are rarely dramatic. Together, they form a point of view.</p>
          <h2>Make room for the second thought</h2>
          <p>The first thought solves the obvious problem. The second asks whether it was the right problem in the first place. That extra moment is where work becomes more human, and often more useful.</p>
        </article>}
        <aside className="toc"><span className="kicker">In this essay</span><a>Introduction</a><a>The value of a longer view</a><a>Make room for the second thought</a></aside>
      </section>
      <section className="section reader-ai"><span className="kicker">Ask AI about this article</span><h2>Need a clearer explanation?</h2><form onSubmit={(event) => { event.preventDefault(); askArticle(); }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question about this article..." /><button className="button button-dark" disabled={asking}>{asking ? "Thinking..." : "Ask AI"}</button></form>{answer && <div className="ai-card"><p>{answer}</p></div>}</section>
      {recommendations.length > 0 && <section className="section recommendations"><span className="kicker">You may also like</span><div className="recommendation-grid">{recommendations.map((item) => <button key={item.id} onClick={() => openArticle(item)}><strong>{item.title}</strong><small>{item.author} {"\u00B7"} {(item.tags || []).slice(0, 3).join(", ") || item.category}</small></button>)}</div></section>}
      <section className="section comments-section"><div className="comments-head"><span className="kicker"><MessageCircle size={14} /> Discussion</span><h2>{comments.length} {comments.length === 1 ? "comment" : "comments"}</h2><p>Share a thoughtful response to this blog.</p></div><form className="comment-form" onSubmit={(event) => { event.preventDefault(); submitComment(); }}><textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder={user ? "Write a comment..." : "Sign in to join the discussion"} disabled={!user || commenting} /><button className="button button-dark" disabled={!user || commenting || !commentText.trim()}>{commenting ? "Posting..." : "Post comment"}</button></form><div className="comment-list">{comments.length === 0 ? <div className="empty-state"><strong>No comments yet.</strong><p>Be the first to start the discussion.</p></div> : comments.map((comment) => <article className="comment-card" key={comment.id}><div><Avatar initials={comment.author.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()} /><span><strong>{comment.author}</strong><small>{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : "Just now"}</small></span></div><p>{comment.body}</p>{(user?.id === comment.userId || user?.role === "admin" || user?.id === article.authorId) && <button className="text-button danger" onClick={() => removeComment(comment.id)}>Delete</button>}</article>)}</div></section>
    </main>
  );
}

function TagSelector({ selected, onChange }: { selected: string[]; onChange: (tags: string[]) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const matches = TAG_OPTIONS.filter((tag) => !selected.includes(tag) && tag.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
  const add = (tag: string) => {
    onChange([...selected, tag]);
    setQuery("");
    setOpen(false);
  };
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className="tag-selector" ref={wrapRef}>
      <div className="tag-chip-row">{selected.map((tag) => <span className="tag-chip" key={tag}>{tag}<button onClick={() => onChange(selected.filter((item) => item !== tag))}>x</button></span>)}</div>
      <input value={query} onFocus={() => setOpen(true)} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} placeholder="Search tags: Machine Learning, React, Tutorial..." />
      {open && (query || matches.length > 0) && <div className="tag-menu">{matches.map((tag) => <button key={tag} onClick={() => add(tag)}>{tag}</button>)}{matches.length === 0 && <small>No matching tags</small>}</div>}
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cleanupLatexText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\\\$/g, "$")
    .replace(/\\_/g, "_")
    .replace(/\\%/g, "%")
    .replace(/\\&/g, "&")
    .replace(/\\#/g, "#")
    .replace(/\\([{}])/g, "$1")
    .replace(/\\left\s*/g, "")
    .replace(/\\right\s*/g, "")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\sigma/g, "σ")
    .replace(/\\Sigma/g, "Σ")
    .replace(/\\sum/g, "Σ")
    .replace(/\\rightarrow|\\to/g, "→")
    .replace(/\\geq/g, "≥")
    .replace(/\\leq/g, "≤")
    .replace(/\\neq/g, "≠")
    .replace(/\\approx/g, "≈")
    .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => `\n${math.trim()}\n`)
    .replace(/\$([^$\n]+)\$/g, (_, math) => math.trim())
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function plainTextToHtml(value: string) {
  return cleanupLatexText(value).split(/\n{2,}/).map((block) => {
    const cleaned = block.trim();
    const looksLikeFormula = /[Σσ→=<>×]|-->|\\|_{1,2}|\bw\d+\b/.test(cleaned) && cleaned.length < 500;
    const html = escapeHtml(cleaned).replace(/\n/g, "<br>");
    return looksLikeFormula ? `<pre>${html}</pre>` : `<p>${html}</p>`;
  }).join("");
}

function Studio({ onPublished, notify, user, editingStory, onCancelEdit, onStoryUpdated, onDraftDiscarded, onInvitesChanged }: { onPublished: (article: Article) => void; notify: (message: string) => void; user: User; editingStory?: Article | null; onCancelEdit?: () => void; onStoryUpdated: (article: Article) => void; onDraftDiscarded: (storyId: string) => void; onInvitesChanged: () => void }) {
  const [title, setTitle] = useState(editingStory?.title || "The beauty of the unfinished");
  const initialBody = editingStory?.content || "<p>There is a quiet confidence in leaving room for a second thought.</p><p>The work does not need to arrive all at once. Sometimes the most honest thing we can do is stay with the question a little longer.</p>";
  const [body, setBody] = useState(initialBody);
  const [selectedTags, setSelectedTags] = useState<string[]>(editingStory?.tags || []);
  const [draftStoryId, setDraftStoryId] = useState<string | null>(editingStory?.status === "draft" ? String(editingStory.id) : null);
  const [currentStory, setCurrentStory] = useState<Article | null>(editingStory || null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [suggestion, setSuggestion] = useState("Try opening with a concrete image. It gives the reader a place to stand before you widen the idea.");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiMemory, setAiMemory] = useState<string[]>([]);
  const [aiAnswer, setAiAnswer] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [saveState, setSaveState] = useState<"Saved" | "Saving..." | "Unsaved changes">("Saved");
  const isPublishedEdit = currentStory?.status === "published";
  const ownerCanManage = !currentStory || String(currentStory.authorId) === String(user.id);
  const canPublish = !currentStory || ownerCanManage;
  useEffect(() => {
    const nextBody = editingStory?.content || initialBody;
    setCurrentStory(editingStory || null);
    setTitle(editingStory?.title || "The beauty of the unfinished");
    setBody(nextBody);
    setSelectedTags(editingStory?.tags || []);
    setDraftStoryId(editingStory?.status === "draft" ? String(editingStory.id) : null);
    if (editorRef.current) editorRef.current.innerHTML = nextBody;
  }, [editingStory?.id]);
  useEffect(() => {
    if (isPublishedEdit || publishing) return;
    if (plainText(body).trim().length < 2 && title.trim().length < 2) return;
    setSaveState("Unsaved changes");
    const timeout = window.setTimeout(async () => {
      setSaveState("Saving...");
      try {
        const draft = await saveDraft(draftStoryId, title, body, selectedTags);
        setDraftStoryId(String(draft.id));
        setCurrentStory(draft);
        onStoryUpdated(draft);
        setSaveState("Saved");
      } catch {
        setSaveState("Unsaved changes");
      }
    }, 3500);
    return () => window.clearTimeout(timeout);
  }, [title, body, selectedTags, draftStoryId, isPublishedEdit, publishing]);
  useEffect(() => {
    if (!currentStory?.id || !/^[a-f\d]{24}$/i.test(String(currentStory.id))) return;
    const interval = window.setInterval(async () => {
      if (saveState !== "Saved") return;
      try {
        const latest = await fetchStory(String(currentStory.id));
        const editedByOther = latest.lastEditedBy?.id && latest.lastEditedBy.id !== user.id;
        if (editedByOther && latest.content && latest.content !== body) {
          setCurrentStory(latest);
          setTitle(latest.title);
          setBody(latest.content);
          if (editorRef.current) editorRef.current.innerHTML = latest.content;
          onStoryUpdated(latest);
          notify(`Synced changes from ${latest.lastEditedBy?.name}.`);
        }
      } catch {
        // Polling is a collaborative fallback; a missed sync should not interrupt writing.
      }
    }, 6000);
    return () => window.clearInterval(interval);
  }, [currentStory?.id, body, saveState, user.id]);
  const runAssistant = async (action: string) => {
    setLoading(true);
    try {
      const request = aiQuestion || action;
      const result = await askCopilot({ mode: "writer", draft: plainText(body), question: request, memory: aiMemory, selectedText, action, tags: selectedTags });
      setSuggestion(result);
      setAiAnswer(result);
      setAiMemory((current) => [...current, request].slice(-5));
    } catch {
      setSuggestion("Consider adding one specific example after the opening. The idea is strong; a lived detail will make it memorable.");
    } finally { setLoading(false); }
  };
  const format = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setBody(editorRef.current?.innerHTML || "");
  };
  const addLink = () => {
    const url = window.prompt("Paste a full link, for example https://example.com");
    if (url) format("createLink", url);
  };
  const syncSelection = () => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current || selection.rangeCount === 0) return;
    if (editorRef.current.contains(selection.anchorNode)) setSelectedText(selection.toString());
  };
  const insertHtml = (html: string) => {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    setBody(editorRef.current?.innerHTML || "");
  };
  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;
    event.preventDefault();
    insertHtml(plainTextToHtml(text));
  };
  const replaceSelection = (html: string) => {
    if (!selectedText) return notify("Select text in the editor first.");
    insertHtml(html);
    setSelectedText("");
  };
  const insertImage = async (file: File) => {
    setPublishStatus("Uploading image...");
    try {
      const url = await uploadImage(file);
      format("insertHTML", `<figure><img src="${url}" alt="Uploaded blog image" loading="lazy" /><figcaption></figcaption></figure><p><br></p>`);
      setPublishStatus("Image inserted.");
    } catch (error) {
      setPublishStatus(error instanceof Error ? error.message : "Unable to upload image.");
    }
  };
  const invite = async () => {
    const storyForInvite = currentStory;
    if (!storyForInvite) return notify("Save this draft once before inviting collaborators.");
    if (!ownerCanManage) return notify("Only the owner can invite collaborators.");
    const value = window.prompt("Enter collaborator registered email or username");
    if (!value) return;
    try {
      await inviteCollaborator(String(storyForInvite.id), value);
      onInvitesChanged();
      notify("Invite sent. The user must accept before they can edit.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to invite collaborator.");
    }
  };
  const removeInvite = async (userId: string) => {
    if (!currentStory || !ownerCanManage || !window.confirm("Remove this collaborator?")) return;
    try {
      const updated = await removeCollaborator(String(currentStory.id), userId);
      setCurrentStory(updated);
      onStoryUpdated(updated);
      notify("Collaborator removed.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to remove collaborator.");
    }
  };
  const discard = async () => {
    const id = draftStoryId || (currentStory?.status === "draft" ? String(currentStory.id) : "");
    if (!id || !window.confirm("Discard this draft permanently?")) return;
    try {
      await discardDraft(id);
      onDraftDiscarded(id);
      notify("Draft discarded.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to discard draft.");
    }
  };
  const publish = async () => {
    setPublishing(true);
    setPublishStatus("");
    try {
      if (!canPublish && !isPublishedEdit) return setPublishStatus("Only the owner can publish this draft.");
      const existingId = draftStoryId || (currentStory ? String(currentStory.id) : "");
      const article = existingId ? await updateStory(existingId, title, body, canPublish ? "published" : undefined, selectedTags) : await publishStory(title, body, selectedTags);
      setCurrentStory(article);
      setPublishStatus("Published and saved to MongoDB Atlas.");
      setAiMemory([]);
      onPublished(article);
    } catch (error) {
      setPublishStatus(error instanceof Error ? error.message : "Unable to publish.");
    } finally { setPublishing(false); }
  };
  return (
    <main className="studio-page">
      <header className="studio-top"><div><span className="save-status"><Check size={13} /> {publishStatus || (isPublishedEdit ? "Editing within 24-hour window" : saveState)}</span></div><div className="studio-actions">{currentStory && <button className="text-button" onClick={onCancelEdit}>Cancel edit</button>}{!isPublishedEdit && ownerCanManage && <button className="text-button" onClick={discard}>Discard draft</button>}<button className="text-button" onClick={() => notify("Preview is ready below while you write. Publish when the story feels right.")}>Preview</button><button className="button button-dark" onClick={publish} disabled={publishing}>{publishing ? "Saving..." : isPublishedEdit || !canPublish ? "Save changes" : "Publish"} <ArrowRight size={15} /></button></div></header>
      <div className="studio-layout">
        <section className="editor">
          <span className="kicker">Draft {"\u00B7"} Personal essay</span>
          <textarea className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Article title" />
          <TagSelector selected={selectedTags} onChange={setSelectedTags} />
          <div className="editor-meta"><Avatar initials="YO" /><span>You {"\u00B7"} 2 min read</span></div>
          <div className="collab-box"><div><strong><Users size={14} /> Collaborators</strong><small>{currentStory?.lastEditedBy ? `Last edited by ${currentStory.lastEditedBy.name}` : currentStory ? "Invite a registered writer to co-edit this blog." : "Autosave will create the draft before invites can be sent."}</small></div><button className="text-button" onClick={invite} disabled={!currentStory || !ownerCanManage}><UserPlus size={14} /> Invite Collaborator</button>{(currentStory?.collaborators || []).map((collaborator) => <span key={collaborator.id} className="collab-chip">{collaborator.name}<button onClick={() => removeInvite(collaborator.id)} disabled={!ownerCanManage}>x</button></span>)}</div>
          <div className="format-toolbar" aria-label="Text formatting toolbar">
            <button title="Bold" onClick={() => format("bold")}><strong>B</strong></button>
            <button title="Italic" onClick={() => format("italic")}><Italic size={15} /></button>
            <button title="Underline" onClick={() => format("underline")}><Underline size={15} /></button>
            <button title="Highlight" onClick={() => format("hiliteColor", "#f4d68b")}><Highlighter size={15} /></button>
            <span />
            <button title="Heading" onClick={() => format("formatBlock", "h2")}>H2</button>
            <button title="Bullet list" onClick={() => format("insertUnorderedList")}><List size={16} /></button>
            <button title="Numbered list" onClick={() => format("insertOrderedList")}><ListOrdered size={16} /></button>
            <button title="Quote" onClick={() => format("formatBlock", "blockquote")}><Quote size={15} /></button>
            <button title="Add link" onClick={addLink}><Link size={15} /></button>
            <button title="Upload image" onClick={() => imageInputRef.current?.click()}><ImagePlus size={15} /></button>
            <span />
            <button title="Undo" onClick={() => format("undo")}><Undo2 size={15} /></button>
            <button title="Redo" onClick={() => format("redo")}><Redo2 size={15} /></button>
          </div>
          <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) insertImage(file); event.currentTarget.value = ""; }} />
          <div ref={editorRef} className="body-input rich-editor" contentEditable suppressContentEditableWarning aria-label="Article body" dir="ltr" spellCheck onPaste={handlePaste} onMouseUp={syncSelection} onKeyUp={syncSelection} onInput={(event) => setBody(event.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: initialBody }} />
        </section>
        <aside className="ai-panel">
          <div className="ai-title"><span className="ai-icon"><Sparkles size={16} /></span><div><strong>Luma AI</strong><small>Your thoughtful co-writer</small></div></div>
          <div className="ai-card"><span className="kicker">Writing note</span><p>{loading ? "Thinking with you..." : suggestion}</p></div>
          <form className="ai-chat" onSubmit={(event) => { event.preventDefault(); runAssistant("chat"); }}>
            <textarea value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} placeholder="Ask about this draft, e.g. write a stronger intro, simplify this section, add examples..." />
            <button className="button button-dark" disabled={loading}>{loading ? "Thinking..." : "Ask AI"}</button>
          </form>
          {selectedText && <small className="ai-footnote">Selected text active: {selectedText.slice(0, 80)}{selectedText.length > 80 ? "..." : ""}</small>}
          {aiAnswer && <div className="ai-actions"><button onClick={() => insertHtml(aiAnswer)}>Insert At Cursor</button><button onClick={() => insertHtml(`<p>${aiAnswer}</p>`)}>Insert Below</button><button onClick={() => replaceSelection(aiAnswer)}>Replace Selection</button></div>}
          <div className="ai-tools">
            <button onClick={() => runAssistant("improve")}><Sparkles size={15} /> Improve this draft</button>
            <button onClick={() => runAssistant("outline")}><FileText size={15} /> Suggest an outline</button>
            <button onClick={() => runAssistant("seo")}><Search size={15} /> Generate SEO keywords</button>
            <button onClick={() => runAssistant("concise")}><Zap size={15} /> Make it more concise</button>
          </div>
          <small className="ai-footnote">AI suggestions are here to support your voice, not replace it.</small>
        </aside>
      </div>
    </main>
  );
}

function Login({ onSignIn, onSignUp, onCancel }: { onSignIn: (email: string, password: string) => Promise<void>; onSignUp: (email: string, name: string, password: string) => Promise<void>; onCancel: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signin") {
        await onSignIn(email.trim(), password.trim());
      } else {
        await onSignUp(email.trim(), name.trim(), password.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "20px", background: "var(--bg-primary)" }}>
      <section className="login-card" style={{ width: "100%", maxWidth: "420px", padding: "40px", background: "var(--bg-secondary)", borderRadius: "12px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ marginBottom: "32px" }}>
          <span className="kicker">{mode === "signin" ? "Sign in" : "Create account"}</span>
          <h1 style={{ marginTop: "12px", fontSize: "32px", fontWeight: 600, lineHeight: 1.2 }}>
            {mode === "signin" ? "Welcome back to Luma." : "Join Luma."}
          </h1>
          <p style={{ marginTop: "8px", color: "var(--text-secondary)", fontSize: "15px" }}>
            {mode === "signin" 
              ? "Sign in with your account or create a new one." 
              : "Create an account to access dashboard features and save your reading list."}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {mode === "signup" && (
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "14px", fontWeight: 500 }}>Name</span>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Your name" 
                required={mode === "signup"}
                style={{ padding: "10px 12px", border: "1px solid var(--border-color)", borderRadius: "6px", fontSize: "14px" }}
              />
            </label>
          )}
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500 }}>Email address</span>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder={mode === "signin" ? "demo@luma.local" : "your@email.com"} 
              required
              style={{ padding: "10px 12px", border: "1px solid var(--border-color)", borderRadius: "6px", fontSize: "14px" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500 }}>Password</span>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder={mode === "signin" ? "demo1234" : "At least 8 characters"} 
              required
              style={{ padding: "10px 12px", border: "1px solid var(--border-color)", borderRadius: "6px", fontSize: "14px" }}
            />
          </label>
          {error && <p style={{ color: "var(--error-color, #e74c3c)", fontSize: "14px", margin: 0 }}>{"\u26A0"} {error}</p>}
          
          <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
            <button type="button" className="text-button" onClick={onCancel} disabled={loading}>Cancel</button>
            <button type="submit" className="button button-dark" disabled={loading}>
              {loading ? "Loading..." : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </div>

          <div style={{ textAlign: "center", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border-color)" }}>
            <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
              {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button 
              type="button"
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
              style={{ background: "none", border: "none", color: "var(--accent-color, #0066cc)", cursor: "pointer", fontSize: "14px", fontWeight: 600, textDecoration: "underline" }}
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ setView, notify, user, stories, bookmarks, stats, invites, onToggleBookmark, onDeleteStory, onEditStory, onOpenStory, onSignOut, onInviteCollaborator, onRemoveCollaborator, onAcceptInvite, onRejectInvite }: { setView: (view: View) => void; notify: (message: string) => void; user: User | null; stories: Article[]; bookmarks: Article[]; stats: DashboardStats; invites: CollaborationInvites; onToggleBookmark: (storyId: string) => void; onDeleteStory: (storyId: string) => void; onEditStory: (story: Article) => void; onOpenStory: (story: Article) => void; onSignOut: () => void; onInviteCollaborator: (story: Article) => void; onRemoveCollaborator: (story: Article, userId: string) => void; onAcceptInvite: (inviteId: string) => void; onRejectInvite: (inviteId: string) => void; }) {
  const [tab, setTab] = useState<DashboardTab>("Overview");
  const [range, setRange] = useState("Last 30 days");
  const tabs: [DashboardTab, React.ReactNode][] = [["Overview", <LayoutDashboard size={17} />], ["Stories", <FileText size={17} />], ["Invites", <Bell size={17} />], ["Reading list", <Bookmark size={17} />], ["Analytics", <BarChart3 size={17} />], ["Settings", <Settings size={17} />]];
  const selectTab = (next: DashboardTab) => { setTab(next); notify(`${next} selected.`); };
  const initials = user?.name.split(" ").map((part) => part[0]).join("").slice(0, 2) || "LU";
  const storyCount = stats.stories;
  const myBlogs = stories.filter((story) => String(story.authorId) === String(user?.id));
  const sharedWithMe = stories.filter((story) => story.authorId && String(story.authorId) !== String(user?.id));
  const chartBars = stories.slice(0, 9).map((story) => story.views || 0);
  const maxViews = Math.max(1, ...chartBars);
  return (
    <main className="dashboard-page">
      <aside className="dash-sidebar">
        <Logo onClick={() => setView("home")} />
        <nav>{tabs.map(([item, icon]) => <button className={tab === item ? "selected" : ""} key={item} onClick={() => selectTab(item)}>{icon} {item}{item === "Invites" && invites.pendingCount > 0 ? ` (${invites.pendingCount})` : ""}</button>)}</nav>
        <button className="profile-button" onClick={() => selectTab("Settings")}><Avatar initials={initials} tone="peach" /><span><strong>{user?.name}</strong><small>{user?.role}</small></span></button>
      </aside>
      <section className="dash-main">
        <header className="dash-header"><div><span className="kicker">{tab}</span><h1>{tab === "Overview" ? `Good morning, ${user?.name.split(" ")[0]}.` : tab}</h1><p>{tab === "Overview" ? "Here is what is happening with your writing." : `Your ${tab.toLowerCase()} workspace is active.`}</p></div><div><IconButton label="Notifications" onClick={() => notify("You are all caught up. No new notifications.")}><Bell size={18} /></IconButton><button className="button button-dark" onClick={() => setView("studio")}><Plus size={16} /> New story</button></div></header>
        <div className="metric-grid">
          {[["Total views", String(stats.views), "from your posts", BarChart3], ["Readers", String(stats.readers), "unique savers", CircleUserRound], ["Likes", String(stats.likes), `${stats.comments} comments`, Heart], ["Stories", `${storyCount}`, `${stats.drafts} drafts`, FileText]].map(([label, value, sub, Icon]) => (
            <article className="metric" key={String(label)}><span className="metric-icon"><Icon size={18} /></span><small>{String(label)}</small><strong>{String(value)}</strong><em>{String(sub)}</em></article>
          ))}
        </div>
        <div className="dash-grid">
          <article className="dash-card performance"><div className="dash-card-title"><div><span className="kicker">Performance</span><h3>Your readership is growing</h3></div><button className="text-button" onClick={() => setRange(range === "Last 30 days" ? "Last 7 days" : "Last 30 days")}>{range} v</button></div><div className="chart">{(chartBars.length ? chartBars : [0]).map((views, index) => <span key={index} style={{ height: `${Math.max(8, Math.round((views / maxViews) * 95))}%` }} />)}</div><div className="chart-axis"><small>Oldest</small><small>Recent stories</small><small>Newest</small></div></article>
          <article className="dash-card"><div className="dash-card-title"><div><span className="kicker">Momentum</span><h3>Keep your rhythm</h3></div></div><div className="streak"><strong>{stats.published}</strong><span>published<br />stories</span></div><div className="week">{["Views", "Likes", "Comments", "Saves"].map((label, index) => <span key={label}><i><Check size={11} /></i><small>{[stats.views, stats.likes, stats.comments, stats.bookmarks][index]}</small></span>)}</div></article>
          <article className="dash-card recent"><div className="dash-card-title"><div><span className="kicker">Your stories</span><h3>Recent work</h3></div><button className="read-link" onClick={() => selectTab("Stories")}>View all <ChevronRight size={14} /></button></div>{stories.slice(0, 3).map((a) => <div className="recent-story" key={a.id}><span className="recent-thumb" style={{ backgroundImage: `url(${a.image})` }} /><span><strong>{a.title}</strong><small>{a.views || 0} views {"\u00B7"} {a.likes || 0} likes</small></span><em>Published</em></div>)}</article>
        </div>
        <section className="dashboard-content">
          {tab === "Stories" && (
            <div className="content-panel"><div className="panel-header"><h2>My Blogs</h2><p>Blogs you own. You can invite collaborators, publish, and delete these.</p></div>{myBlogs.length === 0 ? <div className="empty-state"><strong>No owned blogs yet.</strong><p>Publish or autosave a draft to see it here.</p></div> : myBlogs.map((story) => <article className="story-row" key={story.id}><div><strong>{story.title}</strong><small>{story.status} {"\u00B7"} {story.views || 0} views {"\u00B7"} {story.likes || 0} likes{story.lastEditedBy ? ` \u00B7 last edited by ${story.lastEditedBy.name}` : ""}</small>{(story.collaborators || []).length > 0 && <span className="collab-list">{story.collaborators?.map((collaborator) => <em key={collaborator.id}>{collaborator.name}<button onClick={() => onRemoveCollaborator(story, collaborator.id)}>x</button></em>)}</span>}</div><span className="story-actions"><button className="text-button" onClick={() => onOpenStory(story)}>View</button><button className="text-button" disabled={!story.canEdit} onClick={() => story.canEdit ? onEditStory(story) : notify("Editing window expired")}>{story.canEdit ? "Edit" : "Editing window expired"}</button><button className="text-button" onClick={() => onInviteCollaborator(story)}><UserPlus size={14} /> Invite</button><button className="text-button danger" onClick={() => onDeleteStory(String(story.id))}><Trash2 size={14} /> Delete</button></span></article>)}<div className="panel-header shared-heading"><h2>Shared With Me</h2><p>Accepted collaboration blogs where you can edit and save drafts.</p></div>{sharedWithMe.length === 0 ? <div className="empty-state"><strong>No shared blogs yet.</strong><p>Accepted invites will appear here.</p></div> : sharedWithMe.map((story) => <article className="story-row" key={story.id}><div><strong>{story.title}</strong><small>Owner: {story.author} {"\u00B7"} {story.status}{story.lastEditedBy ? ` \u00B7 last edited by ${story.lastEditedBy.name}` : ""}</small></div><span className="story-actions"><button className="text-button" onClick={() => onOpenStory(story)}>View</button><button className="text-button" disabled={!story.canEdit} onClick={() => story.canEdit ? onEditStory(story) : notify("Editing window expired")}>{story.canEdit ? "Open editor" : "Editing window expired"}</button></span></article>)}</div>
          )}
          {tab === "Invites" && (
            <div className="content-panel"><div className="panel-header"><h2>Collaboration invites</h2><p>Accept invitations to unlock shared editor access.</p></div>{invites.received.length === 0 ? <div className="empty-state"><strong>No invites received.</strong><p>When a blog owner invites you, it will appear here.</p></div> : invites.received.map((invite) => <article className="story-row" key={invite.id}><div><strong>You were invited to collaborate on: {invite.blogTitle}</strong><small>From {invite.senderName || "Blog owner"} {"\u00B7"} {invite.status}</small></div><span className="story-actions">{invite.status === "pending" ? <><button className="text-button" onClick={() => onAcceptInvite(invite.id)}>Accept</button><button className="text-button danger" onClick={() => onRejectInvite(invite.id)}>Reject</button></> : <em className="status-pill">{invite.status}</em>}</span></article>)}<div className="panel-header shared-heading"><h2>Sent invites</h2><p>Track whether collaborators accepted, rejected, or are still pending.</p></div>{invites.sent.length === 0 ? <div className="empty-state"><strong>No invites sent.</strong><p>Invite collaborators from My Blogs or the editor.</p></div> : invites.sent.map((invite) => <article className="story-row" key={invite.id}><div><strong>{invite.blogTitle}</strong><small>{invite.invitedEmail} {"\u00B7"} {invite.status}</small></div><em className="status-pill">{invite.status}</em></article>)}</div>
          )}
          {false && tab === "Stories" && (
            <div className="content-panel"><div className="panel-header"><h2>Stories</h2><p>Published and saved stories are listed here.</p></div>{stories.length === 0 ? <div className="empty-state"><strong>No published stories yet.</strong><p>Publish a story from the studio to see it here.</p></div> : stories.map((story) => <article className="story-row" key={story.id}><div><strong>{story.title}</strong><small>{story.views || 0} views {"\u00B7"} {story.likes || 0} likes {"\u00B7"} {story.comments || 0} comments{story.lastEditedBy ? ` \u00B7 last edited by ${story.lastEditedBy.name}` : ""}</small>{(story.collaborators || []).length > 0 && <span className="collab-list">{story.collaborators?.map((collaborator) => <em key={collaborator.id}>{collaborator.name}<button onClick={() => onRemoveCollaborator(story, collaborator.id)}>x</button></em>)}</span>}</div><span className="story-actions"><button className="text-button" onClick={() => onOpenStory(story)}>View</button><button className="text-button" disabled={!story.canEdit} onClick={() => story.canEdit ? onEditStory(story) : notify("Editing window expired")}>{story.canEdit ? "Edit" : "Editing window expired"}</button><button className="text-button" onClick={() => onInviteCollaborator(story)}><UserPlus size={14} /> Invite</button><button className="text-button danger" onClick={() => onDeleteStory(String(story.id))}><Trash2 size={14} /> Delete</button></span></article>)}</div>
          )}
          {tab === "Reading list" && (
            <div className="content-panel"><div className="panel-header"><h2>Saved reading list</h2><p>Stories you've bookmarked appear here.</p></div>{bookmarks.length === 0 ? <div className="empty-state"><strong>Your reading list is empty.</strong><p>Bookmark stories while browsing to build a list.</p></div> : bookmarks.map((story) => <article className="story-row" key={story.id}><div><strong>{story.title}</strong><small>{story.author} {"\u00B7"} {story.readTime}</small></div><button className="text-button" onClick={() => onToggleBookmark(String(story.id))}>Remove</button></article>)}</div>
          )}
          {tab === "Analytics" && (
            <div className="content-panel"><div className="panel-header"><h2>Analytics</h2><p>High-level insights to help you focus.</p></div><div className="analytics-grid"><div className="analytics-card"><strong>{stats.views}</strong><small>Views</small></div><div className="analytics-card"><strong>{stats.readers}</strong><small>Readers</small></div><div className="analytics-card"><strong>{stats.likes}</strong><small>Likes</small></div><div className="analytics-card"><strong>{stats.comments}</strong><small>Comments</small></div></div></div>
          )}
          {tab === "Settings" && (
            <div className="content-panel"><div className="panel-header"><h2>Account settings</h2><p>Manage your profile and sign out.</p></div><div className="settings-card"><p><strong>Name</strong><br />{user?.name}</p><p><strong>Email</strong><br />{user?.email}</p><button className="button button-dark" onClick={onSignOut}>Sign out</button></div></div>
          )}
        </section>
      </section>
    </main>
  );
}

function AdminDashboard({ setView, notify, onStoryRemoved }: { setView: (view: View) => void; notify: (message: string) => void; onStoryRemoved: (storyId: string) => void }) {
  const [range, setRange] = useState("month");
  const [search, setSearch] = useState("");
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetchAdminAnalytics(range).then(setAnalytics).catch((error) => notify(error instanceof Error ? error.message : "Unable to load admin analytics.")).finally(() => setLoading(false));
  }, [range]);
  const blogs = (analytics?.tables.blogs || []).filter((story) => `${story.title} ${story.author}`.toLowerCase().includes(search.toLowerCase()));
  const removeStory = async (storyId: string) => {
    if (!window.confirm("Remove this blog from the platform?")) return;
    try {
      await adminDeleteStory(storyId);
      onStoryRemoved(storyId);
      setAnalytics(await fetchAdminAnalytics(range));
      notify("Blog removed.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to remove blog.");
    }
  };
  return (
    <main className="dashboard-page admin-page">
      <aside className="dash-sidebar"><Logo onClick={() => setView("home")} /><nav><button className="selected"><Shield size={17} /> Admin</button><button onClick={() => setView("dashboard")}><LayoutDashboard size={17} /> My dashboard</button></nav></aside>
      <section className="dash-main">
        <header className="dash-header"><div><span className="kicker">Admin</span><h1>Platform analytics</h1><p>Real users, stories, engagement, and AI activity from MongoDB.</p></div><div><select className="admin-filter" value={range} onChange={(event) => setRange(event.target.value)}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option><option value="all">All time</option></select></div></header>
        {loading || !analytics ? <div className="empty-state"><strong>Loading analytics...</strong></div> : <>
          <div className="metric-grid">
            <article className="metric"><small>Total users</small><strong>{analytics.users.total}</strong><em>{analytics.users.new} new</em></article>
            <article className="metric"><small>Active users</small><strong>{analytics.users.active}</strong><em>recent activity</em></article>
            <article className="metric"><small>Total blogs</small><strong>{analytics.blogs.total}</strong><em>{analytics.blogs.drafts} drafts</em></article>
            <article className="metric"><small>AI requests</small><strong>{analytics.ai.requests}</strong><em>Groq assistant</em></article>
          </div>
          <div className="dash-grid">
            <article className="dash-card"><span className="kicker">Engagement</span><h3>Real platform totals</h3><div className="analytics-grid"><div className="analytics-card"><strong>{analytics.engagement.views}</strong><small>Views</small></div><div className="analytics-card"><strong>{analytics.engagement.likes}</strong><small>Likes</small></div><div className="analytics-card"><strong>{analytics.engagement.bookmarks}</strong><small>Bookmarks</small></div><div className="analytics-card"><strong>{analytics.engagement.comments}</strong><small>Comments</small></div></div></article>
            <article className="dash-card"><span className="kicker">Quality</span><h3>Publishing health</h3><div className="streak"><strong>{analytics.blogs.completion_rate}</strong><span>% completion<br />published vs drafts</span></div><p className="admin-note">Average read time: {analytics.blogs.avg_read_time} min</p></article>
            <article className="dash-card recent"><div className="dash-card-title"><div><span className="kicker">Top contributors</span><h3>Writers moving the platform</h3></div></div>{analytics.users.top_contributors.map((user) => <div className="recent-story" key={user.name}><span><strong>{user.name}</strong><small>{user.blogs} blogs {"\u00B7"} {user.views} views {"\u00B7"} {user.likes} likes</small></span></div>)}</article>
          </div>
          <section className="content-panel admin-table"><div className="panel-header"><h2>Moderation tools</h2><p>Search and remove public or draft content when needed.</p><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search blogs or authors" /></div>{blogs.map((story) => <article className="story-row" key={story.id}><div><strong>{story.title}</strong><small>{story.author} {"\u00B7"} {story.status} {"\u00B7"} {story.view_count || 0} views {"\u00B7"} {story.likes_count || 0} likes</small></div><button className="text-button danger" onClick={() => removeStory(story.id)}><Trash2 size={14} /> Remove</button></article>)}</section>
          <section className="content-panel admin-table"><div className="panel-header"><h2>Tags, categories, and AI actions</h2><p>Most used and top performing tags are calculated from real blogs, views, likes, and comments.</p></div><div className="analytics-grid">{(analytics.blogs.top_tags || []).slice(0, 8).map((item) => <div className="analytics-card" key={item.tag}><strong>{item.views}</strong><small>{item.tag} · {item.count} posts</small></div>)}{analytics.blogs.category_distribution.map((item) => <div className="analytics-card" key={item.category}><strong>{item.count}</strong><small>{item.category}</small></div>)}{analytics.ai.by_action.map((item) => <div className="analytics-card" key={item.action}><strong>{item.count}</strong><small>AI: {item.action}</small></div>)}</div></section>
        </>}
      </section>
    </main>
  );
}

function Footer({ setView, notify }: { setView: (view: View) => void; notify: (message: string) => void }) {
  const info = (label: string) => notify(`${label} page is planned for the next content release.`);
  return <footer><div className="footer-inner"><div><Logo onClick={() => setView("home")} /><p>A calmer home for thoughtful ideas.</p></div><div className="footer-links"><span><strong>Explore</strong><button onClick={() => setView("home")}>Discover</button><button onClick={() => { setView("home"); setTimeout(() => document.querySelector("#topics")?.scrollIntoView({ behavior: "smooth" }), 20); }}>Topics</button><button onClick={() => setView("studio")}>Writers</button></span><span><strong>Company</strong><button onClick={() => info("Our story")}>Our story</button><button onClick={() => notify("Newsletter signup is available on the Discover page.")}>Newsletter</button><button onClick={() => info("Contact")}>Contact</button></span><span><strong>Legal</strong><button onClick={() => info("Privacy")}>Privacy</button><button onClick={() => info("Terms")}>Terms</button></span></div></div><div className="footer-bottom">{"\u00A9"} 2026 Luma Journal <span>Made for the long read.</span></div></footer>;
}

function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim(); }
function tokens(value: string) { return normalize(value).split(/\s+/).filter(Boolean); }
function expandedTokens(query: string) {
  const base = tokens(query);
  const expanded = new Set(base);
  Object.entries(SEMANTIC_HINTS).forEach(([key, hints]) => {
    if (normalize(query).includes(key) || base.some((token) => key.includes(token))) hints.forEach((hint) => tokens(hint).forEach((token) => expanded.add(token)));
  });
  return [...expanded];
}
function searchScore(article: Article, query: string, selectedTags: string[] = []) {
  const queryTokens = expandedTokens(query);
  const tagText = normalize((article.tags || []).join(" "));
  const titleText = normalize(article.title);
  const headingText = normalize((article.content || "").match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi)?.join(" ") || "");
  const contentText = normalize(plainText(article.content || article.excerpt));
  const categoryText = normalize(article.category);
  let score = 0;
  selectedTags.forEach((tag) => { if ((article.tags || []).includes(tag)) score += 18; });
  queryTokens.forEach((token) => {
    if (tagText.includes(token)) score += 14;
    if (titleText.includes(token)) score += 9;
    if (headingText.includes(token)) score += 7;
    if (contentText.includes(token)) score += 3;
    if (categoryText.includes(token)) score += 2;
  });
  score += Math.min(5, ((article.views || 0) + (article.likes || 0) * 3 + (article.comments || 0) * 2) / 1000);
  return score;
}
function recommendationsFor(article: Article, stories: Article[]) {
  return stories.filter((item) => String(item.id) !== String(article.id)).map((item) => ({
    item,
    score: searchScore(item, `${article.title} ${(article.tags || []).join(" ")} ${article.category}`, article.tags || []),
  })).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(({ item }) => item);
}

function SearchOverlay({ stories, onClose, onOpen }: { stories: Article[]; onClose: () => void; onOpen: (article: Article) => void }) {
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const recent = JSON.parse(localStorage.getItem("luma-recent-searches") || "[]") as string[];
  const tagSuggestions = TAG_OPTIONS.filter((tag) => tag.toLowerCase().includes(query.toLowerCase()) && !selectedTags.includes(tag)).slice(0, 5);
  const matches = stories.map((article) => ({ article, score: searchScore(article, query, selectedTags) })).filter(({ score }) => (query || selectedTags.length ? score > 0 : true)).sort((a, b) => b.score - a.score).slice(0, 8).map(({ article }) => article);
  const open = (article: Article) => {
    if (query.trim()) localStorage.setItem("luma-recent-searches", JSON.stringify([query.trim(), ...recent.filter((item) => item !== query.trim())].slice(0, 5)));
    onOpen(article);
  };
  return <div className="overlay" onClick={onClose}><section className="search-modal" onClick={(event) => event.stopPropagation()}><div className="search-input"><Search size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tags, titles, headings, content..." /><IconButton label="Close search" onClick={onClose}><X size={17} /></IconButton></div><div className="search-tags">{selectedTags.map((tag) => <span className="tag-chip" key={tag}>{tag}<button onClick={() => setSelectedTags(selectedTags.filter((item) => item !== tag))}>x</button></span>)}{tagSuggestions.map((tag) => <button key={tag} onClick={() => setSelectedTags([...selectedTags, tag])}>+ {tag}</button>)}</div>{!query && recent.length > 0 && <div className="recent-searches"><small>Recent searches</small>{recent.map((item) => <button key={item} onClick={() => setQuery(item)}>{item}</button>)}</div>}<div className="search-results">{matches.map((article) => <button key={article.id} onClick={() => open(article)}><span className="mini-category">{(article.tags || [article.category]).slice(0, 3).join(" · ")}</span><strong>{article.title}</strong><small>{article.author} · {article.readTime}</small></button>)}{matches.length === 0 && <div className="empty-state"><strong>No matching stories.</strong><p>Try a tag like Machine Learning, Python, or Tutorial.</p></div>}</div></section></div>;
}

export function App() {
  const [view, setView] = useState<View>("home");
  const [selected, setSelected] = useState<Article | null>(null);
  const [dark, setDark] = useState(() => localStorage.getItem("luma-theme") === "dark");
  const [persistedStories, setPersistedStories] = useState<Article[]>([]);
  const [myStories, setMyStories] = useState<Article[]>([]);
  const [bookmarks, setBookmarks] = useState<Article[]>([]);
  const [collaborationInvites, setCollaborationInvites] = useState<CollaborationInvites>({ received: [], sent: [], pendingCount: 0 });
  const [stats, setStats] = useState<DashboardStats>({ stories: 0, published: 0, drafts: 0, views: 0, likes: 0, comments: 0, bookmarks: 0, readers: 0 });
  const [user, setUser] = useState<User | null>(null);
  const [editingStory, setEditingStory] = useState<Article | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetchStories().then(setPersistedStories).catch(() => setPersistedStories([]));
    fetchMe().then((me) => {
      setUser(me);
      return Promise.all([fetchBookmarks().then(setBookmarks), fetchMyStories().then(setMyStories), fetchMyStats().then(setStats), fetchCollaborationInvites().then(setCollaborationInvites)]).then(() => checkDraftRecovery());
    }).catch(() => setUser(null));
  }, []);

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.setItem("luma-theme", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => window.scrollTo({ top: 0, behavior: "smooth" }), [view, selected]);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(""), 3200); return () => clearTimeout(timeout); }, [toast]);

  const notify = (message: string) => setToast(message);
  const updateStoryInState = (article: Article) => {
    setSelected((current) => current && String(current.id) === String(article.id) ? article : current);
    setPersistedStories((current) => current.map((story) => String(story.id) === String(article.id) ? article : story));
    setMyStories((current) => current.some((story) => String(story.id) === String(article.id)) ? current.map((story) => String(story.id) === String(article.id) ? article : story) : [article, ...current]);
    setBookmarks((current) => current.map((story) => String(story.id) === String(article.id) ? article : story));
  };
  const removeStoryFromState = (storyId: string) => {
    setPersistedStories((current) => current.filter((story) => String(story.id) !== storyId));
    setMyStories((current) => current.filter((story) => String(story.id) !== storyId));
    setBookmarks((current) => current.filter((story) => String(story.id) !== storyId));
    setSelected((current) => current && String(current.id) === storyId ? null : current);
  };
  const checkDraftRecovery = async () => {
    const draft = await fetchLatestDraft().catch(() => null);
    if (!draft) return;
    const when = draft.autosavedAt ? new Date(draft.autosavedAt).toLocaleString() : "recently";
    if (window.confirm(`Recover previous draft saved ${when}?`)) {
      setEditingStory(draft);
      setView("studio");
    } else if (window.confirm("Discard this saved draft?")) {
      await discardDraft(String(draft.id)).catch(() => undefined);
      removeStoryFromState(String(draft.id));
    }
  };
  const openArticle = (article: Article) => {
    setSelected(article);
    setView("article");
    if (/^[a-f\d]{24}$/i.test(String(article.id))) {
      recordStoryView(String(article.id)).then(updateStoryInState).catch(() => undefined);
    }
  };

  const signIn = async (email: string, password: string) => {
    const result = await login(email, password);
    setUser(result.user);
    setView("dashboard");
    const [mark, ownStories, nextStats, nextInvites] = await Promise.all([fetchBookmarks(), fetchMyStories(), fetchMyStats(), fetchCollaborationInvites()]);
    setBookmarks(mark);
    setMyStories(ownStories);
    setStats(nextStats);
    setCollaborationInvites(nextInvites);
    notify("Signed in successfully.");
    checkDraftRecovery();
  };

  const handleSignUp = async (email: string, name: string, password: string) => {
    const result = await signup(email, name, password);
    setUser(result.user);
    setView("dashboard");
    const [mark, ownStories, nextStats, nextInvites] = await Promise.all([fetchBookmarks(), fetchMyStories(), fetchMyStats(), fetchCollaborationInvites()]);
    setBookmarks(mark);
    setMyStories(ownStories);
    setStats(nextStats);
    setCollaborationInvites(nextInvites);
    notify("Account created! Welcome to Luma.");
    checkDraftRecovery();
  };

  const signOut = async () => {
    await logout();
    setUser(null);
    setBookmarks([]);
    setMyStories([]);
    setCollaborationInvites({ received: [], sent: [], pendingCount: 0 });
    setEditingStory(null);
    setStats({ stories: 0, published: 0, drafts: 0, views: 0, likes: 0, comments: 0, bookmarks: 0, readers: 0 });
    setView("home");
    notify("Signed out.");
  };

  const handleToggleBookmark = async (storyId: string) => {
    if (!user) { notify("Sign in to manage your reading list."); return; }
    if (!/^[a-f\d]{24}$/i.test(storyId)) { notify("Only published MongoDB stories can be added to your reading list."); return; }
    try {
      const updated = await toggleBookmark(storyId);
      setBookmarks(updated);
      fetchMyStats().then(setStats).catch(() => undefined);
      notify(updated.some((bookmark) => String(bookmark.id) === storyId) ? "Saved to your reading list." : "Removed from your reading list.");
    } catch {
      notify("Unable to update bookmark.");
    }
  };

  const handleLike = async (storyId: string) => {
    if (!user) { notify("Sign in to like stories."); return; }
    if (!/^[a-f\d]{24}$/i.test(storyId)) { notify("Only published MongoDB stories can be liked."); return; }
    try {
      const updated = await toggleLike(storyId);
      updateStoryInState(updated);
      fetchMyStats().then(setStats).catch(() => undefined);
      notify("Like updated.");
    } catch {
      notify("Unable to update like.");
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!window.confirm("Delete this blog permanently? This cannot be undone.")) return;
    try {
      await deleteStory(storyId);
      removeStoryFromState(storyId);
      const nextStats = await fetchMyStats();
      setStats(nextStats);
      notify("Blog deleted.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to delete blog.");
    }
  };

  const handleEditStory = (story: Article) => {
    if (!story.canEdit) return notify("Editing window expired");
    setEditingStory(story);
    setView("studio");
  };
  const handleInviteCollaborator = async (story: Article) => {
    const value = window.prompt("Enter collaborator registered email");
    if (!value) return;
    try {
      await inviteCollaborator(String(story.id), value);
      setCollaborationInvites(await fetchCollaborationInvites());
      notify("Invite sent. The user must accept before they can edit.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to invite collaborator.");
    }
  };
  const handleRemoveCollaborator = async (story: Article, userId: string) => {
    if (!window.confirm("Remove this collaborator?")) return;
    try {
      const updated = await removeCollaborator(String(story.id), userId);
      updateStoryInState(updated);
      notify("Collaborator removed.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to remove collaborator.");
    }
  };
  const handleAcceptInvite = async (inviteId: string) => {
    try {
      const result = await acceptCollaborationInvite(inviteId);
      if (result.story) updateStoryInState(result.story);
      const [ownStories, nextInvites, nextStats] = await Promise.all([fetchMyStories(), fetchCollaborationInvites(), fetchMyStats()]);
      setMyStories(ownStories);
      setCollaborationInvites(nextInvites);
      setStats(nextStats);
      notify("Invite accepted. The blog is now in Shared With Me.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to accept invite.");
    }
  };
  const handleRejectInvite = async (inviteId: string) => {
    try {
      await rejectCollaborationInvite(inviteId);
      setCollaborationInvites(await fetchCollaborationInvites());
      notify("Invite rejected.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to reject invite.");
    }
  };

  const body = useMemo(() => {
    if (view === "article" && selected) return <ArticleView article={selected} setView={setView} saved={bookmarks.some((bookmark) => String(bookmark.id) === String(selected.id))} user={user} notify={notify} recommendations={recommendationsFor(selected, persistedStories)} openArticle={openArticle} onBookmark={() => handleToggleBookmark(String(selected.id))} onLike={() => handleLike(String(selected.id))} onCommentCountChange={(delta) => updateStoryInState({ ...selected, comments: Math.max(0, (selected.comments || 0) + delta) })} />;
    if (view === "studio") {
      if (!user) return <Login onSignIn={signIn} onSignUp={handleSignUp} onCancel={() => setView("home")} />;
      return <Studio user={user} editingStory={editingStory} onCancelEdit={() => { setEditingStory(null); setView("dashboard"); }} notify={notify} onStoryUpdated={updateStoryInState} onDraftDiscarded={(storyId) => { removeStoryFromState(storyId); setEditingStory(null); setView("dashboard"); }} onInvitesChanged={() => fetchCollaborationInvites().then(setCollaborationInvites).catch(() => undefined)} onPublished={(article) => {
        setPersistedStories((current) => current.some((story) => String(story.id) === String(article.id)) ? current.map((story) => String(story.id) === String(article.id) ? article : story) : [article, ...current]);
        setMyStories((current) => current.some((story) => String(story.id) === String(article.id)) ? current.map((story) => String(story.id) === String(article.id) ? article : story) : [article, ...current]);
        setEditingStory(null);
        setSelected(article);
        setView("article");
        fetchMyStats().then(setStats).catch(() => undefined);
        notify(editingStory ? "Blog updated." : "Published publicly and saved to MongoDB Atlas.");
      }} />;
    }
    if (view === "dashboard") {
      if (!user) return <Login onSignIn={signIn} onSignUp={handleSignUp} onCancel={() => setView("home")} />;
      return <Dashboard setView={setView} notify={notify} user={user} stories={myStories} bookmarks={bookmarks} stats={stats} invites={collaborationInvites} onToggleBookmark={handleToggleBookmark} onDeleteStory={handleDeleteStory} onEditStory={handleEditStory} onOpenStory={openArticle} onSignOut={signOut} onInviteCollaborator={handleInviteCollaborator} onRemoveCollaborator={handleRemoveCollaborator} onAcceptInvite={handleAcceptInvite} onRejectInvite={handleRejectInvite} />;
    }
    if (view === "admin") {
      if (!user) return <Login onSignIn={signIn} onSignUp={handleSignUp} onCancel={() => setView("home")} />;
      if (user.role !== "admin") return <Dashboard setView={setView} notify={notify} user={user} stories={myStories} bookmarks={bookmarks} stats={stats} invites={collaborationInvites} onToggleBookmark={handleToggleBookmark} onDeleteStory={handleDeleteStory} onEditStory={handleEditStory} onOpenStory={openArticle} onSignOut={signOut} onInviteCollaborator={handleInviteCollaborator} onRemoveCollaborator={handleRemoveCollaborator} onAcceptInvite={handleAcceptInvite} onRejectInvite={handleRejectInvite} />;
      return <AdminDashboard setView={setView} notify={notify} onStoryRemoved={(storyId) => removeStoryFromState(storyId)} />;
    }
    if (view === "login") return <Login onSignIn={signIn} onSignUp={handleSignUp} onCancel={() => setView("home")} />;
    return <Home setView={setView} openArticle={openArticle} stories={persistedStories} notify={notify} user={user} bookmarks={bookmarks} onToggleBookmark={handleToggleBookmark} />;
  }, [view, selected, persistedStories, myStories, bookmarks, user, editingStory, stats, collaborationInvites]);

  const searchableStories = persistedStories;
  return <><Header view={view} setView={setView} dark={dark} setDark={setDark} onSearch={() => setSearchOpen(true)} onTopics={() => document.querySelector("#topics")?.scrollIntoView({ behavior: "smooth" })} notify={notify} user={user} inviteCount={collaborationInvites.pendingCount} onSignOut={signOut} />{body}{searchOpen && <SearchOverlay stories={searchableStories} onClose={() => setSearchOpen(false)} onOpen={(article) => { setSearchOpen(false); openArticle(article); }} />}{toast && <div className="toast">{toast}</div>}</>;
}


