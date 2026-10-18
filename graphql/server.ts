import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { books, authors, reviews } from '../shared/data';
import { Book, Author } from '../shared/types';

// ══════════════════════════════════════════════════════════════
// GraphQL API  →  http://localhost:4000
//
// Core characteristics to observe:
//
//  • Single endpoint (/graphql) for ALL operations
//  • The SDL schema (typeDefs) is the formal client-server contract
//  • Client specifies exactly which fields it wants → no over-fetching
//  • Nested queries (book → author → name) in ONE round trip
//    → no under-fetching
//  • Field resolvers only execute when the client requests that field
//  • Mutations replace REST's POST / PUT / DELETE
//
// Visit http://localhost:4000 for Apollo Sandbox to try queries.
// Run the demo:  npm run demo:graphql
// ══════════════════════════════════════════════════════════════

// The SDL (Schema Definition Language) is the contract.
// Any field not listed here is invisible to clients.
const typeDefs = `#graphql
  type Book {
    id: ID!
    title: String!
    publishedYear: Int!
    genre: String!
    description: String!
    # These fields trigger their own resolvers — only runs when asked for
    author: Author!
    reviews: [Review!]!
    averageRating: Float
  }

  type Author {
    id: ID!
    name: String!
    bio: String!
    books: [Book!]!
  }

  type Review {
    id: ID!
    rating: Int!
    comment: String!
  }

  type Query {
    books: [Book!]!
    book(id: ID!): Book
    authors: [Author!]!
    author(id: ID!): Author
  }

  type Mutation {
    addBook(
      title: String!
      authorId: ID!
      publishedYear: Int!
      genre: String!
      description: String!
    ): Book!
  }
`;

const resolvers = {
  Query: {
    books:   () => books,
    book:    (_: unknown, { id }: { id: string }) => books.find(b => b.id === id) ?? null,
    authors: () => authors,
    author:  (_: unknown, { id }: { id: string }) => authors.find(a => a.id === id) ?? null,
  },

  // Field resolvers on Book — each only runs when the client's query
  // includes that field. If you query `{ books { title } }`, none of
  // these execute. This is fundamentally different from REST, where the
  // server always computes and sends every field.
  Book: {
    author: (book: Book) =>
      authors.find(a => a.id === book.authorId),

    reviews: (book: Book) =>
      reviews.filter(r => r.bookId === book.id),

    averageRating: (book: Book) => {
      const bookReviews = reviews.filter(r => r.bookId === book.id);
      if (bookReviews.length === 0) return null;
      return bookReviews.reduce((sum, r) => sum + r.rating, 0) / bookReviews.length;
    },
  },

  Author: {
    books: (author: Author) => books.filter(b => b.authorId === author.id),
  },

  Mutation: {
    addBook: (_: unknown, args: Omit<Book, 'id'>) => {
      const newBook: Book = { id: String(books.length + 1), ...args };
      books.push(newBook);
      return newBook;
    },
  },
};

async function main() {
  const server = new ApolloServer({ typeDefs, resolvers });
  const { url } = await startStandaloneServer(server, { listen: { port: 4000 } });

  console.log(`\nGraphQL API running at ${url}`);
  console.log('Open the URL in a browser for Apollo Sandbox.\n');
  console.log('Example query (replaces 3 REST calls with 1):');
  console.log(`
  query {
    book(id: "1") {
      title
      author { name }
      averageRating
    }
  }
  `);
  console.log('Run the demo:  npm run demo:graphql');
}

main();
