export type Article = {
  id: number | string;
  title: string;
  excerpt: string;
  authorId?: string;
  author: string;
  initials: string;
  category: string;
  tags?: string[];
  readTime: string;
  date: string;
  image: string;
  accent: string;
  content?: string;
  views?: number;
  likes?: number;
  comments?: number;
  canEdit?: boolean;
  collaborators?: { id: string; name: string; email: string; addedAt?: string | null }[];
  lastEditedBy?: { id: string | null; name: string; at?: string | null } | null;
  autosavedAt?: string | null;
  status?: "draft" | "published";
  publishedAt?: string | null;
  featured?: boolean;
  popular?: boolean;
};

export const articles: Article[] = [
  {
    id: 1,
    title: "The quiet art of building things that last",
    excerpt: "In a world obsessed with speed, a different kind of ambition is emerging: the patience to make work with a longer half-life.",
    author: "Maya Chen",
    initials: "MC",
    category: "Design",
    readTime: "8 min read",
    date: "May 28",
    image: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1400&q=85",
    accent: "#d3a86c",
    featured: true,
  },
  {
    id: 2,
    title: "A field guide to creative confidence",
    excerpt: "The best ideas rarely arrive fully formed. Here is how to create the conditions for them to grow.",
    author: "Lena Ortiz",
    initials: "LO",
    category: "Creativity",
    readTime: "6 min read",
    date: "May 24",
    image: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=900&q=85",
    accent: "#d88f69",
    popular: true,
  },
  {
    id: 3,
    title: "Why your best work needs empty space",
    excerpt: "A practical argument for doing less, leaving room, and protecting the parts of your day that look unproductive.",
    author: "Theo Wright",
    initials: "TW",
    category: "Mindful work",
    readTime: "5 min read",
    date: "May 21",
    image: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=85",
    accent: "#91a09d",
    popular: true,
  },
  {
    id: 4,
    title: "The case for a personal archive",
    excerpt: "What we save shapes what we remember. A small system for keeping the ideas that keep you moving.",
    author: "Amara Reed",
    initials: "AR",
    category: "Ideas",
    readTime: "7 min read",
    date: "May 18",
    image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=85",
    accent: "#a08b76",
  },
  {
    id: 5,
    title: "Software with a point of view",
    excerpt: "The most memorable tools are not neutral. They make a thoughtful bet about how work ought to feel.",
    author: "Noah Kim",
    initials: "NK",
    category: "Technology",
    readTime: "9 min read",
    date: "May 15",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=85",
    accent: "#657e99",
    popular: true,
  },
  {
    id: 6,
    title: "Small rituals for deeper reading",
    excerpt: "A gentle reset for your attention, from choosing the right book to making the ideas your own.",
    author: "Iris Bell",
    initials: "IB",
    category: "Culture",
    readTime: "4 min read",
    date: "May 12",
    image: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=900&q=85",
    accent: "#89745c",
  },
];

export const topics = ["Design", "Technology", "Creativity", "Mindful work", "Culture", "Ideas"];
