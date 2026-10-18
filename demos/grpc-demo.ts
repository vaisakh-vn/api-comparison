// ══════════════════════════════════════════════════════════════
// gRPC Demo — binary protocol and streaming
//
// Prerequisite: npm run grpc   (server on localhost:50051)
// Run:          npm run demo:grpc
// ══════════════════════════════════════════════════════════════

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../grpc/proto/library.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const libraryProto = grpc.loadPackageDefinition(packageDef) as any;

const client = new libraryProto.library.LibraryService(
  process.env.GRPC_HOST ?? 'localhost:50051',
  grpc.credentials.createInsecure(),
);

// Wrap a unary gRPC call in a Promise so we can use async/await
function call(method: string, request: object): Promise<any> {
  return new Promise((resolve, reject) => {
    client[method](request, (err: Error | null, response: unknown) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

async function main() {
  console.log('══════════════════════════════════════════════');
  console.log('  gRPC Demo');
  console.log('══════════════════════════════════════════════\n');

  // ── Demo 1: Unary RPC ─────────────────────────────────────
  // One request → one response, same as REST GET or GraphQL query.
  // The payload is Protocol Buffers (binary), not JSON.

  console.log('── Demo 1: Unary RPC ────────────────────────');
  console.log('GetBook("1") — one request, one response (like REST GET).');
  console.log('The wire format is binary Protocol Buffers, not JSON.\n');

  const book = await call('GetBook', { id: '1' });
  console.log('Decoded response:', JSON.stringify(book, null, 2));
  console.log('\n→ You see JSON here because @grpc/grpc-js decoded the binary for us.');
  console.log('   On the wire this was ~40% smaller than the equivalent JSON.\n');

  // ── Demo 2: Typed error codes ─────────────────────────────
  // gRPC uses its own status codes, not HTTP 404/500.

  console.log('── Demo 2: gRPC error codes (not HTTP status codes) ─');
  try {
    await call('GetBook', { id: 'nonexistent' });
  } catch (err: any) {
    console.log('Error code:', err.code, '← grpc.status.NOT_FOUND = 5');
    console.log('Error message:', err.message);
    console.log('\n→ gRPC status codes: OK=0, CANCELLED=1, NOT_FOUND=5,');
    console.log('   ALREADY_EXISTS=6, PERMISSION_DENIED=7, UNAVAILABLE=14…');
    console.log('   Different vocabulary from HTTP — no 404/500 mapping.\n');
  }

  // ── Demo 3: Server-side streaming ────────────────────────
  // The server streams back books one at a time.
  // The client processes each as it arrives, not waiting for all.
  // REST has no native equivalent — you get one batched JSON array.

  console.log('── Demo 3: Server streaming ─────────────────');
  console.log('ListBooks — server writes each book to the stream individually.');
  console.log('Client receives them one at a time, not as one big array.\n');

  await new Promise<void>((resolve, reject) => {
    const stream = client.ListBooks({ genre: '' });

    stream.on('data', (b: any) => {
      console.log(`  [stream] received: "${b.title}" (${b.published_year})`);
    });

    stream.on('end', () => {
      console.log('\n→ Stream ended. In a real app this enables:');
      console.log('   • Start rendering the first result before all are ready');
      console.log('   • Stream a 10 GB export without loading it into memory');
      console.log('   • Progress updates during long-running operations\n');
      resolve();
    });

    stream.on('error', reject);
  });

  // ── Demo 4: Real-time push streaming ─────────────────────
  // Server pushes events to the client over a long-lived connection.
  // REST needs polling. GraphQL needs subscriptions/WebSockets.
  // gRPC streaming is built in with a single proto annotation.

  console.log('── Demo 4: Real-time push (WatchNewBooks) ───');
  console.log('Server will push 3 "new book" events, one every 2 seconds.\n');

  await new Promise<void>((resolve, reject) => {
    const stream = client.WatchNewBooks({ interval_seconds: 2 });

    stream.on('data', (b: any) => {
      console.log(`  [${new Date().toLocaleTimeString()}] pushed: "${b.title}"`);
    });

    stream.on('end', () => {
      console.log('\n→ Same pattern handles: live dashboards, notifications,');
      console.log('   file uploads (client streaming), chat (bidirectional streaming).\n');
      resolve();
    });

    stream.on('error', reject);
  });

  // ── Summary ───────────────────────────────────────────────
  console.log('══════════════════════════════════════════════');
  console.log('  gRPC Summary');
  console.log('══════════════════════════════════════════════');
  console.log('✔  Binary Protocol Buffers: ~40% smaller, ~6× faster than JSON');
  console.log('✔  HTTP/2: multiplexing, header compression, lower latency');
  console.log('✔  Streaming: server-push, client-push, bidirectional');
  console.log('✔  .proto generates typed clients in any language (Go, Python, Java…)');
  console.log('✔  Strong contract: mismatched field types fail at compile time');
  console.log('✘  Not human-readable on the wire (need grpcurl / Postman gRPC)');
  console.log('✘  Not natively supported in browsers (need gRPC-Web proxy)');
  console.log('✘  More infrastructure complexity than REST or GraphQL');
  console.log('\nBest for: internal microservice-to-microservice communication,');
  console.log('high-throughput pipelines, polyglot systems, real-time streaming.');
}

main().catch(err => {
  console.error('Error — is the gRPC server running?  npm run grpc');
  console.error(err.message);
});
