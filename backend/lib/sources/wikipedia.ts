import axios from "axios";
import { SourcedFact } from "../research";

async function summary(
  query: string,
  lang: "fr" | "en",
): Promise<{ text: string; url: string } | null> {
  try {
    const res = await axios.get(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
      { timeout: 10000 },
    );
    if (res.data?.extract) {
      return {
        text: res.data.extract,
        url:
          res.data.content_urls?.desktop?.page ||
          `https://${lang}.wikipedia.org/wiki/${query}`,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

async function search(
  query: string,
  lang: "fr" | "en",
): Promise<{ text: string; url: string } | null> {
  try {
    const res = await axios.get(
      `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1&srlimit=1`,
      { timeout: 10000 },
    );
    const title = res.data?.query?.search?.[0]?.title;
    if (!title) return null;
    return summary(title, lang);
  } catch {
    return null;
  }
}

export async function fetchWikipediaTrack(
  title: string,
  artist: string,
): Promise<SourcedFact | null> {
  const r = await search(`${title} ${artist} song`, "en");
  if (!r) return null;
  return { content: r.text, source: "Wikipedia EN", url: r.url };
}
