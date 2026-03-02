# Mojo.js (Node.js) Strict Architecture & Style Guide

You are an expert in the @mojojs/core framework. Follow these rules strictly to maintain an idiomatic codebase.

## 1. Controller Naming & Routing

Mojo.js maps route strings to files and classes via specific transformations.

- **Filenames:** Use kebab-case without the "controller" suffix (e.g., `user.ts`, `api-auth.ts`).
- **Class Names:** Use PascalCase and MUST end with the "Controller" suffix (e.g., `UserController`, `ApiAuthController`).
- **Mapping:** A route `.to('ble-bridge#connect')` resolves to `controllers/ble-bridge.ts` and the class `BleBridgeController`.

## 2. Models & TypeScript Type Injection

- **Location:** `src/models/*.ts`.
- **Pattern:** Every model MUST use declaration merging to extend the `MojoModels` interface.
- **Example:**
  export class Store { ... }
  declare module "@mojojs/core" {
  interface MojoModels {
  store: Store;
  }
  }

## 3. Helpers

- **Default:** Register helpers flat with `app.addHelper('myHelper', ...)` and type them in the `MojoHelpers` interface.
- **Namespacing:** Introduce dot-notation namespacing (e.g., `ctx.devices.runLogic()`) only if flat helper names start to collide — typically when integrating third-party plugins or when the helper count grows large enough to risk ambiguity.

## 4. Error Handling (Built-in Helpers)

- **Pattern:** Use built-in context-aware helpers for errors instead of manual renders.
- **HTTP/WS Logic:** These helpers automatically handle the protocol (e.g., rendering 404 for HTTP or closing the socket for WS).
- **Methods:**
  - `await ctx.notFound()`: For missing resources or invalid IDs.
  - `await ctx.exception(err)`: For catching logic errors.

## 5. WebSockets (Asynchronous Iterators)

- **Logic:** Do NOT use event emitters (`.on('message')`).
- **Pattern:** Use `ctx.json(async ws => { for await (const message of ws) { ... } })`.
- **Example:**
  app.websocket('/echo', async ctx => {
  ctx.json(async ws => {
  for await (const message of ws) {
  ws.send({ echo: message });
  }
  });
  });

## 6. Testing (TestUserAgent)

- **Requirement:** Use built-in Mojo testing tools only.
- **WS Methods:** Use `websocketOk()`, `sendOk()`, `messageOk()`, and `finishedOk()`.

## 7. Git & Commits

- **Format:** Use Conventional Commits (e.g., `feat:`, `fix:`, `docs:`, `refactor:`).
- **Detail:** List file-level changes in the commit body for better context.

## 8. Prohibited Patterns

- NO PascalCase filenames for controllers.
- NO `res.send()` or `res.json()` (Use `ctx.render()`).
- NO `req.body` (Use `await ctx.params()`).
