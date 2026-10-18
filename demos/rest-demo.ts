// ══════════════════════════════════════════════════════════════
// REST Demo — over-fetching and under-fetching
//
// Prerequisite: npm run rest   (server on http://localhost:3001)
// Run:          npm run demo:rest
// ══════════════════════════════════════════════════════════════

const BASE = process.env.REST_URL ?? 'http://localhost:3001';

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`);
  return res.json();
}

async function main() {
  console.log('══════════════════════════════════════════════');
  console.log('  REST API Demo');
  console.log('══════════════════════════════════════════════\n');

  // ── Demo 1: Under-fetching ────────────────────────────────
  // Goal: render a card showing title + author name + avg rating.
  // REST requires THREE separate HTTP requests.

  console.log('── Demo 1: Under-fetching ───────────────────');
  console.log('Goal: render a card with title + author name + avg rating for "Dune".\n');

  console.log('[Request 1]  GET /books/1');
  const book = await get('/books/1');
  console.log('Response:', JSON.stringify(book, null, 2));
  console.log('→ We have authorId but NOT the author name. Need another call.\n');

  console.log('[Request 2]  GET /authors/1');
  const author = await get(`/authors/${book.authorId}`);
  console.log('Response:', JSON.stringify(author, null, 2));

  console.log('\n[Request 3]  GET /books/1/reviews');
  const reviews = await get('/books/1/reviews');
  console.log('Response:', JSON.stringify(reviews, null, 2));

  const avg = reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length;
  console.log('\n── Final card (assembled from 3 requests) ───');
  console.log(`"${book.title}" by ${author.name}  ★ ${avg.toFixed(1)}`);

  // ── Demo 2: Over-fetching ─────────────────────────────────
  // Goal: render a dropdown of book titles only.
  // REST sends ALL fields regardless — wasted bandwidth.

  console.log('\n── Demo 2: Over-fetching ────────────────────');
  console.log('Goal: show a dropdown of just book titles.\n');

  console.log('[Request]  GET /books  (returns ALL fields for ALL books)');
  const allBooks = await get('/books');
  console.log('Response:', JSON.stringify(allBooks, null, 2));
  console.log('\n→ We only needed "title". We also received:');
  console.log('  id, authorId, publishedYear, genre, description — for every book.');

  // ── Summary ───────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  console.log('  REST Summary');
  console.log('══════════════════════════════════════════════');
  console.log('✔  Simple, widely understood, great for CRUD');
  console.log('✔  Works with any HTTP client; easy to cache GET responses');
  console.log('✘  Under-fetching: related data needs multiple round trips');
  console.log('✘  Over-fetching:  fixed response shape, no field selection');
  console.log('✘  No formal schema by default (need separate OpenAPI/Swagger docs)');
}

main().catch(err => {
  console.error('Error — is the REST server running?  npm run rest');
  console.error(err.message);
});
