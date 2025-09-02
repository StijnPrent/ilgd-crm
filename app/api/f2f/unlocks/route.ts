import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.F2F_BASE || "https://f2f.com";
const UA =
  process.env.F2F_UA ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const COOKIES = process.env.F2F_COOKIES || "";

const CREATORS_URL = `${BASE}/api/agency/creators/`;
const CHATS_URL = `${BASE}/api/chats/?ordering=newest-first`;
const CHAT_MESSAGES_URL = (chatId: string) => `${BASE}/api/chats/${chatId}/messages/`;

function headersFor(creatorSlug?: string): Record<string, string> {
  const h: Record<string, string> = {
    accept: "application/json, text/plain, */*",
    "accept-language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
    "user-agent": UA,
    cookie: COOKIES,
    origin: BASE,
    referer: `${BASE}/`,
  };
  if (creatorSlug) h["impersonate-user"] = creatorSlug;
  return h;
}

async function fetchAllPages(startUrl: string, headers: Record<string, string>, label = "") {
  let url: string | null = startUrl;
  const all: any[] = [];
  const seen = new Set<string>();

  while (url) {
    if (seen.has(url)) break;
    seen.add(url);

    const res = await fetch(url, { headers });
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();
    if (!res.ok || ct.includes("text/html")) {
      throw new Error(`[${label}] Blocked/error ${res.status}. First 300 chars:\n${text.slice(0, 300)}`);
    }
    const page = JSON.parse(text);
    const items = Array.isArray(page) ? page : page.results || [];
    all.push(...items);
    url = page.next || null;
  }
  return all;
}

async function getAllCreators() {
  const creators = await fetchAllPages(CREATORS_URL, headersFor(), "creators");
  const slugs = creators
    .map((c: any) => c.username || c.slug || c.id || c.name)
    .filter(Boolean);
  return Array.from(new Set(slugs));
}

async function getAllChatsForCreator(creator: string, from: Date, to: Date) {
  const chats = await fetchAllPages(CHATS_URL, headersFor(creator), `chats:${creator}`);
  const inWindow = (iso?: string) => {
    if (!iso) return false;
    const d = new Date(iso);
    return !Number.isNaN(d.getTime()) && d >= from && d <= to;
  };
  return chats
    .filter((c: any) => inWindow(c.message?.datetime))
    .map((c: any) => ({
      id: c.uuid || c.id,
      title: c.title || "",
      username: c.other_user?.username || null,
      lastMessageAt: c.message?.datetime || null,
    }))
    .filter((c: any) => !!c.id);
}

async function getAllMessagesForChat(creator: string, chatId: string) {
  return fetchAllPages(CHAT_MESSAGES_URL(chatId), headersFor(creator), `msgs:${creator}:${chatId}`);
}

function pickUnlocksInWindow(messages: any[], from: Date, to: Date) {
  return messages
    .filter(
      (m) =>
        m.unlock &&
        typeof m.unlock.price !== "undefined" &&
        m.datetime &&
        new Date(m.datetime) >= from &&
        new Date(m.datetime) <= to,
    )
    .map((m) => ({ datetime: m.datetime, price: Number(m.unlock.price) || 0 }));
}

export async function GET(req: NextRequest) {
  if (!COOKIES || COOKIES.includes("<PASTE")) {
    return NextResponse.json({ error: "Missing F2F_COOKIES" }, { status: 500 });
  }

  const url = new URL(req.url);
  const toParam = url.searchParams.get("to");
  const fromParam = url.searchParams.get("from");
  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - 24 * 60 * 60 * 1000);

  const creators = await getAllCreators();
  const rows: any[] = [];

  for (const creator of creators) {
    const chats = await getAllChatsForCreator(creator, from, to);
    for (const chat of chats) {
      const msgs = await getAllMessagesForChat(creator, chat.id);
      const unlocks = pickUnlocksInWindow(msgs, from, to);
      for (const u of unlocks) {
        rows.push({
          creator,
          chatId: chat.id,
          username: chat.username || chat.title || "",
          datetime: u.datetime,
          price: u.price,
        });
      }
    }
  }

  return NextResponse.json({ from: from.toISOString(), to: to.toISOString(), rows });
}

