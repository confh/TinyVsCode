# Tiny Language Support

Beautiful VS Code support for **Tiny**, a lightweight programming language with a fast Go VM, bytecode, classes, std modules, and scripting-friendly syntax.

This extension adds syntax highlighting, IntelliSense, diagnostics, formatting, hover info, go-to-definition, and more for `.tiny` files.

---

<p align="center">
  <img src="example.png" alt="Tiny Language Example" style="border-radius: 15px; object-fit: cover;" />
</p>

## Features

### Syntax Highlighting

Tiny files get clean highlighting for:

- variables and constants
- functions
- classes and fields
- enums
- imports and exports
- strings and interpolated strings
- comments
- control flow
- operators
- std modules

```tiny
import std "io";

class Counter {
    field value: number = 0;

    fn inc() {
        this.value++;
        return this.value;
    }
}

const counter = Counter();
io.println(counter.inc());
````

---

### IntelliSense / Autocomplete

The extension provides autocomplete for:

* local variables
* functions
* function parameters
* class fields
* class methods
* `this.` inside classes
* imported namespaces
* std modules
* native type methods like arrays, strings, objects, tasks, and more

Example:

```tiny
const items = [1, 2, 3];

items.
// shows: push, get, set, length, join, map, filter, clear...
```

Inside classes:

```tiny
class Validator {
    field errors: array = [];

    fn reset() {
        this.
        // shows: errors, reset, ...
    }
}
```

---

### Hover Information

Hover over symbols to see useful information:

* variable type
* function signature
* class fields and methods
* std module methods
* return types
* imported symbols

Example:

```tiny
fn greet(name: string): string {
    return "Hello " + name;
}
```

Hovering `greet` shows its signature.

---

### Diagnostics

The LSP reports common issues while editing:

* undefined variables
* undefined methods/properties
* invalid member access
* invalid imports
* parser errors
* type-related hints where possible

Example:

```tiny
const user = User();

user.missingMethod();
// warning: undefined method or property
```

Tiny is dynamic, so the LSP tries to avoid annoying false warnings for loose objects and unknown types.

---

### Formatting

Format Tiny documents directly from VS Code.

Supports formatting for:

* functions
* classes
* blocks
* if/else
* loops
* arrays and objects
* operators
* comments and strings safely

Run:

```txt
Format Document
```

or use your normal VS Code formatting shortcut.

---

### Go to Definition

Jump to definitions for:

* variables
* functions
* classes
* class methods
* class fields
* imported symbols
* namespace members

Example:

```tiny
import "models.tiny" as models;

const post = models.Post();
```

Go to definition on `Post` jumps to the exported class in `models.tiny`.

---

### Signature Help

Function and method calls show parameter help while typing:

```tiny
io.println(
```

```tiny
post.init(id, title, body, author)
```

---

### Document Symbols

The extension exposes file symbols to VS Code’s outline panel:

* functions
* classes
* fields
* methods
* enums
* variables
* imports/namespaces

This makes bigger Tiny projects easier to navigate.

---

## Supported Tiny Features

The extension understands many Tiny language features, including:

* `let` and `const`
* functions
* anonymous functions
* variadic parameters
* default parameters
* nullable parameters
* classes
* fields
* methods
* private/public members
* enums
* imports and exports
* std imports
* namespace imports
* arrays
* objects
* strings
* interpolated strings
* `if`, `else`, `else if`
* `while`
* `for`
* `for in`
* `try/catch`
* `spawn`
* `task.await`
* union type hints
* class type hints
* optional chaining

---

## Example

```tiny
import std "io";
import std "time";

enum Status { Draft, Published, Archived }

class Post {
    field title: string = "";
    field views: number = 0;
    field status = null;

    fn init(title: string) {
        this.title = title;
        this.status = Status.Draft;
    }

    fn publish() {
        this.status = Status.Published;
    }

    fn view() {
        this.views++;
    }

    fn summary() {
        return `${this.title} - ${this.views} views`;
    }
}

const post = Post("Hello Tiny");

post.publish();
post.view();

io.println(post.summary());
io.println(time.nowMs());
```

---

## File Extension

Tiny files use:

```txt
.tiny
```

---

## Requirements

You need the Tiny compiler installed and available to the extension.

If your extension starts the Tiny LSP server from a local executable, make sure the path is configured correctly.

---

## Current Status

Tiny Language Support is still evolving with the language itself.

Some features may improve over time as Tiny’s parser, VM, std library, and type system grow.

---

## Contributing

Contributions are welcome.

Good areas to help with:

* better highlighting
* more autocomplete cases
* formatter improvements
* diagnostics
* examples
* docs
* snippets
* themes/icons

---

## License

MIT
