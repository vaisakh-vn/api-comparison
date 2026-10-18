// ══════════════════════════════════════════════════════════════
// GraphQL Demo — solving REST's over/under-fetching
//
// Prerequisite: npm run graphql   (server on http://localhost:4000)
// Run:          npm run demo:graphql
// ══════════════════════════════════════════════════════════════

const ENDPOINT = process.env.GRAPHQL_URL ?? 'http://localhost:4000/';

async function gql(query: string) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

async function main() {
  console.log('══════════════════════════════════════════════');
  console.log('  GraphQL Demo');
  console.log('══════════════════════════════════════════════\n');

  // ── Demo 1: No under-fetching ─────────────────────────────
  // Same goal as rest-demo Demo 1: title + author name + avg rating.
  // One request instead of three.

  console.log('── Demo 1: No under-fetching ────────────────');
  console.log('Same goal as REST demo: title + author name + avg rating.');
  console.log('ONE request, not three.\n');

  const { data: d1 } = await gql(`
    query {
      book(id: "1") {
        title
        author { name }
        averageRating
      }
    }
  `);

  console.log('Response:', JSON.stringify(d1, null, 2));
  const { title, author, averageRating } = d1.book;
  console.log(`\n→ "${title}" by ${author.name}  ★ ${averageRating.toFixed(1)}`);
  console.log('   One POST /graphql vs REST\'s three GET requests.\n');

  // ── Demo 2: No over-fetching ──────────────────────────────
  // Ask for only the fields you need — server sends nothing extra.

  console.log('── Demo 2: No over-fetching ─────────────────');
  console.log('Goal: dropdown of book titles only.\n');

  const { data: d2 } = await gql(`
    query {
      books {
        title
      }
    }
  `);

  console.log('Response:', JSON.stringify(d2, null, 2));
  console.log('\n→ Only "title" returned. No id, authorId, genre, description.');
  console.log('   Compare to REST which always returns ALL fields.\n');

  // ── Demo 3: Deeply nested query ───────────────────────────
  // Fetch authors → books → reviews in one shot.
  // Would require 1 + N + N*M requests in REST.

  console.log('── Demo 3: Nested data in one query ─────────');
  console.log('Authors → their books → each book\'s reviews. One request.\n');

  const { data: d3 } = await gql(`
    query {
      authors {
        name
        books {
          title
          publishedYear
          reviews {
            rating
            comment
          }
        }
      }
    }
  `);

  console.log('Response:', JSON.stringify(d3, null, 2));
  console.log('\n→ REST equivalent: GET /authors, then GET /authors/:id/books');
  console.log('   for each author, then GET /books/:id/reviews for each book.\n');

  // ── Demo 4: Mutation ──────────────────────────────────────
  // GraphQL collapses POST/PUT/DELETE into typed mutation operations.

  console.log('── Demo 4: Mutation (vs REST POST/PUT/DELETE) ─');
  const { data: d4 } = await gql(`
    mutation {
      addBook(
        title: "Children of Dune"
        authorId: "1"
        publishedYear: 1976
        genre: "Science Fiction"
        description: "Third book in the Dune series."
      ) {
        id
        title
      }
    }
  `);

  console.log('Response:', JSON.stringify(d4, null, 2));
  console.log('→ Mutation returns only the fields you ask for — just like queries.\n');

  // ── Summary ───────────────────────────────────────────────
  console.log('══════════════════════════════════════════════');
  console.log('  GraphQL Summary');
  console.log('══════════════════════════════════════════════');
  console.log('✔  No over-fetching:  ask for exactly the fields you need');
  console.log('✔  No under-fetching: nested queries in one round trip');
  console.log('✔  SDL schema: self-documenting, type-safe contract');
  console.log('✔  Introspection: clients can discover the schema at runtime');
  console.log('✘  Single endpoint makes HTTP-level GET caching harder');
  console.log('✘  N+1 query problem (field resolvers called per parent item)');
  console.log('   → mitigated in production with DataLoader batching');
  console.log('✘  More complex setup than REST');
}

main().catch(err => {
  console.error('Error — is the GraphQL server running?  npm run graphql');
  console.error(err.message);
});
