# REST vs GraphQL vs gRPC

A hands-on comparison of three API styles built over the same domain: a library of books, authors and reviews. Run the demos to see the differences live, then use the diagrams below to understand how each one works.

---

## Table of Contents

1. [Setup & running](#setup)
2. [Architecture overview](#architecture)
3. [REST — how it works](#rest)
4. [GraphQL — how it works](#graphql)
5. [gRPC — how it works](#grpc)
6. [Side-by-side comparison](#comparison)

---

## Setup <a name="setup"></a>

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

Start each server in its own terminal:

```bash
npm run rest        # → http://localhost:3001
npm run graphql     # → http://localhost:4000
npm run grpc        # → localhost:50051
```

Then run the demos from another terminal:

```bash
npm run demo:rest       # over-fetching & under-fetching
npm run demo:graphql    # the same data in one query
npm run demo:grpc       # binary protocol & streaming
```

---

## Architecture overview <a name="architecture"></a>

All three servers read the same in-memory data from `shared/data.ts`. There is no database, so data resets when a server restarts.

```mermaid
flowchart LR
    C1["REST client<br/>curl / browser"] -- "HTTP/1.1 + JSON" --> REST["REST server<br/>Express · :3001"]
    C2["GraphQL client<br/>Apollo Sandbox"] -- "HTTP/1.1 + JSON" --> GQL["GraphQL server<br/>Apollo · :4000"]
    C3["gRPC client<br/>grpcurl / demo"] -- "HTTP/2 + Protobuf" --> GRPC["gRPC server<br/>:50051"]

    REST --> DATA[("shared/data.ts<br/>books · authors · reviews")]
    GQL --> DATA
    GRPC --> DATA

    classDef client fill:#f1f5f9,stroke:#64748b,color:#0f172a
    classDef rest   fill:#dcfce7,stroke:#15803d,stroke-width:2px,color:#052e16
    classDef gql    fill:#fce7f3,stroke:#be185d,stroke-width:2px,color:#500724
    classDef grpc   fill:#dbeafe,stroke:#1d4ed8,stroke-width:2px,color:#172554
    classDef data   fill:#fef3c7,stroke:#b45309,stroke-width:2px,color:#451a03

    class C1,C2,C3 client
    class REST rest
    class GQL gql
    class GRPC grpc
    class DATA data
```

```
shared/               shared types and in-memory data
rest/server.ts        Express server
graphql/server.ts     Apollo Server
grpc/
  proto/library.proto service contract and message definitions
  server.ts           gRPC server
demos/                scripts that call each API and explain the output
```

---

## REST — how it works <a name="rest"></a>

### Core idea

REST models an API as a set of **resources**, each with its own URL. The client acts on them with standard HTTP verbs, and every request is stateless — it carries everything the server needs.

| Request | Meaning |
|---|---|
| `GET /books` | List all books |
| `GET /books/1` | Get one book |
| `POST /books` | Create a book |
| `PUT /books/1` | Replace a book |
| `DELETE /books/1` | Delete a book |

### Request / response flow

```mermaid
sequenceDiagram
    participant C as Client
    participant S as REST server

    C->>S: GET /books/1
    S-->>C: 200 OK + book JSON

    C->>S: POST /books + new book JSON
    S-->>C: 201 Created + saved book

    C->>S: DELETE /books/6
    S-->>C: 204 No Content
```

The HTTP status code tells the client what happened: `2xx` success, `4xx` client error, `5xx` server error.

### Under-fetching: too many round trips

To show one card with **title + author name + average rating**, the client needs three requests, because each endpoint returns only its own resource:

```mermaid
sequenceDiagram
    participant C as Client
    participant S as REST server

    C->>S: 1) GET /books/1
    S-->>C: title, authorId, genre, description
    Note over C: Has authorId, but not the author's name

    C->>S: 2) GET /authors/1
    S-->>C: name, bio
    Note over C: Has the name, but not the ratings

    C->>S: 3) GET /books/1/reviews
    S-->>C: list of ratings and comments
    Note over C: 3 round trips to build 1 card
```

### Over-fetching: too much data

For a dropdown that only needs titles, the server still sends every field of every book:

```mermaid
sequenceDiagram
    participant C as Client
    participant S as REST server

    C->>S: GET /books
    S-->>C: 5 books × 6 fields each
    Note over C: Needed only "title" — 25 of 30 fields wasted
```

### Key properties

| Verb | Idempotent? | Use |
|---|---|---|
| GET | Yes | Read (safe, cacheable) |
| PUT | Yes | Full replace |
| DELETE | Yes | Remove |
| POST | No | Create |
| PATCH | No | Partial update |

*Idempotent* means repeating the call gives the same result as calling it once, so it is safe to retry.

### When to choose REST

- Public APIs that many developers will use
- Simple CRUD without deep nesting
- When you want HTTP caching from browsers and CDNs

---

## GraphQL — how it works <a name="graphql"></a>

### Core idea

GraphQL exposes **one endpoint** (`/graphql`) and a typed **schema**. The client sends a query describing exactly the fields it wants, and the response has exactly that shape.

| Operation | Purpose | REST equivalent |
|---|---|---|
| `query` | Read | GET |
| `mutation` | Write | POST / PUT / DELETE |
| `subscription` | Real-time updates | WebSocket / SSE |

### Request / response flow

The same book card that took three REST calls becomes one request:

```graphql
query {
  book(id: "1") {
    title
    author { name }
    averageRating
  }
}
```

```mermaid
sequenceDiagram
    participant C as Client
    participant S as GraphQL server
    participant R as Resolvers

    C->>S: POST /graphql with the query
    S->>R: Query.book(id 1)
    R-->>S: book row
    S->>R: Book.author
    R-->>S: author name
    S->>R: Book.averageRating
    R-->>S: 4.5
    Note over S,R: genre and description are never resolved — not requested
    S-->>C: 200 OK + JSON with exactly title, author.name, averageRating
```

### How resolvers work

Each field in the schema can have a **resolver** function. GraphQL walks the query tree and calls a resolver only for the fields the client asked for.

For this query:

```graphql
query {
  authors {
    name
    books {
      title
      reviews { rating }
    }
  }
}
```

GraphQL runs this resolver chain:

```mermaid
flowchart TD
    A["Query.authors<br/>returns every author"]
    A --> AN["Author.name<br/>plain field"]
    A --> AB["Author.books<br/>filters books by authorId"]
    AB --> BT["Book.title<br/>plain field"]
    AB --> BR["Book.reviews<br/>filters reviews by bookId"]
    BR --> RR["Review.rating<br/>plain field"]

    classDef root  fill:#ede9fe,stroke:#6d28d9,stroke-width:2px,color:#2e1065
    classDef logic fill:#dbeafe,stroke:#1d4ed8,stroke-width:2px,color:#172554
    classDef plain fill:#f1f5f9,stroke:#64748b,stroke-width:1px,color:#0f172a

    class A root
    class AB,BR logic
    class AN,BT,RR plain
```

- **Purple** — root `Query` resolver, the entry point
- **Blue** — resolvers with real logic (they look up related data)
- **Grey** — plain fields, read straight off the parent object

`Book.author`, `Book.averageRating`, `Book.genre` and the rest are never called, because the query didn't ask for them.

### The N+1 problem

Resolvers run per item. Asking for every book's author runs the author resolver once **per book**:

```mermaid
sequenceDiagram
    participant S as GraphQL server
    participant DB as Database

    S->>DB: SELECT books  (1 query)
    DB-->>S: 5 books
    S->>DB: SELECT author 1
    S->>DB: SELECT author 1
    S->>DB: SELECT author 2
    S->>DB: SELECT author 3
    S->>DB: SELECT author 3
    Note over S,DB: 1 + 5 = N+1 queries
```

The standard fix is **DataLoader**, which collects those lookups and sends one batched query: `SELECT authors WHERE id IN (1, 2, 3)`.

### Try it

Open **http://localhost:4000** for Apollo Sandbox:

```graphql
# Nested data in one request
query {
  authors {
    name
    books {
      title
      reviews { rating comment }
    }
  }
}

# Write data
mutation {
  addBook(
    title: "God Emperor of Dune"
    authorId: "1"
    publishedYear: 1981
    genre: "Science Fiction"
    description: "Fourth Dune book."
  ) {
    id
    title
  }
}
```

### When to choose GraphQL

- Several clients (web, iOS, Android) that need different shapes of the same data
- Mobile apps where bandwidth matters
- Deeply nested, related data

---

## gRPC — how it works <a name="grpc"></a>

### Core idea

gRPC lets a client call a function on a remote server **as if it were local**. The contract lives in a `.proto` file, which tools use to generate matching client and server code in many languages. Messages travel as binary **Protocol Buffers** over **HTTP/2**.

```mermaid
flowchart LR
    P["library.proto<br/>the contract"] -- "generate" --> CS["Client stub<br/>any language"]
    P -- "generate" --> SS["Server stub<br/>any language"]
    CS -- "binary Protobuf over HTTP/2" --> SS

    classDef proto fill:#fef3c7,stroke:#b45309,stroke-width:2px,color:#451a03
    classDef stub  fill:#dbeafe,stroke:#1d4ed8,stroke-width:2px,color:#172554

    class P proto
    class CS,SS stub
```

### Unary call (one request, one response)

```mermaid
sequenceDiagram
    participant C as Client
    participant S as gRPC server

    C->>S: GetBook(id 1)  — binary
    S-->>C: Book message  — binary
    C->>S: GetBook(id 99)
    S-->>C: status NOT_FOUND (code 5)
```

gRPC has its own status codes (`OK`, `NOT_FOUND`, `UNAVAILABLE`, `DEADLINE_EXCEEDED`…) instead of HTTP status codes.

### Server streaming (one request, many responses)

`ListBooks` sends each book as soon as it is ready, over one open connection:

```mermaid
sequenceDiagram
    participant C as Client
    participant S as gRPC server

    C->>S: ListBooks()
    S-->>C: Book "Dune"
    S-->>C: Book "Dune Messiah"
    S-->>C: Book "Foundation"
    S-->>C: ...
    S-->>C: stream closed
    Note over C: Client handles each book as it arrives
```

`WatchNewBooks` keeps the stream open and pushes events over time — something REST can only approximate with polling:

```mermaid
sequenceDiagram
    participant C as Client
    participant S as gRPC server

    C->>S: WatchNewBooks(interval 2s)
    S-->>C: Book "Newly Published Book 1"
    Note over C,S: 2 seconds later
    S-->>C: Book "Newly Published Book 2"
    Note over C,S: 2 seconds later
    S-->>C: Book "Newly Published Book 3"
    S-->>C: stream closed
```

### The four call types

This project implements the first two.

| Type | Shape | Example use |
|---|---|---|
| Unary | 1 request → 1 response | Fetch a record |
| Server streaming | 1 request → many responses | Live feed, large export |
| Client streaming | many requests → 1 response | File upload |
| Bidirectional | many ↔ many | Chat |

### Protocol Buffers on the wire

Fields are identified by **number**, not name, which is why the binary form is so compact:

```protobuf
message Book {
  string id    = 1;
  string title = 2;
  int32  year  = 3;
}
```

```
JSON     {"id":"1","title":"Dune","year":1965}      37 bytes
Protobuf 0a 01 31  12 04 44 75 6e 65  18 ad 0f      12 bytes
         └─ id ─┘  └──── title ────┘  └ year ┘
```

Never reuse or delete a field number — older clients would decode the bytes as the wrong field. Mark removed numbers as `reserved` instead.

### Browsers

Browsers can't speak native gRPC, so web apps go through a proxy:

```mermaid
flowchart LR
    B["Browser"] -- "gRPC-Web" --> P["Proxy<br/>e.g. Envoy"]
    P -- "native gRPC over HTTP/2" --> S["gRPC server"]

    classDef client fill:#f1f5f9,stroke:#64748b,color:#0f172a
    classDef proxy  fill:#fef3c7,stroke:#b45309,stroke-width:2px,color:#451a03
    classDef server fill:#dbeafe,stroke:#1d4ed8,stroke-width:2px,color:#172554

    class B client
    class P proxy
    class S server
```

### Try it

```bash
brew install grpcurl

grpcurl -plaintext -import-path grpc/proto -proto library.proto \
  -d '{"id":"1"}' localhost:50051 library.LibraryService/GetBook

grpcurl -plaintext -import-path grpc/proto -proto library.proto \
  -d '{}' localhost:50051 library.LibraryService/ListBooks
```

(The server doesn't enable reflection, so grpcurl needs the `.proto` file passed in.)

### When to choose gRPC

- Service-to-service calls inside your backend
- High throughput or low latency
- Streaming data in either direction
- Teams using several programming languages

---

## Side-by-side comparison <a name="comparison"></a>

Fetching one book card (title + author name + rating):

```mermaid
sequenceDiagram
    participant C as Client
    participant R as REST
    participant G as GraphQL
    participant P as gRPC

    Note over C,R: REST — 3 round trips, every field returned
    C->>R: GET /books/1
    R-->>C: book JSON
    C->>R: GET /authors/1
    R-->>C: author JSON
    C->>R: GET /books/1/reviews
    R-->>C: reviews JSON

    Note over C,G: GraphQL — 1 round trip, only requested fields
    C->>G: POST /graphql with one query
    G-->>C: title, author.name, averageRating

    Note over C,P: gRPC — one call per RPC, compact binary messages
    C->>P: GetBook(id 1)
    P-->>C: Book message
    C->>P: GetAuthor(id 1)
    P-->>C: Author message
```

gRPC's response shape is fixed by the `.proto` file, like REST. To cut round trips you would add a purpose-built RPC (e.g. `GetBookCard`) that returns everything in one message. This project has no reviews RPC, so the rating isn't available over gRPC.

|  | REST | GraphQL | gRPC |
|---|---|---|---|
| **Endpoints** | One per resource | One (`/graphql`) | One per method |
| **Contract** | Optional (OpenAPI) | SDL schema | `.proto` file |
| **Format** | JSON | JSON | Protobuf (binary) |
| **Transport** | HTTP/1.1+ | HTTP/1.1+ | HTTP/2 |
| **Response shape** | Fixed by server | Chosen by client | Fixed by `.proto` |
| **Streaming** | No | Subscriptions | Built in |
| **Browser support** | Native | Native | Needs gRPC-Web proxy |
| **HTTP caching** | Easy | Hard | Not applicable |
| **Errors** | HTTP status codes | `errors` array in body | gRPC status codes |
| **Best for** | Public APIs, CRUD | Flexible client data needs | Internal services, streaming |
