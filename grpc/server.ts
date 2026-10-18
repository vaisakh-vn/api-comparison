import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { books, authors } from '../shared/data';
import { Book } from '../shared/types';

// ══════════════════════════════════════════════════════════════
// gRPC Server  →  localhost:50051
//
// Core characteristics to observe:
//
//  • Binary Protocol Buffers instead of JSON → smaller payloads,
//    faster serialization (benchmark: ~6× faster than JSON at scale)
//  • HTTP/2 transport → multiplexing, header compression
//  • .proto schema is both documentation AND code contract
//  • gRPC status codes (NOT HTTP status codes):
//      OK, NOT_FOUND, INVALID_ARGUMENT, UNAVAILABLE, etc.
//  • Server streaming: the client receives records one at a time
//    as the server writes them — no REST/GraphQL equivalent without
//    SSE/WebSockets
//
// Run the demo:  npm run demo:grpc
// ══════════════════════════════════════════════════════════════

const PROTO_PATH = path.join(__dirname, 'proto/library.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

// Dynamic loading: no code-generation step needed for this demo.
// In production you'd run `protoc` to generate typed stubs.
const libraryProto = grpc.loadPackageDefinition(packageDef) as any;

// ── Unary handlers (one request → one response) ───────────────

function getBook(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
) {
  const book = books.find(b => b.id === call.request.id);
  if (!book) {
    return callback({ code: grpc.status.NOT_FOUND, message: 'Book not found' });
  }
  callback(null, book);
}

function getAuthor(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
) {
  const author = authors.find(a => a.id === call.request.id);
  if (!author) {
    return callback({ code: grpc.status.NOT_FOUND, message: 'Author not found' });
  }
  callback(null, author);
}

function addBook(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
) {
  const newBook: Book = { id: String(books.length + 1), ...call.request };
  books.push(newBook);
  callback(null, newBook);
}

// ── Streaming handlers ────────────────────────────────────────

// Server streaming: writes each matching book individually.
// The client can start processing the first book before the server
// has finished finding the rest — unlike REST which buffers everything.
function listBooks(call: grpc.ServerWritableStream<any, any>) {
  const genre: string = call.request.genre;
  const filtered = genre ? books.filter(b => b.genre === genre) : books;

  for (const book of filtered) {
    if (call.cancelled) break;
    call.write(book);
  }
  call.end();
}

// Simulates a real-time feed: push a new book every N seconds.
// This pattern is impractical in REST (requires polling) and needs
// subscriptions/SSE in GraphQL.
function watchNewBooks(call: grpc.ServerWritableStream<any, any>) {
  const intervalSec: number = call.request.interval_seconds || 2;
  let count = 0;

  const timer = setInterval(() => {
    if (call.cancelled || count >= 3) {
      clearInterval(timer);
      call.end();
      return;
    }
    const fakeBook: Book = {
      id: `stream-${count}`,
      title: `Newly Published Book ${count + 1}`,
      authorId: '1',
      publishedYear: 2024,
      genre: 'Science Fiction',
      description: 'Pushed to the client in real time.',
    };
    call.write(fakeBook);
    count++;
  }, intervalSec * 1000);

  call.on('cancelled', () => clearInterval(timer));
}

// ── Bootstrap ─────────────────────────────────────────────────

function main() {
  const server = new grpc.Server();

  server.addService(libraryProto.library.LibraryService.service, {
    GetBook:       getBook,
    GetAuthor:     getAuthor,
    AddBook:       addBook,
    ListBooks:     listBooks,
    WatchNewBooks: watchNewBooks,
  });

  const PORT = 50051;
  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) throw err;
      console.log(`\ngRPC server running on port ${port}`);
      console.log('\nKey differences from REST/GraphQL:');
      console.log('  Binary Protocol Buffers (not JSON)');
      console.log('  HTTP/2 transport');
      console.log('  Supports server streaming (ListBooks, WatchNewBooks)');
      console.log('  .proto file = schema + code generation for any language');
      console.log('\nRun the demo:  npm run demo:grpc');
    },
  );
}

main();
