# Mojo.js (Node.js) Strict Architecture & Style Guide

You are an expert in the @mojojs/core framework. Follow these rules strictly to maintain an idiomatic codebase.

## 1. Controller Naming & Routing

Mojo.js maps route strings to files and classes via specific transformations.

- **Filenames:** Use kebab-case without the "controller" suffix (e.g., `user.ts`, `api-auth.ts`).
- **Class Names:** Use PascalCase and MUST end with the "Controller" suffix (e.g., `UserController`, `ApiAuthController`).
- **Mapping:** A route `.to('ble-bridge#connect')` resolves to `controllers/ble-bridge.ts` and the class `BleBridgeController`.

## 2. Resource CRUD Routes (Opinionated Conventions)

For a resource named `foo` (plural: `foos`), the standard file layout is:

- **Controller:** `src/controllers/foos.ts`
- **Model:** `src/models/foos.ts`
- **Views:** `views/foos/*.html.tmpl`
- **SQL table:** `foos`

| Action           | Method   | Route            | Controller#Action | Model fn     | View               |
| ---------------- | -------- | ---------------- | ----------------- | ------------ | ------------------ |
| List all         | `GET`    | `/foos`          | `foos#index`      | `all()`      | `index.html.tmpl`  |
| Show create form | `GET`    | `/foos/create`   | `foos#create`     | —            | `create.html.tmpl` |
| Create resource  | `POST`   | `/foos`          | `foos#store`      | `add()`      | —                  |
| Show one         | `GET`    | `/foos/:id`      | `foos#show`       | `find(id)`   | `show.html.tmpl`   |
| Show edit form   | `GET`    | `/foos/:id/edit` | `foos#edit`       | `find(id)`   | `edit.html.tmpl`   |
| Update resource  | `PUT`    | `/foos/:id`      | `foos#update`     | `save(id)`   | —                  |
| Delete resource  | `DELETE` | `/foos/:id`      | `foos#remove`     | `remove(id)` | —                  |

**Route names** follow the pattern `<action>_foo`: `index_foo`, `create_foo`, `store_foo`, `show_foo`, `edit_foo`, `update_foo`, `remove_foo`. Always set names explicitly with `.name('...')` — if omitted, the router auto-generates one from the path (non-word chars → `_`), which won't match this convention.

Unlike Rails, do NOT collapse route names by HTTP verb. Every action gets its own distinct name — including `update_foo` and `remove_foo` even though they share the same URL as `show_foo`. This is intentional: mojo.js `url_for('update_foo', { id })` automatically appends `?_method=PUT`, and `url_for('remove_foo', { id })` appends `?_method=DELETE`. This makes templates clean and avoids manually constructing `_method` query strings.

**PUT/DELETE workaround:** Browsers only support `GET`/`POST` in HTML forms. For `PUT` and `DELETE`, use a `<form method="POST">` with a hidden `_method` field set to `"PUT"` or `"DELETE"`. The `url_for` helper handles this automatically when using the correct route name.

In templates, prefer `tags.formFor()` — it auto-adds `method="POST"` and the `?_method=PUT/DELETE` query param based on the route, so no manual hidden field is needed:

```
%= await tags.formFor('update_foo', {values: {id: foo.id}}, async () => { ... })
%= await tags.formFor('remove_foo', {values: {id: foo.id}}, async () => { ... })
```

## 3. Models & TypeScript Type Injection

- **Lifecycle hooks:** Use `app.onStart()` and `app.onStop()` (shorthand for `addAppHook('app:start', ...)` / `addAppHook('app:stop', ...)`) to initialize and tear down model resources. Prefer these over `server:start` — they fire for both server and CLI contexts.
- **Location:** `src/models/*.ts`.
- **Pattern:** Every model MUST be a class with domain methods. Never assign a raw `Map`, array, or plain object to `app.models.*` — wrap it in a class. The class owns its dependencies (db handle, watcher, etc.) and exposes named methods (`create`, `get`, `destroy`, …). Controllers call those methods; they never manipulate the underlying data structure directly.
- **Declaration merging:** Every model file MUST extend `MojoModels` at the bottom with its own class type.
- **Example:**
  export default class Namespaces {
  private \_map = new Map<string, Namespace>();
  async create(dir: string): Promise<Namespace> { … }
  get(token: string): Namespace | undefined { … }
  async destroy(token: string): Promise<void> { … }
  }
  declare module "@mojojs/core" {
  interface MojoModels {
  namespaces: Namespaces;
  }
  }

## 4. Helpers

- **Default:** Register helpers flat with `app.addHelper('myHelper', ...)` and extend the `MojoContext` interface for IDE autocomplete:
  ```ts
  declare module "@mojojs/core" {
    interface MojoContext {
      myHelper: (foo: string) => boolean;
    }
  }
  ```
- **Namespacing:** Introduce dot-notation namespacing (e.g., `ctx.devices.runLogic()`) only if flat helper names start to collide — typically when integrating third-party plugins or when the helper count grows large enough to risk ambiguity.
- **Built-in helpers:** `ctx.currentRoute()` returns the current route name — useful in templates for active nav state. `ctx.inspect(data)` serializes a data structure for debugging.

## 5. Error Handling (Built-in Helpers)

- **Pattern:** Use built-in context-aware helpers for errors instead of manual renders.
- **HTTP/WS Logic:** These helpers automatically delegate to the right protocol-specific handler — they render a 404/500 response for HTTP, and close the WebSocket connection for WS (code `1011` for exceptions).
- **Methods:**
  - `await ctx.notFound()`: For missing resources or invalid IDs.
  - `await ctx.exception(err)`: For catching logic errors. On WebSockets this closes the connection with code `1011` — do not call `ws.close()` manually.

## 6. WebSockets (Asynchronous Iterators)

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

## 7. Testing (TestUserAgent)

- **Requirement:** Use `TestUserAgent` from `@mojojs/core` with `node:test` and `node:assert/strict`. Do not add a `tap` dependency.
- **Setup:** Start the UA inline at the top of the test block (no `before` hook needed). Register cleanup with `t.after(() => ua.stop())` — no `await` inside the callback; `node:test` awaits the returned Promise automatically.

```js
import { app } from "../index.js";
import { test } from "node:test";
import assert from "node:assert/strict";

test("my feature", async (t) => {
  const ua = await app.newTestUserAgent();
  t.after(() => ua.stop());

  (await ua.getOk("/foo")).statusIs(200).bodyLike(/Hello/);
});
```

### HTTP verb methods

```js
await ua.deleteOk("/foos/1");
await ua.getOk("/foos", { headers: { Accept: "application/json" } });
await ua.headOk("/foos/1");
await ua.optionsOk("/foos");
await ua.patchOk("/foos/1", { json: { name: "updated" } });
await ua.postOk("/foos", { json: { name: "new" } });
await ua.putOk("/foos/1", { form: { name: "updated" } });
```

### Assertion chain

All test methods return the UA for chaining. Mix and match as needed:

```js
(await ua.getOk("/foo"))
  // status
  .statusIs(200)
  // content-type shorthand
  .typeIs("text/html")
  .typeLike(/html/)
  // headers
  .headerIs("X-Foo", "bar")
  .headerLike("Content-Type", /html/)
  .headerExists("Content-Type")
  .headerExistsNot("X-Missing")
  // body
  .bodyIs("Hello World!")
  .bodyLike(/Hello/)
  .bodyUnlike(/Bye/)
  // JSON (optional JSON pointer as second arg)
  .jsonIs({ hello: "world" })
  .jsonIs("world", "/hello")
  // HTML/CSS selectors
  .elementExists("head > title")
  .elementExistsNot("#error")
  .textLike("head > title", /Welcome/)
  .textUnlike("head > title", /Bye/);
```

### WebSocket testing

```js
await ua.websocketOk("/ws");
await ua.sendOk("hello");
assert.equal(await ua.messageOk(), "echo: hello");
await ua.closeOk(4000);
await ua.closedOk(4000);
```

## 8. Git & Commits

- **Format:** Use Conventional Commits (e.g., `feat:`, `fix:`, `docs:`, `refactor:`).
- **Detail:** List file-level changes in the commit body for better context.

## 9. Route Parameters & Guards (`under`)

- **Stash:** Route parameters (`:param`) are placed in `ctx.stash` automatically by the router. A route defined as `/ns/:token/devices` arrives at the controller with `ctx.stash['token']` already set — no manual extraction from the URL needed. Regex constraints (e.g. `{ token: /[0-9a-f-]{36}/ }`) are enforced by the router before the action runs.
- **Placeholder types:** Use the built-in `num` type for numeric IDs — rejects non-numeric values before the controller runs: `app.get('/foos/<id:num>').to('foos#show').name('show_foo')`. Custom types can be added with `app.router.addType('name', /regex/)`.
- **Introspection:** Run `node index.js routes -v` to list all routes with their names and compiled regexes. Essential for debugging routing issues.
- **`under` pattern:** `app.under('/prefix/:param').to('resource#load')` — always point to a named controller action, never use an inline closure.
- **Action signature:** The `load` action returns `Promise<boolean>`. Return `false` (after calling `await ctx.notFound()` or similar) to halt the chain; return `true` to continue to the child route.
- **Stash handoff:** Use `load` to resolve the route param into a model object and store it in `ctx.stash`. Child actions read the resolved object directly — they never re-query the model.
- **Example:**
  // index.ts
  app.under('/ns/:token').to('namespaces#load');
  // namespaces.ts
  async load(ctx): Promise<boolean> {
  const ns = ctx.models.namespaces.get(String(ctx.stash['token']));
  if (!ns) { await ctx.notFound(); return false; }
  ctx.stash['ns'] = ns; // resolved object available to all child actions
  return true;
  }
  async destroy(ctx): Promise<void> {
  const ns = ctx.stash['ns'] as Namespace; // already validated — no re-lookup
  …
  }

## 10. URL Generation

Use `ctx.urlFor()` to generate URLs by route name anywhere in controllers or templates. Never hardcode URL strings.

```js
ctx.urlFor("index_foo"); // → /foos
ctx.urlFor("show_foo", { values: { id: 1 } }); // → /foos/1
ctx.urlFor("update_foo", { values: { id: 1 } }); // → /foos/1?_method=PUT
ctx.urlWith("index_foo"); // same as urlFor but preserves current query params

await ctx.redirectTo("index_foo");
await ctx.redirectTo("https://example.com");
```

In templates, `tags.linkTo()` wraps `urlFor`:

```
%= await tags.linkTo('show_foo', {values: {id: foo.id}}, {}, 'View')
```

## 11. Rendering

Use `ctx.render()` in all controller actions. Never write to `ctx.res` directly at the controller level.

```js
// No args — auto-detects view from controller/action: views/foos/show.html.tmpl
await ctx.render();

// Explicit view
await ctx.render({ view: "foos/show" });

// Pass stash values as second arg — available as variables in the template
await ctx.render({ view: "foos/show" }, { foo, title: "Detail" });

// JSON, text, status
await ctx.render({ json: { hello: "world" } });
await ctx.render({ text: "Hello World!" });
await ctx.render({ text: "Oops.", status: 500 });

// Inline template (rare — prefer view files)
await ctx.render({ inline: "Hello <%= name %>" }, { name: "Mojo" });

// Render to string without sending (e.g. for emails)
const html = await ctx.renderToString({ view: "foos/show" });
```

### Template syntax (`tmpl` engine)

| Tag              | Behaviour                                  |
| ---------------- | ------------------------------------------ |
| `<% code %>`     | Execute JS — not rendered                  |
| `<%= expr %>`    | Render, XML-escaped (safe)                 |
| `<%== expr %>`   | Render, unescaped (raw HTML)               |
| `% code`         | Code line — completely invisible in output |
| `<%# comment %>` | Comment                                    |
| `<% ... =%>`     | Trailing `=` trims surrounding whitespace  |

Stash values are automatically available as template variables. The context is always available as `ctx`.

```
Hello <%= name %> from <%= ctx.req.ip %>.
% for (const item of items) {
  <li><%= item.title %></li>
% }
```

### Layouts

Set the layout inside the template or pass it to `ctx.render()`. The layout file lives in `views/layouts/`.

```
%# views/foos/show.html.tmpl
% view.layout = 'default';
<h1><%= foo.name %></h1>
```

```
%# views/layouts/default.html.tmpl
<!DOCTYPE html>
<html>
  <head><title><%= title ?? 'App' %></title></head>
  <body><%== ctx.content.main %></body>
</html>
```

Or pass layout explicitly: `await ctx.render({ view: 'foos/show' }, { layout: 'default' })`.

### Partial views

Name partial templates with a leading underscore. Include them with `ctx.include()`:

```
%# views/foos/index.html.tmpl
%= await ctx.include({ view: '_navbar' }, { active: 'foos' })
```

Partials live alongside regular views and can receive their own stash values.

### Content slots

Use `ctx.contentFor()` to inject content from a template into named slots in the layout:

```
%# views/foos/show.html.tmpl
<{headBlock}>
  <meta name="description" content="Foo detail">
<{/headBlock}>
% await ctx.contentFor('head', headBlock);
```

```
%# views/layouts/default.html.tmpl
<head><%== ctx.content.head %></head>
<body><%== ctx.content.main %></body>
```

### Static files & assets

The `public/` directory is served automatically. Use framework helpers for URLs — never hardcode paths:

```js
ctx.urlForFile("css/app.css"); // → /static/css/app.css
ctx.urlForAsset("app.js"); // → /static/assets/app.ab1234cd.js  (resolves checksum)
await ctx.tags.asset("app.js"); // → <script src="/static/assets/app.ab1234cd.js"></script>
await ctx.tags.style("app.css"); // → <link rel="stylesheet" href="...">
```

Asset files must follow the `[name].[checksum].[ext]` naming scheme (generated by your bundler). During development, `[name].development.[ext]` files take precedence and bypass caching.

## 12. Prohibited Patterns

- NO PascalCase filenames for controllers.
- NO Express-style `res.send()` / `res.json()` at the controller level — use `ctx.render()`. (`ctx.res.send()` is the low-level mojo primitive and is legitimate only in framework-level code.)
- NO `req.body` (use `await ctx.params()` for form data, `await ctx.req.json()` for JSON bodies).
- NO inline closures in `app.under()` (use `.to('controller#action')`).
- NO hardcoded URL strings — always use `ctx.urlFor('route_name')`.
