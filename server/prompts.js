const prompts = {
  improve: (content) => `Act as a thoughtful editorial coach. Give one concise, specific suggestion to improve this draft while preserving the writer's voice. Do not rewrite the whole piece.\n\nDraft:\n${content}`,
  outline: (content) => `Create a concise article outline with 4 to 6 sections for this draft. Return markdown only.\n\nDraft:\n${content}`,
  seo: (content) => `Generate a short SEO title, a meta description under 155 characters, and 6 relevant keywords for this article. Return markdown only.\n\nDraft:\n${content}`,
  concise: (content) => `Suggest three specific ways to make this draft more concise while retaining its tone. Return a short markdown list.\n\nDraft:\n${content}`,
};

export function createPrompt(action, content, tags = []) {
  const prompt = prompts[action] ?? prompts.improve;
  const tagContext = Array.isArray(tags) && tags.length ? `\n\nSelected tags/domains: ${tags.join(", ")}\nUse these tags to shape tone, examples, structure, and terminology.` : "";
  return `${prompt(content)}${tagContext}`;
}

export function createContextualMessages({ mode = "writer", draft = "", selectedText = "", memory = [], question = "", action = "", tags = [] }) {
  const tagList = Array.isArray(tags) ? tags.filter(Boolean) : [];
  const tagInstruction = tagList.length
    ? ` Selected tags: ${tagList.join(", ")}. Treat these as high-priority writing context. Adapt tone, examples, headings, terminology, and depth to the tags. Technical/tutorial tags should produce structured, clear, beginner-aware explanations; opinion/sports tags can be more conversational and story-driven; research/education tags should be professional and well organized.`
    : "";
  const system = mode === "reader"
    ? `You are Luma Reader AI, a premium article explainer. Answer only questions directly related to the provided article. If the user asks about unrelated topics, politely refuse and redirect to article discussion. Be clear, educational, and concise.${tagInstruction}`
    : `You are Luma Copilot, an elite blog-writing partner. Stay strictly focused on the current blog draft. Help with professional blog writing, rewriting, SEO-aware structure, headings, examples, readability, clarity, summaries, and formatting. If the user asks for unrelated general chat, politely refuse and redirect to improving the blog. When asked to write a blog, produce a polished article with a strong title, hook, headings, examples, flow, and conclusion. Return clean HTML-friendly content when appropriate.${tagInstruction}`;

  const lastFive = Array.isArray(memory) ? memory.slice(-5).filter(Boolean) : [];
  return [
    { role: "system", content: system },
    { role: "user", content: `CURRENT ${mode === "reader" ? "ARTICLE" : "BLOG DRAFT"} CONTEXT:\n${draft || "No draft content yet."}` },
    ...(tagList.length ? [{ role: "user", content: `SELECTED TAGS:\n${tagList.join(", ")}` }] : []),
    ...(selectedText ? [{ role: "user", content: `SELECTED TEXT TO FOCUS ON:\n${selectedText}` }] : []),
    ...(lastFive.length ? [{ role: "user", content: `SHORT MEMORY - LAST USER QUESTIONS:\n${lastFive.map((item, index) => `${index + 1}. ${item}`).join("\n")}` }] : []),
    { role: "user", content: `CURRENT USER REQUEST${action ? ` (${action})` : ""}:\n${question || action || "Improve the writing."}` },
  ];
}
