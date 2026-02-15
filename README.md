# Boomie

Boomie is a Next.js app for storing user album ratings and generating one personalized album recommendation at a time.

## Local Development

Install dependencies and run the app:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create a `.env` file in the project root. The app needs Firebase variables plus AI/Spotify variables.

### Firebase (already used by this project)

```bash
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
NEXT_PUBLIC_FIREBASE_APP_ID="..."
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"..."}'
```

### Boomie Agent (Gemini + Spotify)

```bash
GOOGLE_GENERATIVE_AI_API_KEY="..."
SPOTIFY_CLIENT_ID="..."
SPOTIFY_CLIENT_SECRET="..."
```

`GOOGLE_GENERATIVE_AI_API_KEY` is used by AI SDK with Gemini 2.5 Flash.

## Spotify Setup

To enable Spotify album verification:

1. Go to the Spotify Developer Dashboard and create an app.
2. Copy the app's Client ID and Client Secret into `.env` as:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
3. No user Spotify login or redirect URI is required for this backend flow (Client Credentials).

## Agent Recommendation API

Auth for both endpoints: Firebase ID token in `Authorization: Bearer <token>`.

### `GET /api/agent/recommendation`

Behavior:
- Reads the signed-in user's current persisted recommendation from Firestore.
- If one exists, returns it immediately.
- If none exists, generates one from the user's rating history with AI SDK tool calling, hydrates it from Spotify by album ID, persists it as current, and returns it.

### `POST /api/agent/recommendation`

Behavior:
- Always generates the next recommendation from the user's rating history.
- Uses AI SDK tool calls to search Spotify albums and select a recommendation by Spotify album ID.
- Hydrates album metadata through Spotify Web API by album ID.
- Persists that recommendation as the user's new current recommendation.
- Returns the new current recommendation.

Response shape:

```json
{
  "tagline": "string",
  "albumDescription": "string",
  "whyForUser": "string",
  "spotifyAlbumImageUrl": "string",
  "spotifyAlbumId": "string",
  "spotifyAlbumName": "string",
  "spotifyArtistName": "string"
}
```

## Frontend Request Sequence

When a user saves a rating, the frontend should:
1. call `POST /api/ratings` and wait for success
2. then call `POST /api/agent/recommendation` to rotate to the next recommendation

## Ratings API Payload

`POST /api/ratings` expects `rating` as one of:

- `hated`
- `disliked`
- `neutral`
- `liked`
- `loved`
- `did-not-listen`
