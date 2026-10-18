# REST vs GraphQL vs gRPC

A hands-on comparison of three API paradigms, all built over the same domain: a library of books and authors. Run the demos to see the differences in action — then use the deep-dives below to prepare for interviews.

---

## Table of Contents

1. [Project setup & running](#setup)
2. [REST — how it works](#rest)
3. [GraphQL — how it works](#graphql)
4. [gRPC — how it works](#grpc)
5. [Side-by-side comparison](#comparison)
6. [Interview quick-reference](#interview)

---

## Setup

### With Docker (no Node.js needed)

```bash
# Build and start all three servers in the background
docker compose up --build -d

# Run a demo (servers must be up first)
docker compose run --rm demo-rest
docker compose run --rm demo-graphql
docker compose run --rm demo-grpc

# Start only specific servers
docker compose up -d rest graphql

# Stop everything
docker compose down
```

### Locally (Node.js 18+ required)

```bash
npm install
```

Open three separate terminals:

```bash
# Terminal 1
npm run rest        # → http://localhost:3001

# Terminal 2
npm run graphql     # → http://localhost:4000

# Terminal 3
npm run grpc        # → localhost:50051
```

Run demos from a fourth terminal (servers must be running):

```bash
npm run demo:rest
npm run demo:graphql
npm run demo:grpc
```

---

## REST — how it works <a name="rest"></a>

### Core idea

REST (Representational State Transfer) is an architectural style, not a protocol. Proposed by Roy Fielding in 2000, it models an API as a set of **resources**, each with its own URL. The client interacts with them using standard HTTP verbs.

```
GET    /books          → list all books
GET    /books/1        → get one book
POST   /books          → create a book
PUT    /books/1        → replace a book
PATCH  /books/1        → partially update a book
DELETE /books/1        → delete a book
```

### The 6 REST constraints (Fielding's original definition)

| Constraint | What it means |
|---|---|
| **Client–server** | UI and data storage are separated |
| **Stateless** | Each request carries all the context it needs — no session on the server |
| **Cacheable** | Responses must declare whether they can be cached |
| **Uniform interface** | Resources are identified by URIs; interactions are standardised |
| **Layered system** | Client doesn't know if it's talking to the real server or a proxy/CDN |
| **Code on demand** (optional) | Server can send executable code to the client (e.g. JavaScript) |

### HTTP verbs and idempotency

Idempotent means calling the same operation multiple times produces the same result as calling it once. This matters for safe retries.

| Verb | Idempotent? | Safe? | Typical use |
|---|---|---|---|
| GET | ✔ | ✔ | Read |
| PUT | ✔ | ✗ | Full replace |
| DELETE | ✔ | ✗ | Remove |
| POST | ✗ | ✗ | Create, non-idempotent actions |
| PATCH | ✗ | ✗ | Partial update |

### HTTP status codes to know

| Code | Meaning |
|---|---|
| 200 OK | Success |
| 201 Created | Resource created (use with POST) |
| 204 No Content | Success, no body (use with DELETE) |
| 400 Bad Request | Malformed request from the client |
| 401 Unauthorized | Not authenticated |
| 403 Forbidden | Authenticated but not allowed |
| 404 Not Found | Resource doesn't exist |
| 409 Conflict | State conflict (e.g. duplicate) |
| 422 Unprocessable Entity | Validation error |
| 500 Internal Server Error | Server bug |

### The over-fetching and under-fetching problem

**Over-fetching:** `GET /books` returns every field on every book even if the UI only needs a title list. Wasted bandwidth.

**Under-fetching:** `GET /books/1` returns `authorId` but not the author's name. The client must fire a second request to `GET /authors/1`. For N books, that's N+1 requests.

Run `npm run demo:rest` to see both problems live.

### REST versioning strategies

| Strategy | Example | Notes |
|---|---|---|
| URL path | `/v1/books` | Simple, explicit — most common |
| Header | `Accept: application/vnd.api.v2+json` | Clean URLs, harder to test in browser |
| Query param | `/books?version=2` | Easy but can pollute caches |

### When to choose REST

- Public-facing APIs (developers expect it)
- Simple CRUD with little nesting
- Teams that need HTTP-level caching (CDNs, ETags)
- When the client is a browser and you want GET requests to be bookmarkable

---

## GraphQL — how it works <a name="graphql"></a>

### Core idea

GraphQL is a **query language for APIs** developed by Facebook in 2012 and open-sourced in 2015. Instead of many endpoints, there is one (`/graphql`). Instead of the server deciding the response shape, the **client declares exactly what it needs**.

```graphql
# The client asks for exactly these fields — nothing more, nothing less
query {
  book(id: "1") {
    title
    author { name }
    averageRating
  }
}
```

### The three operation types

| Type | Purpose | REST equivalent |
|---|---|---|
| `query` | Read data | GET |
| `mutation` | Write data | POST / PUT / PATCH / DELETE |
| `subscription` | Real-time event stream | WebSocket / SSE |

### The SDL schema — the client-server contract

The Schema Definition Language (SDL) is written on the server and describes every type and every operation the API exposes. It is self-documenting: clients can introspect it at runtime without reading any docs.

```graphql
type Book {
  id: ID!
  title: String!
  author: Author!       # resolver runs only if client asks for this
  averageRating: Float  # computed on demand
}

type Query {
  book(id: ID!): Book
  books: [Book!]!
}
```

The `!` means non-nullable. Removing `!` makes the field optional.

### How resolvers work

Every field in the schema can have a **resolver function**. When a query arrives, GraphQL calls the resolver for each field the client requested — and **only** those fields.

```
query { book(id: "1") { title, author { name } } }

Execution:
  Query.book("1")        → fetches the Book row
  Book.title             → returns book.title (trivial)
  Book.author            → runs the resolver: looks up author by authorId
  Author.name            → returns author.name (trivial)
  Book.averageRating     → NOT called (client didn't ask for it)
```

### The N+1 problem

If the client queries a list of books and each book's author:

```graphql
query { books { title author { name } } }
```

The `Book.author` resolver runs once **per book**. With 100 books that's 100 separate author lookups — the N+1 problem.

The standard fix is **DataLoader**: it batches all author lookups within a single tick into one query (`SELECT * FROM authors WHERE id IN (1, 2, 3, …)`). This project doesn't implement DataLoader (it's not needed for in-memory data) but it's a common interview topic.

### Introspection

Clients can query the schema itself:

```graphql
{ __schema { types { name } } }
{ __type(name: "Book") { fields { name type { name } } } }
```

This is how Apollo Sandbox auto-generates its explorer UI.

### When to choose GraphQL

- Mobile clients where bandwidth matters (ask for only what you need)
- Products with multiple front-end clients (web, iOS, Android) that need different shapes of the same data
- Rapidly evolving APIs where adding fields doesn't break existing clients
- Complex, deeply nested data requirements

---

## gRPC — how it works <a name="grpc"></a>

### Core idea

gRPC is a high-performance RPC (Remote Procedure Call) framework from Google. The client calls methods on a remote server as if they were local functions. The contract is defined in a `.proto` file, which also drives **code generation** for both client and server in any supported language.

```protobuf
service LibraryService {
  rpc GetBook (GetBookRequest) returns (Book);
  rpc ListBooks (ListBooksRequest) returns (stream Book);
}
```

### Protocol Buffers (the wire format)

Instead of JSON, gRPC uses **Protocol Buffers** — a binary serialisation format. Fields are identified by their **number**, not their name.

```protobuf
message Book {
  string id    = 1;   // ← field number, not value
  string title = 2;
  int32  year  = 3;
}
```

**Why binary matters:**
- ~40% smaller payload than equivalent JSON
- ~6× faster serialisation/deserialisation
- Strongly typed — the wrong type won't parse

**Critical rule:** never delete or reuse a field number. Clients compiled against the old schema would silently misread data. Deprecated fields are marked `reserved`.

### HTTP/2 transport

gRPC runs over HTTP/2, which gives it:

| Feature | Benefit |
|---|---|
| **Multiplexing** | Many concurrent requests over one TCP connection (no head-of-line blocking) |
| **Header compression** | Repeated headers (auth tokens, content-type) compressed with HPACK |
| **Binary framing** | Lower overhead than HTTP/1.1 text frames |
| **Server push** | Foundation for streaming |

### The four communication patterns

This is gRPC's biggest differentiator — REST only supports the first pattern.

| Pattern | Description | Use case |
|---|---|---|
| **Unary** | 1 request → 1 response | Same as REST GET, most common |
| **Server streaming** | 1 request → stream of responses | Large result sets, live feeds, file download |
| **Client streaming** | Stream of requests → 1 response | File upload, sensor data batching |
| **Bidirectional streaming** | Both sides stream simultaneously | Chat, multiplayer games, collaborative editing |

This project implements **unary** (`GetBook`) and **server streaming** (`ListBooks`, `WatchNewBooks`).

### gRPC status codes

gRPC has its own error vocabulary — not HTTP status codes:

| Code | Value | Meaning |
|---|---|---|
| OK | 0 | Success |
| CANCELLED | 1 | Client cancelled the request |
| NOT_FOUND | 5 | Resource doesn't exist |
| ALREADY_EXISTS | 6 | Conflict |
| PERMISSION_DENIED | 7 | Not authorised |
| UNAVAILABLE | 14 | Server temporarily unavailable |
| DEADLINE_EXCEEDED | 4 | Request timed out |

### Code generation

In production you'd run the `protoc` compiler to generate typed client and server stubs from the `.proto` file. One proto file generates code for Go, Python, Java, C#, Node.js, etc. — guaranteed to match. This project uses dynamic loading (`@grpc/proto-loader`) to skip that step, which is fine for learning.

### Browser limitation

Browsers cannot use gRPC natively because they cannot control HTTP/2 frames directly. The workaround is **gRPC-Web**: a proxy (e.g. Envoy) sits in front of the gRPC server and translates between gRPC-Web (browser-compatible) and native gRPC.

### When to choose gRPC

- Internal microservice-to-microservice communication
- High-throughput or low-latency requirements (mobile network APIs, trading systems)
- Real-time streaming (sensor telemetry, live dashboards, file transfers)
- Polyglot systems where services are written in different languages
- When a strongly enforced binary contract matters more than human-readability

---

## Side-by-side comparison <a name="comparison"></a>

|  | REST | GraphQL | gRPC |
|---|---|---|---|
| **Endpoint** | One per resource | Single `/graphql` | One per method (in `.proto`) |
| **Schema / contract** | None by default (OpenAPI optional) | SDL — built in | `.proto` — built in |
| **Wire format** | JSON | JSON | Protocol Buffers (binary) |
| **Transport** | HTTP/1.1 | HTTP/1.1 | HTTP/2 |
| **Over-fetching** | Yes — fixed response shape | No — client selects fields | No — message types are exact |
| **Under-fetching** | Yes — multiple round trips | No — nested queries | No — compose messages as needed |
| **Streaming** | Not built in | Subscriptions (WebSocket/SSE) | Built in (4 patterns) |
| **Browser support** | Native | Native | Needs gRPC-Web proxy |
| **Caching** | HTTP caching (CDN-friendly) | Hard (single POST endpoint) | Application-level only |
| **Error model** | HTTP status codes | HTTP 200 + `errors` array | gRPC status codes |
| **Code generation** | Optional (OpenAPI) | Optional (codegen tools) | Built in via `protoc` |
| **Human-readable** | Yes | Yes | No (binary) |
| **Best for** | Public APIs, simple CRUD | Complex/nested data, mobile | Internal services, streaming |

---

## Interview quick-reference <a name="interview"></a>

### Common REST questions

**Q: What makes an API truly RESTful?**  
Following Fielding's six constraints — most importantly: stateless requests, a uniform interface (standard HTTP verbs + meaningful URIs), and cacheability. Most "REST" APIs in the wild are actually REST-ish (they skip HATEOAS and proper cacheability).

**Q: What is HATEOAS?**  
Hypermedia As The Engine Of Application State — responses include links to related actions so the client can navigate the API without hard-coded URLs. Rarely implemented in practice.

**Q: How do you handle versioning?**  
Most common: URL path (`/v1/`). More RESTful: `Accept` header versioning. Avoid: silently breaking changes.

**Q: GET vs POST — when would you use POST for a read?**  
When the query parameters are too large for a URL, or contain sensitive data you don't want in server logs/browser history (e.g. complex search filters).

---

### Common GraphQL questions

**Q: How does GraphQL prevent over-fetching?**  
The client's query lists exactly the fields it needs. Resolvers only execute for requested fields. The server never sends more than was asked for.

**Q: What is the N+1 problem and how do you fix it?**  
When resolving a list of N items where each item triggers a resolver that makes a database call, you end up with N+1 total queries. Fix: DataLoader batches all those calls within one event-loop tick into a single `SELECT … WHERE id IN (…)`.

**Q: Why is HTTP caching harder with GraphQL?**  
All requests go to `POST /graphql`. HTTP caches (browsers, CDNs) work on URL + method. Two identical GraphQL queries have the same URL, but two different queries also have the same URL. Persisted queries (APQ) and client-side normalised caches (Apollo Client, Relay) are the standard workarounds.

**Q: What is introspection and why might you disable it in production?**  
Clients can query `__schema` to discover every type and field in the API. Useful for tooling but can expose your full data model to attackers — commonly disabled in production.

---

### Common gRPC questions

**Q: Why can't you use gRPC directly in a browser?**  
Browsers expose the `fetch`/`XMLHttpRequest` API which doesn't allow raw control of HTTP/2 frames. gRPC requires that control for streaming and binary framing. gRPC-Web is a spec that adapts gRPC to work over HTTP/1.1 requests, with a server-side proxy doing the translation.

**Q: What happens if you reuse a Protocol Buffers field number?**  
The old client will interpret the new field's binary data as the old field's type, silently producing corrupted data. Always mark removed fields as `reserved` to prevent reuse.

**Q: What is the difference between unary and streaming RPCs?**  
Unary: one request, one response — like a function call. Server streaming: one request, the server sends back a sequence of messages. Client streaming: the client sends a sequence of messages, the server replies once. Bidirectional: both sides stream concurrently over one connection.

**Q: When would you use gRPC over REST internally?**  
When you need lower latency (binary format, HTTP/2 multiplexing), strict contracts between services (protobuf schema), server-push streaming, or when services are in different languages and you want generated, type-safe clients everywhere.
