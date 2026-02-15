const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search";
const SPOTIFY_ALBUMS_URL = "https://api.spotify.com/v1/albums";

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type SpotifySearchResponse = {
  albums?: {
    items: Array<{
      id: string;
      name: string;
      artists: Array<{ name: string }>;
      images?: Array<{ url: string; width?: number; height?: number }>;
    }>;
  };
};

type SpotifyAlbumByIdResponse = {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  images?: Array<{ url: string; width?: number; height?: number }>;
};

export type SpotifyAlbumMatch = {
  id: string;
  name: string;
  artistName: string;
  imageUrl: string;
};

let cachedSpotifyToken: { value: string; expiresAtMs: number } | null = null;

function getSpotifyCredentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId) {
    throw new Error("Missing required environment variable: SPOTIFY_CLIENT_ID");
  }

  if (!clientSecret) {
    throw new Error("Missing required environment variable: SPOTIFY_CLIENT_SECRET");
  }

  return { clientId, clientSecret };
}

async function getSpotifyAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedSpotifyToken && now < cachedSpotifyToken.expiresAtMs) {
    console.info("[spotify/client] token_cache_hit");
    return cachedSpotifyToken.value;
  }

  console.info("[spotify/client] token_cache_miss");
  const { clientId, clientSecret } = getSpotifyCredentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("[spotify/client] token_fetch_failed", { status: response.status });
    throw new Error("Failed to authenticate with Spotify");
  }

  const payload = (await response.json()) as SpotifyTokenResponse;
  const expiresAtMs = now + (payload.expires_in - 30) * 1000;
  cachedSpotifyToken = {
    value: payload.access_token,
    expiresAtMs,
  };
  console.info("[spotify/client] token_fetch_succeeded", {
    expiresInSeconds: payload.expires_in,
  });

  return payload.access_token;
}

function normalizeForCompare(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function selectBestMatch(items: SpotifyAlbumMatch[], expectedAlbum: string, expectedArtist: string): SpotifyAlbumMatch | null {
  if (items.length === 0) {
    return null;
  }

  const normalizedAlbum = normalizeForCompare(expectedAlbum);
  const normalizedArtist = normalizeForCompare(expectedArtist);

  const exact = items.find((item) => {
    const albumMatch = normalizeForCompare(item.name) === normalizedAlbum;
    const artistMatch = normalizeForCompare(item.artistName) === normalizedArtist;
    return albumMatch && artistMatch;
  });

  if (exact) {
    return exact;
  }

  const close = items.find((item) => {
    const albumText = normalizeForCompare(item.name);
    const artistText = normalizeForCompare(item.artistName);
    return albumText.includes(normalizedAlbum) || normalizedAlbum.includes(albumText) || artistText.includes(normalizedArtist);
  });

  return close ?? items[0];
}

async function searchAlbums(query: string): Promise<SpotifyAlbumMatch[]> {
  console.info("[spotify/client] search_started", { query });
  const token = await getSpotifyAccessToken();
  const params = new URLSearchParams({
    q: query,
    type: "album",
    limit: "5",
  });

  const response = await fetch(`${SPOTIFY_SEARCH_URL}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("[spotify/client] search_failed", { query, status: response.status });
    throw new Error("Failed to query Spotify albums");
  }

  const payload = (await response.json()) as SpotifySearchResponse;
  const items = (payload.albums?.items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    artistName: item.artists[0]?.name ?? "Unknown Artist",
    imageUrl: item.images?.[0]?.url ?? "",
  }));
  console.info("[spotify/client] search_finished", { query, resultCount: items.length });
  return items;
}

export async function searchSpotifyAlbums(query: string, limit = 5): Promise<SpotifyAlbumMatch[]> {
  console.info("[spotify/client] search_tool_started", { query, limit });
  const token = await getSpotifyAccessToken();
  const params = new URLSearchParams({
    q: query,
    type: "album",
    limit: String(Math.max(1, Math.min(limit, 20))),
  });

  const response = await fetch(`${SPOTIFY_SEARCH_URL}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("[spotify/client] search_tool_failed", { query, status: response.status });
    throw new Error("Failed to query Spotify albums");
  }

  const payload = (await response.json()) as SpotifySearchResponse;
  const items = (payload.albums?.items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    artistName: item.artists[0]?.name ?? "Unknown Artist",
    imageUrl: item.images?.[0]?.url ?? "",
  }));
  console.info("[spotify/client] search_tool_finished", { query, resultCount: items.length });
  return items;
}

export async function getSpotifyAlbumById(spotifyAlbumId: string): Promise<SpotifyAlbumMatch | null> {
  console.info("[spotify/client] get_album_started", { spotifyAlbumId });
  const token = await getSpotifyAccessToken();
  const response = await fetch(`${SPOTIFY_ALBUMS_URL}/${encodeURIComponent(spotifyAlbumId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    console.warn("[spotify/client] get_album_not_found", { spotifyAlbumId });
    return null;
  }

  if (!response.ok) {
    console.error("[spotify/client] get_album_failed", { spotifyAlbumId, status: response.status });
    throw new Error("Failed to fetch Spotify album by id");
  }

  const payload = (await response.json()) as SpotifyAlbumByIdResponse;
  const album = {
    id: payload.id,
    name: payload.name,
    artistName: payload.artists[0]?.name ?? "Unknown Artist",
    imageUrl: payload.images?.[0]?.url ?? "",
  };
  console.info("[spotify/client] get_album_finished", { spotifyAlbumId, found: true });
  return album;
}

export async function findSpotifyAlbum(albumName: string, artistName: string): Promise<SpotifyAlbumMatch | null> {
  console.info("[spotify/client] find_album_started", { albumName, artistName });
  const preciseResults = await searchAlbums(`album:${albumName} artist:${artistName}`);
  const preciseMatch = selectBestMatch(preciseResults, albumName, artistName);
  if (preciseMatch) {
    console.info("[spotify/client] find_album_precise_match", { spotifyAlbumId: preciseMatch.id });
    return preciseMatch;
  }

  console.info("[spotify/client] find_album_fallback_search");
  const broadResults = await searchAlbums(`${albumName} ${artistName}`);
  const broadMatch = selectBestMatch(broadResults, albumName, artistName);
  console.info("[spotify/client] find_album_finished", { matched: Boolean(broadMatch), spotifyAlbumId: broadMatch?.id });
  return broadMatch;
}
