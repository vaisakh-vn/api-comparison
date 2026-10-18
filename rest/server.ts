import express from 'express';
import cors from 'cors';
import { books, authors, reviews } from '../shared/data';
import { Book } from '../shared/types';

// ══════════════════════════════════════════════════════════════
// REST API  →  http://localhost:3001
//
// Core characteristics to observe:
//
//  • Multiple endpoints, each owns one resource type
//  • HTTP verbs (GET/POST/PUT/DELETE) signal intent
//  • No formal schema — the URL structure IS the contract
//  • Over-fetching:  GET /books returns ALL fields even if you
//    only need titles
//  • Under-fetching: GET /books/1 returns authorId, NOT the
//    author object — the client must make a second request to
//    GET /authors/:id to get the name
//
// Run the demo (demos/rest-demo.ts) to see these in action.
// ══════════════════════════════════════════════════════════════

const app = express();
app.use(cors());
app.use(express.json());

// ── Books ─────────────────────────────────────────────────────

app.get('/books', (_req, res) => {
  // Returns ALL fields for ALL books — over-fetching if the UI
  // only needs a title list for a dropdown menu.
  res.json(books);
});

app.get('/books/:id', (req, res) => {
  const book = books.find(b => b.id === req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  // authorId is here, but the author NAME is not — need a 2nd call.
  res.json(book);
});

app.get('/books/:id/reviews', (req, res) => {
  const bookReviews = reviews.filter(r => r.bookId === req.params.id);
  res.json(bookReviews);
});

app.post('/books', (req, res) => {
  const newBook: Book = { id: String(books.length + 1), ...req.body };
  books.push(newBook);
  res.status(201).json(newBook);
});

app.put('/books/:id', (req, res) => {
  const idx = books.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Book not found' });
  books[idx] = { ...books[idx], ...req.body };
  res.json(books[idx]);
});

app.delete('/books/:id', (req, res) => {
  const idx = books.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Book not found' });
  books.splice(idx, 1);
  res.status(204).send();
});

// ── Authors ───────────────────────────────────────────────────

app.get('/authors', (_req, res) => {
  res.json(authors);
});

app.get('/authors/:id', (req, res) => {
  const author = authors.find(a => a.id === req.params.id);
  if (!author) return res.status(404).json({ error: 'Author not found' });
  res.json(author);
});

app.get('/authors/:id/books', (req, res) => {
  const authorBooks = books.filter(b => b.authorId === req.params.id);
  res.json(authorBooks);
});

// ─────────────────────────────────────────────────────────────

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\nREST API running on http://localhost:${PORT}`);
  console.log('\nEndpoints:');
  console.log('  GET    /books');
  console.log('  GET    /books/:id');
  console.log('  GET    /books/:id/reviews');
  console.log('  POST   /books');
  console.log('  PUT    /books/:id');
  console.log('  DELETE /books/:id');
  console.log('  GET    /authors');
  console.log('  GET    /authors/:id');
  console.log('  GET    /authors/:id/books');
  console.log('\nRun the demo:  npm run demo:rest');
});
