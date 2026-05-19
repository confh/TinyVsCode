import * as vscode from "vscode";
import * as path from "path";

const ParserModule = require("web-tree-sitter");

let parser: any | undefined;
let tinyLanguage: any | undefined;
let diagnostics: vscode.DiagnosticCollection;

type TinyMethodInfo = {
    name: string;
    detail: string;
    documentation: string;
    snippet: string;
    returnType: string;
};

type TinyStdImport = {
    moduleName: string;
    alias: string;
};

type TinyFileImport = {
    path: string;
    alias: string;
    uri: vscode.Uri;
    text: string;
    tree: any;
};

type ClassSearchResult = {
    node: any;
    text: string;
};

const stdModules: Record<string, Record<string, TinyMethodInfo>> = {
    error: {
        new: {
            name: "new",
            returnType: "error",
            detail: "error.new(kind, message): error",
            documentation: "Creates a new error object with the specified kind and message.",
            snippet: "new(${1:kind}, ${2:message});"
        },
    },
    time: {
        sleep: {
            name: "sleep",
            returnType: "undefined",
            detail: "time.sleep(ms): undefined",
            documentation: "Pauses execution for the specified number of milliseconds.",
            snippet: "sleep(${1:ms});"
        },
        nowMs: {
            name: "nowMs",
            returnType: "number",
            detail: "time.nowMs(): number",
            documentation: "Returns the current time in milliseconds since the Unix epoch.",
            snippet: "nowMs();"
        },
        nowSec: {
            name: "nowSec",
            returnType: "number",
            detail: "time.nowSec(): number",
            documentation: "Returns the current time in seconds since the Unix epoch.",
            snippet: "nowSec();"
        },
        clock: {
            name: "clock",
            returnType: "number",
            detail: "time.clock(): number",
            documentation: "Returns the time in milliseconds since the VM started.",
            snippet: "clock();"
        }
    },
    io: {
        print: {
            name: "print",
            detail: "io.print(...values): bool",
            documentation: "Prints values without adding a newline.",
            snippet: "print(${1:values});",
            returnType: "bool"
        },
        println: {
            name: "println",
            detail: "io.println(...values): bool",
            documentation: "Prints values and adds a newline.",
            snippet: "println(${1:values});",
            returnType: "bool"
        },
        input: {
            name: "input",
            detail: "io.input(prompt): string",
            documentation: "Reads user input.",
            snippet: "input(${1:prompt});",
            returnType: "string"
        }
    },
    array: {
        range: {
            name: "range",
            returnType: "number",
            detail: "array.range(min, max)",
            documentation: "Returns an array with numbers from min to max.",
            snippet: "range(${1:min}, ${2:max});"
        },
        isArray: {
            name: "isArray",
            returnType: "bool",
            detail: "array.isArray(var)",
            documentation: "Returns whether the given variable is an array or not.",
            snippet: "isArray(${1:var});"
        },
        from: {
            name: "from",
            returnType: "array",
            detail: "array.from(source)",
            documentation: "Returns an array from a buffer or a string.",
            snippet: "from(${1:source});"
        },
    },
    math: {
        toFloat: {
            name: "toFloat",
            returnType: "float",
            detail: "math.toFloat(number)",
            documentation: "Returns the given number as a float.",
            snippet: "toFloat(${1:number});"
        },
        toInt: {
            name: "toInt",
            returnType: "int",
            detail: "math.toInt(number)",
            documentation: "Returns the given number as a integer.",
            snippet: "toInt(${1:number});"
        },
    },
    json: {
        stringify: {
            name: "stringify",
            returnType: "string",
            detail: "json.stringify(object)",
            documentation: "Turns the given object into a string and returns it.",
            snippet: "stringify(${1:object});"
        },
        pretty: {
            name: "pretty",
            returnType: "string",
            detail: "json.pretty(object)",
            documentation: "Turns the given object into a pretty string and returns it.",
            snippet: "pretty(${1:object});"
        },
        parse: {
            name: "parse",
            returnType: "object",
            detail: "json.parse(string)",
            documentation: "Parses the given string into a JSON object.",
            snippet: "parse(${1:string});"
        },
    },
    regex: {
        matchString: {
            name: "matchString",
            returnType: "bool",
            detail: "regex.matchString(string, regex)",
            documentation: "Returns true if the string matches the given regex pattern, otherwise false.",
            snippet: "matchString(${1:string}, ${2:regex});"
        },
        findString: {
            name: "findString",
            returnType: "string",
            detail: "regex.findString(string, regex)",
            documentation: "Finds and returns the first substring of the string that matches the given regex pattern.",
            snippet: "findString(${1:string}, ${2:regex});"
        },
    },
    fs: {
        open: {
            name: "open",
            returnType: "file",
            detail: "fs.open(path)",
            documentation: "Opens the specified file and returns a file object for further reading or writing.",
            snippet: "open(${1:path});"
        },
        readFile: {
            name: "readFile",
            returnType: "string",
            detail: "fs.readFile(path)",
            documentation: "Reads the contents of the specified file and returns it as a string.",
            snippet: "readFile(${1:path});"
        },
        writeFile: {
            name: "writeFile",
            returnType: "bool",
            detail: "fs.writeFile(path, data)",
            documentation: "Writes the given data as a string to the specified file. Returns true if successful.",
            snippet: "writeFile(${1:path}, ${2:data});"
        },
        writeBytes: {
            name: "writeBytes",
            returnType: "bool",
            detail: "fs.writeBytes(path, buffer)",
            documentation: "Writes the given buffer (bytes) to the specified file. Returns true if successful.",
            snippet: "writeBytes(${1:path}, ${2:buffer});"
        },
        exists: {
            name: "exists",
            returnType: "bool",
            detail: "fs.exists(path)",
            documentation: "Checks if a file or directory exists at the specified path. Returns true if it exists, otherwise false.",
            snippet: "exists(${1:path});"
        },
        readDir: {
            name: "readDir",
            returnType: "array",
            detail: "fs.readDir(path)",
            documentation: "Reads the contents of the specified directory and returns a list of file and directory names.",
            snippet: "readDir(${1:path});"
        }
    },
    process: {
        args: {
            name: "args",
            returnType: "array",
            detail: "process.args(): array",
            documentation: "Returns an array of command-line arguments passed to the process.",
            snippet: "args();"
        },
        exit: {
            name: "exit",
            returnType: "never",
            detail: "process.exit(code): never",
            documentation: "Exits the program with the given status code.",
            snippet: "exit(${1:code});"
        },
        close: {
            name: "close",
            returnType: "undefined",
            detail: "process.close(): undefined",
            documentation: "Terminates the program immediately with exit code 0.",
            snippet: "close();"
        },
        cwd: {
            name: "cwd",
            returnType: "string",
            detail: "process.cwd(): string",
            documentation: "Returns the current working directory.",
            snippet: "cwd();"
        },
        getEnv: {
            name: "getEnv",
            returnType: "string",
            detail: "process.getEnv(key): string",
            documentation: "Gets the value of the environment variable for the given key.",
            snippet: "getEnv(${1:key});"
        },
        setEnv: {
            name: "setEnv",
            returnType: "undefined",
            detail: "process.setEnv(key, value): undefined",
            documentation: "Sets an environment variable with the specified key and value.",
            snippet: "setEnv(${1:key}, ${2:value});"
        },
        unsetEnv: {
            name: "unsetEnv",
            returnType: "undefined",
            detail: "process.unsetEnv(key): undefined",
            documentation: "Removes the specified environment variable.",
            snippet: "unsetEnv(${1:key});"
        },
        halt: {
            name: "halt",
            returnType: "undefined",
            detail: "process.halt(): undefined",
            documentation: "Prints a prompt and waits for the user to press Enter before continuing.",
            snippet: "halt();"
        },
        run: {
            name: "run",
            returnType: "object",
            detail: "process.run(command, args?, options?): object",
            documentation: `Runs a command synchronously and returns an object with {exitCode, stdout, stderr, success}.`,
            snippet: "run(${1:command}, ${2:args}, ${3:options});"
        },
        shell: {
            name: "shell",
            returnType: "object",
            detail: "process.shell(command, options?): object",
            documentation: `Execute a shell command using the system shell, returning an object with {exitCode, stdout, stderr, success}.`,
            snippet: "shell(${1:command}, ${2:options});"
        },
        start: {
            name: "start",
            returnType: "process",
            detail: "process.start(command, args?, options?): process",
            documentation: `Starts a process asynchronously and returns a process object.`,
            snippet: "start(${1:command}, ${2:args}, ${3:options});"
        },
    },
    buffer: {
        fromString: {
            name: "fromString",
            returnType: "buffer",
            detail: "buffer.fromString(string)",
            documentation: "Creates a buffer from the provided string.",
            snippet: "fromString(${1:string});"
        },
        fromArray: {
            name: "fromArray",
            returnType: "buffer",
            detail: "buffer.fromArray(array)",
            documentation: "Creates a buffer from the given array of numbers (bytes).",
            snippet: "fromArray(${1:array});"
        },
    },
    http: {
        server: {
            name: "server",
            returnType: "server",
            detail: "http.server(port): server",
            documentation: "Creates server object.",
            snippet: "server(${1:port});"
        },
        get: {
            name: "get",
            returnType: "object",
            detail: "http.get(url, extra?): object",
            documentation: "Sends an HTTP GET request to the specified URL. Returns an object containing the response status, headers, and body. The optional 'extra' parameter can be used to provide additional request options such as headers.",
            snippet: "get(${1:url}, ${2:extra?});"
        },
        post: {
            name: "post",
            returnType: "object",
            detail: "http.post(url, extra?): object",
            documentation: "Sends an HTTP POST request to the specified URL. Returns an object containing the response status, headers, and body. The optional 'extra' parameter can be used to provide additional request options such as headers.",
            snippet: "post(${1:url}, ${2:extra?});"
        },
    }
};

const builtInTypeMethods: Record<string, Record<string, TinyMethodInfo>> = {
    process: {
        pid: {
            name: "pid",
            detail: "process.pid(): number",
            documentation: "Returns the Process ID of the current process.",
            snippet: "pid();",
            returnType: "number"
        },
        wait: {
            name: "wait",
            detail: "process.wait(): undefined",
            documentation: "Waits for the process to exit. Returns undefined.",
            snippet: "wait();",
            returnType: "undefined"
        },
        kill: {
            name: "kill",
            detail: "process.kill(): undefined",
            documentation: "Terminates the process. Returns undefined.",
            snippet: "kill();",
            returnType: "undefined"
        },
        killTree: {
            name: "killTree",
            detail: "process.killTree(): undefined",
            documentation: "Terminates the process and its children. Returns undefined.",
            snippet: "killTree();",
            returnType: "undefined"
        },
        interrupt: {
            name: "interrupt",
            detail: "process.interrupt(): undefined",
            documentation: "Sends an interrupt signal to the process (SIGINT or equivalent). Returns undefined.",
            snippet: "interrupt();",
            returnType: "undefined"
        },
        isRunning: {
            name: "isRunning",
            detail: "process.isRunning(): boolean",
            documentation: "Checks if the process is currently running.",
            snippet: "isRunning();",
            returnType: "boolean"
        },
        signal: {
            name: "signal",
            detail: "process.signal(signal: string): undefined",
            documentation: "Sends a signal (e.g. 'interrupt', 'kill') to the process. Only supported on Linux. Returns undefined.",
            snippet: "signal(${1:signal});",
            returnType: "undefined"
        }

    },
    string: {
        length: {
            name: "length",
            returnType: "number",
            detail: "string.length(): number",
            documentation: "Returns the length of the string.",
            snippet: "length();"
        },
        toUpperCase: {
            name: "toUpperCase",
            returnType: "string",
            detail: "string.toUpperCase(): string",
            documentation: "Returns the uppercase version of the string.",
            snippet: "toUpperCase();"
        },
        toLowerCase: {
            name: "toLowerCase",
            returnType: "string",
            detail: "string.toLowerCase(): string",
            documentation: "Returns the lowercase version of the string.",
            snippet: "toLowerCase();"
        },
        split: {
            name: "split",
            returnType: "array",
            detail: "string.split(separator): array",
            documentation: "Splits the string into substrings using the specified separator and return them as an array.",
            snippet: "split(${1:separator});"
        },
    },
    server: {
        get: {
            name: "get",
            returnType: "server",
            detail: "server.get(path, handler): server",
            documentation: "Registers a GET route. The handler can be a function or static response.",
            snippet: "get(${1:path}, ${2:handler});"
        },
        post: {
            name: "post",
            returnType: "server",
            detail: "server.post(path, handler): server",
            documentation: "Registers a POST route. The handler can be a function or static response.",
            snippet: "post(${1:path}, ${2:handler});"
        },
        start: {
            name: "start",
            returnType: "undefined",
            detail: "server.start(async?): undefined",
            documentation: "Starts the HTTP server.",
            snippet: "start();"
        }
    },
    array: {
        length: {
            name: "length",
            returnType: "number",
            detail: "array.length(): number",
            documentation: "Returns the length of the array.",
            snippet: "length();"
        },
        push: {
            name: "push",
            returnType: "array",
            detail: "array.push(element): array",
            documentation: "Appends an element to the array.",
            snippet: "push(${1:element});"
        },
        pop: {
            name: "pop",
            returnType: "any",
            detail: "array.pop(): any",
            documentation: "Removes the last element from the array and returns it.",
            snippet: "pop();"
        },
        get: {
            name: "get",
            returnType: "any",
            detail: "array.get(index): any",
            documentation: "Returns an element from the array with the given index.",
            snippet: "get(${1:index});"
        },
        set: {
            name: "set",
            returnType: "array",
            detail: "array.set(index, element): array",
            documentation: "Sets the given index of the array to the given element.",
            snippet: "set(${1:index}, ${2:element});"
        },
        contains: {
            name: "contains",
            returnType: "bool",
            detail: "array.contains(element): bool",
            documentation: "Returns whether or not the array contains the given element.",
            snippet: "contains(${1:element});"
        },
        join: {
            name: "join",
            returnType: "string",
            detail: "array.join(separator): string",
            documentation: "Concatenate the array with the given separator.",
            snippet: "join(${1:separator});"
        },
        reverse: {
            name: "reverse",
            returnType: "array",
            detail: "array.reverse(): array",
            documentation: "Reverses the array.",
            snippet: "reverse();"
        },
        map: {
            name: "map",
            returnType: "array",
            detail: "array.map(callback): array",
            documentation: "Calls the given callback function on each element of the array and returns an array that contains the results.",
            snippet: "map(${1:callback});"
        },
        forEach: {
            name: "forEach",
            returnType: "bool",
            detail: "array.forEach(callback): bool",
            documentation: "Performs the specified action for each element in the given array.",
            snippet: "forEach(${1:callback});"
        },
        filter: {
            name: "filter",
            returnType: "array",
            detail: "array.filter(callback): array",
            documentation: "Returns the elements of the given array that meet the condition specified in a callback function.",
            snippet: "filter(${1:callback});"
        },
        clear: {
            name: "clear",
            returnType: "bool",
            detail: "array.clear(callback): bool",
            documentation: "Clears the array.",
            snippet: "clear();"
        },
    },
    task: {
        await: {
            name: "await",
            detail: "task.await(): T",
            documentation: "Waits for the spawned task to finish and returns the function result.",
            snippet: "await()",
            returnType: "any"
        }
    },
    file: {
        read: {
            name: "read",
            returnType: "string",
            detail: "file.read(size): string",
            documentation: "Reads up to 'size' bytes from the file and returns them as a string.",
            snippet: "read(${1:size});"
        },
        close: {
            name: "close",
            returnType: "bool",
            detail: "file.close(): bool",
            documentation: "Closes the file. Returns true if the file was closed successfully.",
            snippet: "close();"
        },
    },
    buffer: {
        toHex: {
            name: "toHex",
            returnType: "string",
            detail: "buffer.toHex(): string",
            documentation: "Returns a hexadecimal string representation of the buffer.",
            snippet: "toHex();"
        },
        length: {
            name: "length",
            returnType: "number",
            detail: "buffer.length(): number",
            documentation: "Returns the length (number of bytes) of the buffer.",
            snippet: "length();"
        },
        getU8: {
            name: "getU8",
            returnType: "number",
            detail: "buffer.getU8(offset): number",
            documentation: "Reads an unsigned 8-bit integer at the given offset from the buffer.",
            snippet: "getU8(${1:offset});"
        },
        setU8: {
            name: "setU8",
            returnType: "bool",
            detail: "buffer.setU8(offset, byte): bool",
            documentation: "Writes an unsigned 8-bit integer at the given offset in the buffer. Returns true if successful.",
            snippet: "setU8(${1:offset}, ${s:byte});"
        },
    },
};

const globalMethods: Record<string, TinyMethodInfo> = {
    tostring: {
        name: "toString",
        detail: "toString(): string",
        documentation: "Converts the value to a string.",
        snippet: "toString();",
        returnType: "string"
    }
};

const tokenTypes = [
    "class",
    "function",
    "method",
    "variable",
    "property",
    "type",
    "enum",
    "enumMember"
];

const tokenModifiers: string[] = [];

const semanticLegend = new vscode.SemanticTokensLegend(
    tokenTypes,
    tokenModifiers
);

export async function activate(context: vscode.ExtensionContext) {
    diagnostics = vscode.languages.createDiagnosticCollection("tiny");
    context.subscriptions.push(diagnostics);

    await initTreeSitter(context);

    registerTinyFormatter(context);
    registerTinySemanticTokens(context);
    registerTinyCompletions(context);
    registerTinyHoverProvider(context);

    const showTreeCommand = vscode.commands.registerCommand(
        "tinyTreeSitter.showSyntaxTree",
        () => {
            const editor = vscode.window.activeTextEditor;

            if (!editor) {
                vscode.window.showErrorMessage("No active editor.");
                return;
            }

            showSyntaxTree(editor.document);
        }
    );

    context.subscriptions.push(showTreeCommand);

    vscode.workspace.onDidOpenTextDocument(
        document => validateTinyDocument(document),
        null,
        context.subscriptions
    );

    vscode.workspace.onDidChangeTextDocument(
        event => validateTinyDocument(event.document),
        null,
        context.subscriptions
    );

    vscode.workspace.onDidCloseTextDocument(
        document => diagnostics.delete(document.uri),
        null,
        context.subscriptions
    );

    for (const document of vscode.workspace.textDocuments) {
        validateTinyDocument(document);
    }
}

async function initTreeSitter(context: vscode.ExtensionContext) {
    const Parser = ParserModule.Parser ?? ParserModule;
    const Language = ParserModule.Language ?? Parser.Language;

    await Parser.init();

    const wasmPath = context.asAbsolutePath(
        path.join("parsers", "tree-sitter-tiny.wasm")
    );

    tinyLanguage = await Language.load(wasmPath);

    parser = new Parser();
    parser.setLanguage(tinyLanguage);
}

function showSyntaxTree(document: vscode.TextDocument) {
    if (!parser) {
        vscode.window.showErrorMessage("Tree-sitter parser not initialized.");
        return;
    }

    if (document.languageId !== "tiny") {
        vscode.window.showErrorMessage("Open a .tiny file first.");
        return;
    }

    const tree = parser.parse(document.getText());

    const output = vscode.window.createOutputChannel("Tiny Tree-sitter");
    output.clear();
    output.appendLine(tree.rootNode.toString());
    output.show();
}

async function validateTinyDocument(document: vscode.TextDocument) {
    if (!parser || document.languageId !== "tiny") {
        return;
    }

    const tree = parser.parse(document.getText());
    const foundDiagnostics: vscode.Diagnostic[] = [];

    collectTreeSitterErrors(tree.rootNode, foundDiagnostics);
    checkRedeclaredVariables(document, foundDiagnostics);
    await checkImportDiagnostics(document, foundDiagnostics);
    await checkImportedMemberAccess(document, foundDiagnostics);
    checkParameterDiagnostics(document, foundDiagnostics);

    diagnostics.set(document.uri, foundDiagnostics);
}

function checkParameterDiagnostics(
    document: vscode.TextDocument,
    foundDiagnostics: vscode.Diagnostic[]
) {
    const tree = parser.parse(document.getText());

    walkTree(tree.rootNode, node => {
        if (node.type !== "parameter_list") {
            return;
        }

        let sawDefault = false;

        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);

            if (!child || child.type !== "parameter") {
                continue;
            }

            const defaultNode = child.childForFieldName?.("default");
            const nameNode = child.childForFieldName?.("name");

            if (defaultNode) {
                sawDefault = true;
                continue;
            }

            if (sawDefault && nameNode) {
                foundDiagnostics.push(new vscode.Diagnostic(
                    rangeFromNode(nameNode),
                    `Required parameter '${nodeText(document, nameNode)}' cannot come after a default parameter.`,
                    vscode.DiagnosticSeverity.Error
                ));
            }
        }
    });
}

function collectTreeSitterErrors(
    node: any,
    foundDiagnostics: vscode.Diagnostic[]
) {
    if (node.type === "ERROR" || node.isMissing) {
        const start = new vscode.Position(
            node.startPosition.row,
            node.startPosition.column
        );

        const end = new vscode.Position(
            node.endPosition.row,
            Math.max(node.endPosition.column, node.startPosition.column + 1)
        );

        foundDiagnostics.push(new vscode.Diagnostic(
            new vscode.Range(start, end),
            node.isMissing ? `Missing syntax: ${node.type}` : "Tiny syntax error.",
            vscode.DiagnosticSeverity.Error
        ));
    }

    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);

        if (child) {
            collectTreeSitterErrors(child, foundDiagnostics);
        }
    }
}

async function checkImportedMemberAccess(
    document: vscode.TextDocument,
    foundDiagnostics: vscode.Diagnostic[]
) {
    const imports = await getFileImportsFromTree(document);
    const aliasMap = new Map<string, TinyFileImport>();

    for (const imported of imports) {
        aliasMap.set(imported.alias, imported);
    }

    if (aliasMap.size === 0) {
        return;
    }

    const tree = parser.parse(document.getText());

    walkTree(tree.rootNode, node => {
        if (node.type !== "member_expression") {
            return;
        }

        const object = node.childForFieldName?.("object");
        const property = node.childForFieldName?.("property");

        if (!object || !property || object.type !== "identifier") {
            return;
        }

        const alias = nodeText(document, object);
        const memberName = nodeText(document, property);
        const imported = aliasMap.get(alias);

        if (!imported) {
            return;
        }

        if (isExportedMember(imported, memberName)) {
            return;
        }

        const range = rangeFromNode(property);

        foundDiagnostics.push(new vscode.Diagnostic(
            range,
            `Module '${alias}' has no exported member '${memberName}'.`,
            vscode.DiagnosticSeverity.Error
        ));
    });
}

function registerTinyFormatter(context: vscode.ExtensionContext) {
    const provider = vscode.languages.registerDocumentFormattingEditProvider(
        "tiny",
        {
            provideDocumentFormattingEdits(document) {
                const originalText = document.getText();
                const formattedText = formatTinyCode(originalText);

                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(originalText.length)
                );

                return [
                    vscode.TextEdit.replace(fullRange, formattedText)
                ];
            }
        }
    );

    context.subscriptions.push(provider);
}

function formatTinyCode(source: string): string {
    const lines = source.replace(/\r\n/g, "\n").split("\n");

    let indentLevel = 0;
    const formattedLines: string[] = [];

    for (const rawLine of lines) {
        const trimmed = rawLine.trim();

        if (trimmed.length === 0) {
            formattedLines.push("");
            continue;
        }

        if (startsWithClosingBrace(trimmed)) {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        const formattedLine = formatTinyLine(trimmed);
        formattedLines.push(`${"    ".repeat(indentLevel)}${formattedLine}`);

        indentLevel += countOpeningBracesOutsideStrings(trimmed);
        indentLevel -= countClosingBracesOutsideStrings(trimmed);

        if (startsWithClosingBrace(trimmed)) {
            indentLevel += 1;
        }

        indentLevel = Math.max(0, indentLevel);
    }

    return formattedLines.join("\n").trimEnd() + "\n";
}

function startsWithClosingBrace(line: string): boolean {
    return line.startsWith("}") || line.startsWith("];") || line.startsWith(")");
}

function formatTinyLine(line: string): string {
    const { code, comment } = splitCodeAndComment(line);

    const formattedCode = formatCodeOutsideStrings(code);

    if (comment) {
        if (formattedCode.trim().length === 0) {
            return comment.trimEnd();
        }

        return `${formattedCode.trimEnd()} ${comment.trimEnd()}`;
    }

    return formattedCode.trim();
}

function splitCodeAndComment(line: string): { code: string; comment: string } {
    let inDoubleString = false;
    let inBacktickString = false;
    let escaped = false;

    for (let i = 0; i < line.length - 1; i++) {
        const char = line[i];
        const next = line[i + 1];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === "\\") {
            escaped = true;
            continue;
        }

        if (char === "\"" && !inBacktickString) {
            inDoubleString = !inDoubleString;
            continue;
        }

        if (char === "`" && !inDoubleString) {
            inBacktickString = !inBacktickString;
            continue;
        }

        if (!inDoubleString && !inBacktickString && char === "/" && next === "/") {
            return {
                code: line.slice(0, i),
                comment: line.slice(i)
            };
        }
    }

    return {
        code: line,
        comment: ""
    };
}

function formatCodeOutsideStrings(code: string): string {
    const parts = splitStringParts(code);

    return parts
        .map(part => {
            if (part.isString) {
                return part.text;
            }

            return formatCodeOnlyPart(part.text);
        })
        .join("");
}

function splitStringParts(code: string): Array<{ text: string; isString: boolean }> {
    const parts: Array<{ text: string; isString: boolean }> = [];

    let current = "";
    let inDoubleString = false;
    let inBacktickString = false;
    let escaped = false;

    for (let i = 0; i < code.length; i++) {
        const char = code[i];

        current += char;

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === "\\") {
            escaped = true;
            continue;
        }

        if (char === "\"" && !inBacktickString) {
            if (!inDoubleString) {
                const beforeString = current.slice(0, -1);

                if (beforeString.length > 0) {
                    parts.push({
                        text: beforeString,
                        isString: false
                    });
                }

                current = "\"";
                inDoubleString = true;
            } else {
                parts.push({
                    text: current,
                    isString: true
                });

                current = "";
                inDoubleString = false;
            }

            continue;
        }

        if (char === "`" && !inDoubleString) {
            if (!inBacktickString) {
                const beforeString = current.slice(0, -1);

                if (beforeString.length > 0) {
                    parts.push({
                        text: beforeString,
                        isString: false
                    });
                }

                current = "`";
                inBacktickString = true;
            } else {
                parts.push({
                    text: current,
                    isString: true
                });

                current = "";
                inBacktickString = false;
            }

            continue;
        }
    }

    if (current.length > 0) {
        parts.push({
            text: current,
            isString: inDoubleString || inBacktickString
        });
    }

    return parts;
}

function formatCodeOnlyPart(code: string): string {
    return code
        .replace(/\s+/g, " ")

        // multi-character operators first
        .replace(/\s*(==|!=|<=|>=|\+=|-=|\*=|\/=)\s*/g, " $1 ")

        // assignment
        .replace(/\s*=\s*/g, " = ")

        // arithmetic/comparison
        .replace(/\s*([+\-*/%<>])\s*/g, " $1 ")

        // commas and colons
        .replace(/\s*,\s*/g, ", ")
        .replace(/\s*:\s*/g, ": ")

        // semicolon
        .replace(/\s*;\s*$/g, ";")

        // dots should never have spaces
        .replace(/\s*\.\s*/g, ".")

        // remove spaces inside parens/brackets
        .replace(/\(\s+/g, "(")
        .replace(/\s+\)/g, ")")
        .replace(/\[\s+/g, "[")
        .replace(/\s+\]/g, "]")

        // function calls
        .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s+\(/g, "$1(")

        // block opening
        .replace(/\s*\{\s*$/g, " {")
        .replace(/^else\s+\{/g, "else {")
        .replace(/^try\s+\{/g, "try {")
        .replace(/^finally\s+\{/g, "finally {")
        .replace(/^catch\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+\{/g, "catch $1 {");
}

function countOpeningBracesOutsideStrings(line: string): number {
    let count = 0;
    let inString = false;
    let inBacktick = false;
    let escaped = false;

    for (const char of line) {
        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === "\\") {
            escaped = true;
            continue;
        }

        if (char === "\"" && !inBacktick) {
            inString = !inString;
            continue;
        }

        if (char === "`" && !inString) {
            inBacktick = !inBacktick;
            continue;
        }

        if (!inString && !inBacktick && char === "{") {
            count++;
        }
    }

    return count;
}

function countClosingBracesOutsideStrings(line: string): number {
    let count = 0;
    let inString = false;
    let inBacktick = false;
    let escaped = false;

    for (const char of line) {
        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === "\\") {
            escaped = true;
            continue;
        }

        if (char === "\"" && !inBacktick) {
            inString = !inString;
            continue;
        }

        if (char === "`" && !inString) {
            inBacktick = !inBacktick;
            continue;
        }

        if (!inString && !inBacktick && char === "}") {
            count++;
        }
    }

    return count;
}

function registerTinySemanticTokens(context: vscode.ExtensionContext) {
    const provider: vscode.DocumentSemanticTokensProvider = {
        provideDocumentSemanticTokens(document) {
            if (!parser || document.languageId !== "tiny") {
                return new vscode.SemanticTokensBuilder(semanticLegend).build();
            }

            const tree = parser.parse(document.getText());
            const builder = new vscode.SemanticTokensBuilder(semanticLegend);

            walkTree(tree.rootNode, node => {
                if (node.type === "class_declaration") {
                    const name = node.childForFieldName?.("name");
                    if (name) pushToken(builder, name, "class");
                }

                if (node.type === "enum_declaration") {
                    const name = node.childForFieldName?.("name") ?? firstIdentifierChild(node);
                    if (name) pushToken(builder, name, "enum");

                    for (const member of getEnumMemberNodes(node)) {
                        pushToken(builder, member, "enumMember");
                    }
                }

                if (node.type === "function_declaration") {
                    const name = node.childForFieldName?.("name");
                    if (name) {
                        const parentType = node.parent?.type;
                        pushToken(builder, name, parentType === "class_body" ? "method" : "function");
                    }
                }

                if (node.type === "variable_declaration_no_semicolon") {
                    const name = node.childForFieldName?.("name");
                    if (name) pushToken(builder, name, "variable");

                    const type = node.childForFieldName?.("type");
                    if (type) pushToken(builder, type, "type");
                }

                if (node.type === "embed_declaration") {
                    const name = node.childForFieldName?.("name");
                    if (name) pushToken(builder, name, "property");
                }

                if (node.type === "member_expression") {
                    const property = node.childForFieldName?.("property");

                    if (property) {
                        const parent = node.parent;

                        const isMethodCall =
                            parent?.type === "call_expression" &&
                            parent.childForFieldName?.("function") === node;

                        pushToken(builder, property, isMethodCall ? "method" : "property");
                    }
                }
            });

            return builder.build();
        }
    };

    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            { language: "tiny" },
            provider,
            semanticLegend
        )
    );
}

function registerTinyCompletions(context: vscode.ExtensionContext) {
    const provider = vscode.languages.registerCompletionItemProvider(
        "tiny",
        {
            async provideCompletionItems(document, position) {
                if (!parser) {
                    return [];
                }

                const memberCompletions = await getMemberCompletions(document, position);
                if (memberCompletions) {
                    return memberCompletions;
                }

                const completions: vscode.CompletionItem[] = [];

                addSnippetCompletions(completions);
                addKeywordCompletions(completions);
                addStdModuleCompletions(document, completions);
                await addFileImportAliasCompletions(document, completions);
                addCurrentFileSymbols(document, completions);

                return removeDuplicateCompletions(completions);
            }
        },
        "."
    );

    context.subscriptions.push(provider);
}

async function getMemberCompletions(
    document: vscode.TextDocument,
    position: vscode.Position
): Promise<vscode.CompletionItem[] | null> {
    const line = document.lineAt(position).text;
    const textBeforeCursor = line.slice(0, position.character);

    const objectText = getMemberObjectTextBeforeTrailingDot(textBeforeCursor);

    if (!objectText) {
        return null;
    }

    const simpleIdentifierMatch = objectText.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/);

    if (simpleIdentifierMatch) {
        const objectName = objectText;

        const stdImport = getStdImportsFromTree(document).find(item => item.alias === objectName);
        if (stdImport) {
            const methods = stdModules[stdImport.moduleName];
            return methods ? Object.values(methods).map(methodToCompletionItem) : [];
        }

        const fileImportCompletions = await getFileImportMemberCompletions(document, objectName);
        if (fileImportCompletions) {
            return fileImportCompletions;
        }

        const localEnumCompletions = getLocalEnumMemberCompletions(document, objectName);
        if (localEnumCompletions) {
            return localEnumCompletions;
        }
    }

    const objectType = await inferSymbolTypeAtPosition(document, objectText, position);

    if (!objectType || objectType === "any") {
        return [methodToCompletionItem(getGlobalToStringMethod())];
    }

    const completions: vscode.CompletionItem[] = [];

    completions.push(...getBuiltInMethodCompletions(objectType));
    completions.push(methodToCompletionItem(getGlobalToStringMethod()));

    const classResult = await findClassNodeByNameAnywhere(document, objectType);
    if (classResult) {
        completions.push(...getMethodsFromClassNodeText(classResult.text, classResult.node));
    }

    return removeDuplicateCompletions(completions);
}

async function inferSymbolTypeAtPosition(
    document: vscode.TextDocument,
    symbolName: string,
    position: vscode.Position
): Promise<string | null> {
    const parameterType = inferParameterTypeAtPosition(document, symbolName, position);

    if (parameterType) {
        return parameterType;
    }

    return inferVariableTypeFromTree(document, symbolName);
}

function inferParameterTypeAtPosition(
    document: vscode.TextDocument,
    parameterName: string,
    position: vscode.Position
): string | null {
    const tree = parser.parse(document.getText());
    const offset = document.offsetAt(position);

    let bestFunction: any | null = null;

    walkTree(tree.rootNode, node => {
        if (node.type !== "function_declaration" && node.type !== "anonymous_function") {
            return;
        }

        if (offset < node.startIndex || offset > node.endIndex) {
            return;
        }

        if (!bestFunction) {
            bestFunction = node;
            return;
        }

        const currentSize = node.endIndex - node.startIndex;
        const bestSize = bestFunction.endIndex - bestFunction.startIndex;

        if (currentSize < bestSize) {
            bestFunction = node;
        }
    });

    if (!bestFunction) {
        return null;
    }

    const parameters = bestFunction.childForFieldName?.("parameters");

    if (!parameters) {
        return null;
    }

    return getParameterTypeFromParameterList(document, parameters, parameterName);
}

function getParameterTypeFromParameterList(
    document: vscode.TextDocument,
    parameterListNode: any,
    parameterName: string
): string | null {
    for (let i = 0; i < parameterListNode.childCount; i++) {
        const child = parameterListNode.child(i);

        if (!child || child.type !== "parameter") {
            continue;
        }

        const nameNode = child.childForFieldName?.("name");

        if (!nameNode || nodeText(document, nameNode) !== parameterName) {
            continue;
        }

        const typeNode = child.childForFieldName?.("type");
        if (typeNode) {
            return nodeText(document, typeNode);
        }

        const defaultNode = child.childForFieldName?.("default");
        if (defaultNode) {
            return inferTypeFromExpressionNodeSync(document, defaultNode);
        }

        return "unknown";
    }

    return null;
}

function inferTypeFromExpressionNodeSync(
    document: vscode.TextDocument,
    node: any
): string {
    if (node.type === "string" || node.type === "interpolated_string") {
        return "string";
    }

    if (node.type === "number") {
        return "number";
    }

    if (node.type === "boolean") {
        return "bool";
    }

    if (node.type === "array_literal") {
        return "array";
    }

    if (node.type === "object_literal") {
        return "object";
    }

    if (node.type === "null") {
        return "null";
    }

    if (node.type === "undefined") {
        return "undefined";
    }

    if (node.type === "typeof_expression") {
        return "string";
    }

    if (node.type === "call_expression") {
        const fn = node.childForFieldName?.("function");

        if (fn?.type === "identifier") {
            const name = nodeText(document, fn);

            if (/^[A-Z]/.test(name)) {
                return name;
            }

            const localFunction = findFunctionNodeByName(document, name);
            if (localFunction) {
                return getFunctionReturnTypeFromText(document.getText(), localFunction);
            }
        }

        if (fn?.type === "member_expression") {
            const object = fn.childForFieldName?.("object");
            const property = fn.childForFieldName?.("property");

            if (object && property) {
                const objectName = nodeText(document, object);
                const methodName = nodeText(document, property);

                const stdReturnType = getStdMethodReturnType(document, objectName, methodName);
                if (stdReturnType) {
                    return stdReturnType;
                }
            }
        }
    }

    return "unknown";
}

function getMemberObjectTextBeforeTrailingDot(textBeforeCursor: string): string | null {
    const withoutDot = textBeforeCursor.replace(/\.\s*$/, "").trimEnd();

    if (!withoutDot || withoutDot === textBeforeCursor.trimEnd()) {
        return null;
    }

    let parenDepth = 0;
    let bracketDepth = 0;
    let braceDepth = 0;

    for (let i = withoutDot.length - 1; i >= 0; i--) {
        const char = withoutDot[i];

        if (char === ")") parenDepth++;
        else if (char === "(") parenDepth--;
        else if (char === "]") bracketDepth++;
        else if (char === "[") bracketDepth--;
        else if (char === "}") braceDepth++;
        else if (char === "{") braceDepth--;

        const atTopLevel = parenDepth === 0 && bracketDepth === 0 && braceDepth === 0;

        if (atTopLevel && /[=;,{}]/.test(char)) {
            return withoutDot.slice(i + 1).trim();
        }
    }

    return withoutDot.trim();
}

async function inferTypeFromExpressionText(
    document: vscode.TextDocument,
    expressionText: string
): Promise<string | null> {
    const trimmed = expressionText.trim();

    if (!trimmed) {
        return null;
    }

    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
        return inferVariableTypeFromTree(document, trimmed);
    }

    const fakeSource = `const __tiny_tmp = ${trimmed};`;
    const tree = parser.parse(fakeSource);

    let valueNode: any | null = null;

    walkTree(tree.rootNode, node => {
        if (valueNode || node.type !== "variable_declaration_no_semicolon") {
            return;
        }

        valueNode = node.childForFieldName?.("value") ?? null;
    });

    if (!valueNode) {
        return null;
    }

    return inferTypeFromExpressionNode(document, valueNode);
}

function methodToCompletionItem(method: TinyMethodInfo): vscode.CompletionItem {
    const item = new vscode.CompletionItem(
        method.name,
        vscode.CompletionItemKind.Method
    );

    item.detail = method.detail;
    item.documentation = new vscode.MarkdownString(
        `\`${method.detail}\`\n\n${method.documentation}`
    );
    item.insertText = new vscode.SnippetString(ensureMethodSnippetEndsWithSemicolon(method.snippet));

    return item;
}

function ensureMethodSnippetEndsWithSemicolon(snippet: string): string {
    const trimmed = snippet.trimEnd();

    if (trimmed.endsWith(";")) {
        return snippet;
    }

    return `${trimmed};`;
}

function getBuiltInMethodCompletions(typeName: string): vscode.CompletionItem[] {
    const normalized = normalizeTypeName(typeName).toLowerCase();
    const methods = builtInTypeMethods[normalized];

    if (!methods) {
        return [];
    }

    return Object.values(methods).map(method => {
        if (method.name !== "await") {
            return methodToCompletionItem(method);
        }

        const item = methodToCompletionItem(method);
        item.detail = renderMethodDetailForType(typeName, method);
        item.documentation = new vscode.MarkdownString(
            `\`${renderMethodDetailForType(typeName, method)}\`\n\n${method.documentation}`
        );
        return item;
    });
}

function addSnippet(
    completions: vscode.CompletionItem[],
    label: string,
    detail: string,
    snippetText: string
) {
    const item = new vscode.CompletionItem(
        label,
        vscode.CompletionItemKind.Snippet
    );

    item.detail = detail;
    item.insertText = new vscode.SnippetString(snippetText);
    item.sortText = `000_${label}`;

    completions.push(item);
}

function addSnippetCompletions(completions: vscode.CompletionItem[]) {
    addSnippet(
        completions,
        "fn",
        "Tiny function",
        "fn ${1:name}(${2:args}) {\n\t$0\n}"
    );

    addSnippet(
        completions,
        "class",
        "Tiny class",
        "class ${1:Name} {\n\tfn init(${2:args}) {\n\t\t$0\n\t}\n}"
    );

    addSnippet(
        completions,
        "enum",
        "Tiny enum",
        "enum ${1:Name} {\n\t${2:member}\n}"
    );

    addSnippet(
        completions,
        "import",
        "Tiny file import",
        "import \"${1:file.tiny}\" as ${2:alias};"
    );

    addSnippet(
        completions,
        "import std",
        "Tiny std import",
        "import std \"${1:io}\";"
    );

    addSnippet(
        completions,
        "if",
        "Tiny if statement",
        "if ${1:condition} {\n\t$0\n}"
    );

    addSnippet(
        completions,
        "ifelse",
        "Tiny if/else statement",
        "if ${1:condition} {\n\t$2\n} else {\n\t$0\n}"
    );

    addSnippet(
        completions,
        "while",
        "Tiny while loop",
        "while ${1:condition} {\n\t$0\n}"
    );

    addSnippet(
        completions,
        "for",
        "Tiny for loop",
        "for ${1:let i = 0}; ${2:i < 10}; ${3:i++} {\n\t$0\n}"
    );

    addSnippet(
        completions,
        "forin",
        "Tiny for-in loop",
        "for ${1:item} in ${2:array} {\n\t$0\n}"
    );

    addSnippet(
        completions,
        "match",
        "Tiny match statement",
        "match ${1:value} {\n\t${2:pattern} {\n\t\t$0\n\t}\n\t _ {\n\t\t\n\t}\n}"
    );

    addSnippet(
        completions,
        "try",
        "Tiny try/catch",
        "try {\n\t$1\n} catch ${2:err} {\n\t$0\n}"
    );

    addSnippet(
        completions,
        "tryfinally",
        "Tiny try/catch/finally",
        "try {\n\t$1\n} catch ${2:err} {\n\t$3\n} finally {\n\t$0\n}"
    );

    addSnippet(
        completions,
        "spawn",
        "Tiny spawn task",
        "spawn fn (${1:args}) {\n\t$0\n};"
    );

    addSnippet(
        completions,
        "print",
        "Tiny print",
        "io.println(${1:value});"
    );

    addSnippet(
        completions,
        "const",
        "Tiny const declaration",
        "const ${1:name} = ${2:value};"
    );

    addSnippet(
        completions,
        "let",
        "Tiny let declaration",
        "let ${1:name} = ${2:value};"
    );
}

function addKeywordCompletions(completions: vscode.CompletionItem[]) {
    const keywords = [
        "let",
        "const",
        "fn",
        "class",
        "enum",
        "embed",
        "export",
        "import",
        "std",
        "as",
        "return",
        "if",
        "else",
        "while",
        "for",
        "in",
        "match",
        "spawn",
        "typeof",
        "true",
        "false",
        "null",
        "undefined"
    ];

    for (const keyword of keywords) {
        const item = new vscode.CompletionItem(
            keyword,
            vscode.CompletionItemKind.Keyword
        );

        item.detail = "Tiny keyword";
        completions.push(item);
    }
}

function addStdModuleCompletions(
    document: vscode.TextDocument,
    completions: vscode.CompletionItem[]
) {
    const imports = getStdImportsFromTree(document);

    for (const stdImport of imports) {
        const item = new vscode.CompletionItem(
            stdImport.alias,
            vscode.CompletionItemKind.Module
        );

        item.detail = `std "${stdImport.moduleName}"`;
        item.insertText = stdImport.alias;

        completions.push(item);
    }
}

async function addFileImportAliasCompletions(
    document: vscode.TextDocument,
    completions: vscode.CompletionItem[]
) {
    const imports = await getFileImportsFromTree(document);

    for (const imported of imports) {
        const item = new vscode.CompletionItem(
            imported.alias,
            vscode.CompletionItemKind.Module
        );

        item.detail = `import "${imported.path}"`;
        item.insertText = imported.alias;

        completions.push(item);
    }
}

function addCurrentFileSymbols(
    document: vscode.TextDocument,
    completions: vscode.CompletionItem[]
) {
    const tree = parser.parse(document.getText());

    walkTree(tree.rootNode, node => {
        if (node.type === "class_declaration") {
            const name = node.childForFieldName?.("name");
            if (!name) return;

            const className = nodeText(document, name);
            const item = new vscode.CompletionItem(
                className,
                vscode.CompletionItemKind.Class
            );

            item.detail = `class ${className}`;
            completions.push(item);
        }

        if (node.type === "enum_declaration") {
            const name = node.childForFieldName?.("name") ?? firstIdentifierChild(node);
            if (!name) return;

            const enumName = nodeText(document, name);
            const item = new vscode.CompletionItem(
                enumName,
                vscode.CompletionItemKind.Enum
            );

            item.detail = `enum ${enumName}`;
            item.insertText = enumName;
            completions.push(item);
        }

        if (node.type === "function_declaration") {
            const name = node.childForFieldName?.("name");
            if (!name) return;

            const fnName = nodeText(document, name);
            const item = new vscode.CompletionItem(
                fnName,
                vscode.CompletionItemKind.Function
            );

            item.detail = getFunctionSignatureFromText(document.getText(), node);
            item.insertText = new vscode.SnippetString(`${fnName}($0)`);

            completions.push(item);
        }

        if (node.type === "variable_declaration_no_semicolon") {
            const name = node.childForFieldName?.("name");
            if (!name) return;

            const variableName = nodeText(document, name);
            const item = new vscode.CompletionItem(
                variableName,
                vscode.CompletionItemKind.Variable
            );

            item.detail = "Tiny variable";
            item.insertText = variableName;

            completions.push(item);
        }
    });
}

async function getFileImportMemberCompletions(
    document: vscode.TextDocument,
    alias: string
): Promise<vscode.CompletionItem[] | null> {
    const imports = await getFileImportsFromTree(document);
    const imported = imports.find(item => item.alias === alias);

    if (!imported) {
        return null;
    }

    const completions: vscode.CompletionItem[] = [];

    forEachExportedNode(imported, exportedNode => {
        if (exportedNode.type === "class_declaration") {
            const name = exportedNode.childForFieldName("name");
            if (!name) return;

            const className = nodeTextFromText(imported.text, name);
            const item = new vscode.CompletionItem(
                className,
                vscode.CompletionItemKind.Class
            );

            item.detail = `class ${className}`;
            item.insertText = className;

            completions.push(item);
        }

        if (exportedNode.type === "enum_declaration") {
            const name = exportedNode.childForFieldName?.("name") ?? firstIdentifierChild(exportedNode);
            if (!name) return;

            const enumName = nodeTextFromText(imported.text, name);
            const item = new vscode.CompletionItem(
                enumName,
                vscode.CompletionItemKind.Enum
            );

            item.detail = `enum ${enumName}`;
            item.insertText = enumName;

            completions.push(item);
        }

        if (exportedNode.type === "function_declaration") {
            const name = exportedNode.childForFieldName("name");
            if (!name) return;

            const functionName = nodeTextFromText(imported.text, name);
            const item = new vscode.CompletionItem(
                functionName,
                vscode.CompletionItemKind.Function
            );

            item.detail = getFunctionSignatureFromText(imported.text, exportedNode);
            item.insertText = new vscode.SnippetString(`${functionName}($0)`);

            completions.push(item);
        }

        if (exportedNode.type === "variable_declaration") {
            const inner = findFirstChildOfType(exportedNode, "variable_declaration_no_semicolon");
            if (!inner) return;

            const name = inner.childForFieldName("name");
            if (!name) return;

            const variableName = nodeTextFromText(imported.text, name);
            const item = new vscode.CompletionItem(
                variableName,
                vscode.CompletionItemKind.Variable
            );

            item.detail = `export const ${variableName}`;
            item.insertText = variableName;

            completions.push(item);
        }
    });

    return removeDuplicateCompletions(completions);
}

function registerTinyHoverProvider(context: vscode.ExtensionContext) {
    const provider = vscode.languages.registerHoverProvider("tiny", {
        async provideHover(document, position) {
            if (!parser || document.languageId !== "tiny") {
                return undefined;
            }

            const wordRange = document.getWordRangeAtPosition(
                position,
                /[a-zA-Z_][a-zA-Z0-9_]*/
            );

            if (!wordRange) {
                return undefined;
            }

            const word = document.getText(wordRange);

            const stdHover = getStdHover(document, position, word);
            if (stdHover) {
                return new vscode.Hover(stdHover, wordRange);
            }

            const fileImportHover = await getFileImportMemberHover(document, position, word);
            if (fileImportHover) {
                return new vscode.Hover(fileImportHover, wordRange);
            }

            const memberHover = await getMemberHover(document, position, word);
            if (memberHover) {
                return new vscode.Hover(memberHover, wordRange);
            }

            // Do not treat a property name like event.test as a standalone local symbol named test.
            if (getMemberAccessBeforePosition(document, position)) {
                return undefined;
            }

            const symbolHover = await getSymbolHover(document, word);
            if (symbolHover) {
                return new vscode.Hover(symbolHover, wordRange);
            }

            return undefined;
        }
    });

    context.subscriptions.push(provider);
}

function getStdHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    word: string
): vscode.MarkdownString | undefined {
    const member = getMemberAccessBeforePosition(document, position);
    if (!member) {
        return undefined;
    }

    const stdImport = getStdImportsFromTree(document).find(item => item.alias === member.objectName);
    if (!stdImport) {
        return undefined;
    }

    const method = stdModules[stdImport.moduleName]?.[word];
    if (!method) {
        return undefined;
    }

    return new vscode.MarkdownString(
        `\`${method.detail}\`\n\n${method.documentation}`
    );
}

async function getFileImportMemberHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    word: string
): Promise<vscode.MarkdownString | undefined> {
    const member = getMemberAccessBeforePosition(document, position);
    if (!member) {
        return undefined;
    }

    const imports = await getFileImportsFromTree(document);
    const imported = imports.find(item => item.alias === member.objectName);

    if (!imported) {
        return undefined;
    }

    const exported = findExportedMember(imported, word);
    if (!exported) {
        return undefined;
    }

    if (exported.type === "class_declaration") {
        return new vscode.MarkdownString(
            `\`class ${word}\`\n\nImported from \`${imported.path}\`.`
        );
    }

    if (exported.type === "enum_declaration") {
        return new vscode.MarkdownString(
            `\`enum ${word}\`\n\nImported from \`${imported.path}\`.`
        );
    }

    if (exported.type === "function_declaration") {
        return new vscode.MarkdownString(
            `\`${getFunctionSignatureFromText(imported.text, exported)}\`\n\nImported from \`${imported.path}\`.`
        );
    }

    if (exported.type === "variable_declaration") {
        const inner = findFirstChildOfType(exported, "variable_declaration_no_semicolon");
        const value = inner?.childForFieldName?.("value");
        const type = inner?.childForFieldName?.("type");
        const typeText = type
            ? nodeTextFromText(imported.text, type)
            : value
                ? inferTypeFromImportedExpressionNode(imported.text, value)
                : "any";

        return new vscode.MarkdownString(
            `\`export const ${word}: ${typeText}\`\n\nImported from \`${imported.path}\`.`
        );
    }

    return undefined;
}

async function getMemberHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    word: string
): Promise<vscode.MarkdownString | undefined> {
    const member = getMemberAccessBeforePosition(document, position);
    if (!member) {
        return undefined;
    }

    const objectType = await inferVariableTypeFromTree(document, member.objectName);
    if (!objectType) {
        return undefined;
    }

    const builtInMethod = getBuiltInOrGlobalMethod(objectType, word);
    if (builtInMethod) {
        const detail = renderMethodDetailForType(objectType, builtInMethod);

        return new vscode.MarkdownString(
            `\`${detail}\`\n\n${builtInMethod.documentation}`
        );
    }

    const classResult = await findClassNodeByNameAnywhere(document, objectType);
    if (!classResult) {
        return undefined;
    }

    const methodNode = findMethodNodeInClassText(classResult.text, classResult.node, word);
    if (!methodNode) {
        return undefined;
    }

    return new vscode.MarkdownString(
        `\`${objectType}.${getFunctionSignatureFromText(classResult.text, methodNode)}\``
    );
}

async function getSymbolHover(
    document: vscode.TextDocument,
    word: string
): Promise<vscode.MarkdownString | undefined> {
    const tree = parser.parse(document.getText());
    let result: vscode.MarkdownString | undefined;

    walkTree(tree.rootNode, node => {
        if (result) {
            return;
        }

        if (node.type === "variable_declaration_no_semicolon") {
            const name = node.childForFieldName?.("name");
            if (!name || nodeText(document, name) !== word) {
                return;
            }

            result = new vscode.MarkdownString("PENDING_VARIABLE");
        }

        if (node.type === "class_declaration") {
            const name = node.childForFieldName?.("name");
            if (name && nodeText(document, name) === word) {
                result = new vscode.MarkdownString(`\`class ${word}\``);
            }
        }

        if (node.type === "enum_declaration") {
            const name = node.childForFieldName?.("name") ?? firstIdentifierChild(node);
            if (name && nodeText(document, name) === word) {
                result = new vscode.MarkdownString(`\`enum ${word}\``);
            }

            for (const member of getEnumMemberNodes(node)) {
                if (nodeText(document, member) === word) {
                    const enumName = name ? nodeText(document, name) : "enum";
                    result = new vscode.MarkdownString(`\`${enumName}.${word}: ${enumName}\``);
                    return;
                }
            }
        }

        if (node.type === "function_declaration") {
            const name = node.childForFieldName?.("name");
            if (name && nodeText(document, name) === word) {
                result = new vscode.MarkdownString(
                    `\`${getFunctionSignatureFromText(document.getText(), node)}\``
                );
            }
        }
    });

    if (result?.value === "PENDING_VARIABLE") {
        const activePosition = vscode.window.activeTextEditor?.selection.active;
        const type = await inferVariableTypeFromTree(document, word, activePosition);
        return new vscode.MarkdownString(`\`const ${word}: ${type ?? "any"}\``);
    }

    if (!result) {
        const activeEditor = vscode.window.activeTextEditor;

        if (activeEditor && activeEditor.document.uri.toString() === document.uri.toString()) {
            const position = activeEditor.selection.active;
            const parameterType = inferParameterTypeAtPosition(document, word, position);

            if (parameterType) {
                return new vscode.MarkdownString(`\`${word}: ${parameterType}\``);
            }
        }
    }

    return result;
}

async function inferVariableTypeFromTree(
    document: vscode.TextDocument,
    variableName: string,
    position?: vscode.Position
): Promise<string | null> {
    const tree = parser.parse(document.getText());
    let declarationNode: any | null = null;

    walkTree(tree.rootNode, node => {
        if (declarationNode || node.type !== "variable_declaration_no_semicolon") {
            return;
        }

        const name = node.childForFieldName?.("name");
        if (name && nodeText(document, name) === variableName) {
            declarationNode = node;
        }
    });

    if (!declarationNode) {
        return null;
    }

    const typeNode = declarationNode.childForFieldName?.("type");
    if (typeNode) {
        return nodeText(document, typeNode);
    }

    const valueNode = declarationNode.childForFieldName?.("value");
    if (!valueNode) {
        return null;
    }

    return inferTypeFromExpressionNode(document, valueNode, position);
}

async function inferTypeFromExpressionNode(
    document: vscode.TextDocument,
    node: any,
    position?: vscode.Position
): Promise<string> {
    if (node.type === "string" || node.type === "interpolated_string") {
        return "string";
    }

    if (node.type === "number") {
        return "number";
    }

    if (node.type === "boolean") {
        return "bool";
    }

    if (node.type === "array_literal") {
        return "array";
    }

    if (node.type === "object_literal") {
        return "object";
    }

    if (node.type === "null") {
        return "null";
    }

    if (node.type === "undefined") {
        return "undefined";
    }

    if (node.type === "typeof_expression") {
        return "string";
    }

    if (node.type === "spawn_expression") {
        return await inferSpawnExpressionType(document, node);
    }

    if (node.type === "member_expression") {
        const enumType = await inferEnumMemberType(document, node);
        if (enumType) {
            return enumType;
        }
    }

    if (node.type === "call_expression") {
        return inferCallExpressionType(document, node, position);
    }

    return "any";
}

async function inferCallExpressionType(
    document: vscode.TextDocument,
    callNode: any,
    position?: vscode.Position
): Promise<string> {
    const fn = callNode.childForFieldName?.("function");
    if (!fn) {
        return "any";
    }

    if (fn.type === "identifier") {
        const name = nodeText(document, fn);

        if (/^[A-Z]/.test(name)) {
            return name;
        }

        const localFunction = findFunctionNodeByName(document, name);
        if (localFunction) {
            return getFunctionReturnTypeFromText(document.getText(), localFunction);
        }
    }

    if (fn.type === "member_expression") {
        const object = fn.childForFieldName?.("object");
        const property = fn.childForFieldName?.("property");

        if (!object || !property) {
            return "any";
        }

        const objectName = nodeText(document, object);
        const methodName = nodeText(document, property);

        const stdReturnType = getStdMethodReturnType(document, objectName, methodName);
        if (stdReturnType) {
            return stdReturnType;
        }

        const importedType = await inferImportedMemberCallType(document, objectName, methodName);
        if (importedType) {
            return importedType;
        }

        const objectPosition = position ?? new vscode.Position(
            object.startPosition.row,
            object.startPosition.column
        );

        const objectType = await inferSymbolTypeAtPosition(
            document,
            objectName,
            objectPosition
        );
        if (objectType) {
            const builtInMethod = getBuiltInOrGlobalMethod(objectType, methodName);
            if (builtInMethod) {
                return resolveMethodReturnType(objectType, builtInMethod);
            }

            const classMethodType = await getClassMethodReturnType(document, objectType, methodName);
            if (classMethodType) {
                return classMethodType;
            }
        }
    }

    return "any";
}

async function inferImportedMemberCallType(
    document: vscode.TextDocument,
    alias: string,
    memberName: string
): Promise<string | null> {
    const imports = await getFileImportsFromTree(document);
    const imported = imports.find(item => item.alias === alias);

    if (!imported) {
        return null;
    }

    const exported = findExportedMember(imported, memberName);
    if (!exported) {
        return null;
    }

    if (exported.type === "class_declaration") {
        return memberName;
    }

    if (exported.type === "enum_declaration") {
        return memberName;
    }

    if (exported.type === "function_declaration") {
        return getFunctionReturnTypeFromText(imported.text, exported);
    }

    if (exported.type === "variable_declaration") {
        const inner = findFirstChildOfType(exported, "variable_declaration_no_semicolon");
        const typeNode = inner?.childForFieldName?.("type");
        const valueNode = inner?.childForFieldName?.("value");

        if (typeNode) {
            return nodeTextFromText(imported.text, typeNode);
        }

        if (valueNode) {
            return inferTypeFromImportedExpressionNode(imported.text, valueNode);
        }
    }

    return null;
}

function inferTypeFromImportedExpressionNode(
    sourceText: string,
    node: any
): string {
    if (node.type === "string" || node.type === "interpolated_string") {
        return "string";
    }

    if (node.type === "number") {
        return "number";
    }

    if (node.type === "boolean") {
        return "bool";
    }

    if (node.type === "array_literal") {
        return "array";
    }

    if (node.type === "object_literal") {
        return "object";
    }

    if (node.type === "null") {
        return "null";
    }

    if (node.type === "undefined") {
        return "undefined";
    }

    if (node.type === "typeof_expression") {
        return "string";
    }

    if (node.type === "spawn_expression") {
        return inferSpawnExpressionTypeFromText(sourceText, node);
    }

    if (node.type === "call_expression") {
        const fn = node.childForFieldName?.("function");
        if (fn?.type === "identifier") {
            const name = nodeTextFromText(sourceText, fn);
            if (/^[A-Z]/.test(name)) {
                return name;
            }
        }
    }

    return "any";
}

async function getClassMethodReturnType(
    document: vscode.TextDocument,
    className: string,
    methodName: string
): Promise<string | null> {
    const classResult = await findClassNodeByNameAnywhere(document, className);

    if (!classResult) {
        return null;
    }

    const methodNode = findMethodNodeInClassText(classResult.text, classResult.node, methodName);
    if (!methodNode) {
        return null;
    }

    return getFunctionReturnTypeFromText(classResult.text, methodNode);
}

async function findClassNodeByNameAnywhere(
    document: vscode.TextDocument,
    className: string
): Promise<ClassSearchResult | null> {
    const local = findClassNodeByName(document, className);

    if (local) {
        return {
            node: local,
            text: document.getText()
        };
    }

    const imports = await getFileImportsFromTree(document);

    for (const imported of imports) {
        let found: any | null = null;

        forEachExportedNode(imported, exportedNode => {
            if (found || exportedNode.type !== "class_declaration") {
                return;
            }

            const name = exportedNode.childForFieldName?.("name");
            if (name && nodeTextFromText(imported.text, name) === className) {
                found = exportedNode;
            }
        });

        if (found) {
            return {
                node: found,
                text: imported.text
            };
        }
    }

    return null;
}

function findClassNodeByName(
    document: vscode.TextDocument,
    className: string
): any | null {
    const tree = parser.parse(document.getText());
    let found: any | null = null;

    walkTree(tree.rootNode, node => {
        if (found || node.type !== "class_declaration") {
            return;
        }

        const name = node.childForFieldName?.("name");
        if (name && nodeText(document, name) === className) {
            found = node;
        }
    });

    return found;
}

function findFunctionNodeByName(
    document: vscode.TextDocument,
    functionName: string
): any | null {
    const tree = parser.parse(document.getText());
    let found: any | null = null;

    walkTree(tree.rootNode, node => {
        if (found || node.type !== "function_declaration") {
            return;
        }

        const name = node.childForFieldName?.("name");
        if (name && nodeText(document, name) === functionName) {
            found = node;
        }
    });

    return found;
}

function findMethodNodeInClassText(
    sourceText: string,
    classNode: any,
    methodName: string
): any | null {
    let found: any | null = null;

    walkTree(classNode, node => {
        if (found || node.type !== "function_declaration") {
            return;
        }

        const name = node.childForFieldName?.("name");
        if (name && nodeTextFromText(sourceText, name) === methodName) {
            found = node;
        }
    });

    return found;
}

function getMethodsFromClassNodeText(
    sourceText: string,
    classNode: any
): vscode.CompletionItem[] {
    const completions: vscode.CompletionItem[] = [];

    walkTree(classNode, node => {
        if (node.type !== "function_declaration") {
            return;
        }

        const name = node.childForFieldName?.("name");
        if (!name) {
            return;
        }

        const methodName = nodeTextFromText(sourceText, name);
        const returnType = getFunctionReturnTypeFromText(sourceText, node);

        const item = new vscode.CompletionItem(
            methodName,
            vscode.CompletionItemKind.Method
        );

        item.detail = `method ${methodName}(): ${returnType}`;
        item.insertText = new vscode.SnippetString(`${methodName}($0);`);

        completions.push(item);
    });

    return removeDuplicateCompletions(completions);
}

function getFunctionReturnTypeFromText(sourceText: string, functionNode: any): string {
    const returnType = functionNode.childForFieldName?.("return_type");

    if (returnType) {
        return nodeTextFromText(sourceText, returnType);
    }

    const inferredReturnTypes: string[] = [];

    walkTree(functionNode, node => {
        if (node.type !== "return_statement") {
            return;
        }

        const value = node.childForFieldName?.("value");

        if (!value) {
            inferredReturnTypes.push("undefined");
            return;
        }

        inferredReturnTypes.push(inferTypeFromImportedExpressionNode(sourceText, value));
    });

    if (inferredReturnTypes.length === 0) {
        return "undefined";
    }

    const first = inferredReturnTypes[0];
    const allSame = inferredReturnTypes.every(type => type === first);

    return allSame ? first : "any";
}

function getFunctionSignatureFromText(sourceText: string, functionNode: any): string {
    const nameNode = functionNode.childForFieldName?.("name");
    const paramsNode = functionNode.childForFieldName?.("parameters");

    const name = nameNode ? nodeTextFromText(sourceText, nameNode) : "anonymous";
    const params = paramsNode ? nodeTextFromText(sourceText, paramsNode) : "()";
    const returnType = getFunctionReturnTypeFromText(sourceText, functionNode);

    return `fn ${name}${params}: ${returnType}`;
}

function getStdMethodReturnType(
    document: vscode.TextDocument,
    alias: string,
    methodName: string
): string | null {
    const stdImport = getStdImportsFromTree(document).find(item => item.alias === alias);

    if (!stdImport) {
        return null;
    }

    return stdModules[stdImport.moduleName]?.[methodName]?.returnType ?? null;
}

function getBuiltInOrGlobalMethod(typeName: string, methodName: string): TinyMethodInfo | null {
    if (methodName === "toString") {
        return getGlobalToStringMethod();
    }

    const normalized = normalizeTypeName(typeName).toLowerCase();
    return builtInTypeMethods[normalized]?.[methodName] ?? null;
}

function getGlobalToStringMethod(): TinyMethodInfo {
    return globalMethods.tostring;
}

function normalizeTypeName(typeName: string): string {
    const trimmed = typeName.trim();
    const genericMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)<.*>$/);
    return genericMatch ? genericMatch[1] : trimmed;
}

function resolveMethodReturnType(objectType: string, method: TinyMethodInfo): string {
    if (method.name === "await") {
        const taskMatch = objectType.match(/^task<(.+)>$/i);
        if (taskMatch) {
            return taskMatch[1].trim();
        }
    }

    return method.returnType;
}

function renderMethodDetailForType(objectType: string, method: TinyMethodInfo): string {
    if (method.name === "await") {
        return `task.await(): ${resolveMethodReturnType(objectType, method)}`;
    }

    return method.detail;
}

function getStdImportsFromTree(document: vscode.TextDocument): TinyStdImport[] {
    const tree = parser.parse(document.getText());
    const imports: TinyStdImport[] = [];

    walkTree(tree.rootNode, node => {
        if (node.type !== "import_statement") {
            return;
        }

        const text = nodeText(document, node);

        const match = text.match(
            /^import\s+std\s+"([^"]+)"(?:\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*))?\s*;/
        );

        if (!match) {
            return;
        }

        imports.push({
            moduleName: match[1],
            alias: match[2] ?? match[1]
        });
    });

    return imports;
}

async function getFileImportsFromTree(
    document: vscode.TextDocument
): Promise<TinyFileImport[]> {
    if (!parser) {
        return [];
    }

    const tree = parser.parse(document.getText());
    const imports: TinyFileImport[] = [];
    const baseUri = vscode.Uri.joinPath(document.uri, "..");

    const importNodes: any[] = [];

    walkTree(tree.rootNode, node => {
        if (node.type === "import_statement") {
            importNodes.push(node);
        }
    });

    for (const node of importNodes) {
        const text = nodeText(document, node).trim();

        if (/^import\s+std\b/.test(text)) {
            continue;
        }

        const match = text.match(
            /^import\s+"([^"]+)"(?:\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*))?\s*;/
        );

        if (!match) {
            continue;
        }

        const importPath = match[1];
        const alias = match[2] ?? defaultImportAlias(importPath);
        const uri = vscode.Uri.joinPath(baseUri, importPath);

        try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            const importedText = Buffer.from(bytes).toString("utf8");
            const importedTree = parser.parse(importedText);

            imports.push({
                path: importPath,
                alias,
                uri,
                text: importedText,
                tree: importedTree
            });
        } catch {
            // Missing import diagnostics can be added later.
        }
    }

    return imports;
}

function defaultImportAlias(importPath: string): string {
    const fileName = importPath.split(/[\\/]/).pop() ?? importPath;
    return fileName.replace(/\.[^.]+$/, "");
}

function forEachExportedNode(
    imported: TinyFileImport,
    callback: (node: any) => void
) {
    walkTree(imported.tree.rootNode, node => {
        if (node.type !== "export_statement") {
            return;
        }

        const inner = getExportedInnerNode(node);
        if (inner) {
            callback(inner);
        }
    });
}

function getExportedInnerNode(exportNode: any): any | null {
    for (let i = 0; i < exportNode.childCount; i++) {
        const child = exportNode.child(i);

        if (!child) {
            continue;
        }

        if (
            child.type === "class_declaration" ||
            child.type === "enum_declaration" ||
            child.type === "function_declaration" ||
            child.type === "variable_declaration"
        ) {
            return child;
        }
    }

    return null;
}

function findExportedMember(imported: TinyFileImport, memberName: string): any | null {
    let found: any | null = null;

    forEachExportedNode(imported, exportedNode => {
        if (found) {
            return;
        }

        if (exportedNode.type === "class_declaration" || exportedNode.type === "enum_declaration") {
            const name = exportedNode.childForFieldName?.("name") ?? firstIdentifierChild(exportedNode);
            if (name && nodeTextFromText(imported.text, name) === memberName) {
                found = exportedNode;
            }
        }

        if (exportedNode.type === "function_declaration") {
            const name = exportedNode.childForFieldName?.("name");
            if (name && nodeTextFromText(imported.text, name) === memberName) {
                found = exportedNode;
            }
        }

        if (exportedNode.type === "variable_declaration") {
            const inner = findFirstChildOfType(exportedNode, "variable_declaration_no_semicolon");
            const name = inner?.childForFieldName?.("name");
            if (name && nodeTextFromText(imported.text, name) === memberName) {
                found = exportedNode;
            }
        }
    });

    return found;
}

function isExportedMember(imported: TinyFileImport, memberName: string): boolean {
    return Boolean(findExportedMember(imported, memberName));
}

function findFirstChildOfType(node: any, type: string): any | null {
    let found: any | null = null;

    walkTree(node, child => {
        if (!found && child.type === type) {
            found = child;
        }
    });

    return found;
}

function getMemberAccessBeforePosition(
    document: vscode.TextDocument,
    position: vscode.Position
): { objectName: string } | null {
    const line = document.lineAt(position).text;
    const textBeforeCursor = line.slice(0, position.character);

    const match = textBeforeCursor.match(
        /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*[a-zA-Z_][a-zA-Z0-9_]*$/
    );

    if (!match) {
        return null;
    }

    return {
        objectName: match[1]
    };
}

function nodeText(document: vscode.TextDocument, node: any): string {
    return document.getText(rangeFromNode(node));
}

function nodeTextFromText(sourceText: string, node: any): string {
    return sourceText.slice(node.startIndex, node.endIndex);
}

function rangeFromNode(node: any): vscode.Range {
    const start = new vscode.Position(
        node.startPosition.row,
        node.startPosition.column
    );

    const end = new vscode.Position(
        node.endPosition.row,
        node.endPosition.column
    );

    return new vscode.Range(start, end);
}

function removeDuplicateCompletions(
    completions: vscode.CompletionItem[]
): vscode.CompletionItem[] {
    const seen = new Set<string>();
    const result: vscode.CompletionItem[] = [];

    for (const item of completions) {
        const label =
            typeof item.label === "string"
                ? item.label
                : item.label.label;

        if (seen.has(label)) {
            continue;
        }

        seen.add(label);
        result.push(item);
    }

    return result;
}

function pushToken(
    builder: vscode.SemanticTokensBuilder,
    node: any,
    tokenType: string
) {
    const tokenTypeIndex = tokenTypes.indexOf(tokenType);

    if (tokenTypeIndex === -1) {
        return;
    }

    const length = node.endPosition.column - node.startPosition.column;
    if (length <= 0) {
        return;
    }

    builder.push(
        node.startPosition.row,
        node.startPosition.column,
        length,
        tokenTypeIndex,
        0
    );
}

function walkTree(node: any, callback: (node: any) => void) {
    callback(node);

    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);

        if (child) {
            walkTree(child, callback);
        }
    }
}


function checkRedeclaredVariables(
    document: vscode.TextDocument,
    foundDiagnostics: vscode.Diagnostic[]
) {
    if (!parser) {
        return;
    }

    const tree = parser.parse(document.getText());

    walkTree(tree.rootNode, node => {
        if (node.type !== "source_file" && node.type !== "block" && node.type !== "class_body") {
            return;
        }

        checkScopeRedeclarations(document, node, foundDiagnostics);
    });
}

function checkScopeRedeclarations(
    document: vscode.TextDocument,
    scopeNode: any,
    foundDiagnostics: vscode.Diagnostic[]
) {
    const declarations = new Map<string, { nameNode: any; kind: string }>();

    for (let i = 0; i < scopeNode.childCount; i++) {
        const child = scopeNode.child(i);

        if (!child) {
            continue;
        }

        const declaration = getDirectDeclarationInScope(document, child);

        if (!declaration) {
            continue;
        }

        const previous = declarations.get(declaration.name);

        if (previous) {
            foundDiagnostics.push(new vscode.Diagnostic(
                rangeFromNode(declaration.nameNode),
                `Symbol '${declaration.name}' is already declared in this scope as ${previous.kind}.`,
                vscode.DiagnosticSeverity.Error
            ));
            continue;
        }

        declarations.set(declaration.name, {
            nameNode: declaration.nameNode,
            kind: declaration.kind
        });
    }
}

function getDirectDeclarationInScope(
    document: vscode.TextDocument,
    node: any
): { name: string; nameNode: any; kind: string } | null {
    if (node.type === "export_statement") {
        const inner = getExportedInnerNode(node);
        return inner ? getDirectDeclarationInScope(document, inner) : null;
    }

    if (node.type === "variable_declaration") {
        const inner = findFirstChildOfType(node, "variable_declaration_no_semicolon");
        const name = inner?.childForFieldName?.("name");

        if (!name) {
            return null;
        }

        return {
            name: nodeText(document, name),
            nameNode: name,
            kind: "variable"
        };
    }

    if (node.type === "function_declaration") {
        const name = node.childForFieldName?.("name");

        if (!name) {
            return null;
        }

        return {
            name: nodeText(document, name),
            nameNode: name,
            kind: "function"
        };
    }

    if (node.type === "class_declaration") {
        const name = node.childForFieldName?.("name");

        if (!name) {
            return null;
        }

        return {
            name: nodeText(document, name),
            nameNode: name,
            kind: "class"
        };
    }

    if (node.type === "enum_declaration") {
        const name = node.childForFieldName?.("name") ?? firstIdentifierChild(node);

        if (!name) {
            return null;
        }

        return {
            name: nodeText(document, name),
            nameNode: name,
            kind: "enum"
        };
    }

    if (node.type === "import_statement") {
        const text = nodeText(document, node).trim();
        const aliasNode = node.childForFieldName?.("alias");

        if (aliasNode) {
            return {
                name: nodeText(document, aliasNode),
                nameNode: aliasNode,
                kind: "import"
            };
        }

        const stdMatch = text.match(/^import\s+std\s+"([^"]+)"/);
        if (stdMatch) {
            const pathNode = node.childForFieldName?.("path");

            return {
                name: stdMatch[1],
                nameNode: pathNode ?? node,
                kind: "import"
            };
        }

        const fileMatch = text.match(/^import\s+"([^"]+)"/);
        if (fileMatch) {
            const pathNode = node.childForFieldName?.("path");

            return {
                name: defaultImportAlias(fileMatch[1]),
                nameNode: pathNode ?? node,
                kind: "import"
            };
        }
    }

    return null;
}

async function checkImportDiagnostics(
    document: vscode.TextDocument,
    foundDiagnostics: vscode.Diagnostic[]
) {
    const tree = parser.parse(document.getText());

    const importNodes: any[] = [];

    walkTree(tree.rootNode, node => {
        if (node.type === "import_statement") {
            importNodes.push(node);
        }
    });

    const baseUri = vscode.Uri.joinPath(document.uri, "..");

    for (const node of importNodes) {
        const text = nodeText(document, node).trim();

        const stdMatch = text.match(
            /^import\s+std\s+"([^"]+)"(?:\s+as\s+[a-zA-Z_][a-zA-Z0-9_]*)?\s*;/
        );

        if (stdMatch) {
            const moduleName = stdMatch[1];

            if (!stdModules[moduleName]) {
                foundDiagnostics.push(new vscode.Diagnostic(
                    rangeFromNode(node),
                    `Unknown standard library module '${moduleName}'.`,
                    vscode.DiagnosticSeverity.Error
                ));
            }

            continue;
        }

        const fileMatch = text.match(
            /^import\s+"([^"]+)"(?:\s+as\s+[a-zA-Z_][a-zA-Z0-9_]*)?\s*;/
        );

        if (!fileMatch) {
            continue;
        }

        const importPath = fileMatch[1];
        const uri = vscode.Uri.joinPath(baseUri, importPath);

        try {
            await vscode.workspace.fs.stat(uri);
        } catch {
            foundDiagnostics.push(new vscode.Diagnostic(
                rangeFromNode(node),
                `Cannot find imported file '${importPath}'.`,
                vscode.DiagnosticSeverity.Error
            ));
        }
    }
}

function getLocalEnumMemberCompletions(
    document: vscode.TextDocument,
    enumName: string
): vscode.CompletionItem[] | null {
    const enumNode = findEnumNodeByName(document, enumName);

    if (!enumNode) {
        return null;
    }

    const completions = getEnumMemberNodes(enumNode).map(member => {
        const memberName = nodeText(document, member);
        const item = new vscode.CompletionItem(
            memberName,
            vscode.CompletionItemKind.EnumMember
        );

        item.detail = `${enumName}.${memberName}`;
        item.insertText = memberName;

        return item;
    });

    return removeDuplicateCompletions(completions);
}

function findEnumNodeByName(
    document: vscode.TextDocument,
    enumName: string
): any | null {
    const tree = parser.parse(document.getText());
    let found: any | null = null;

    walkTree(tree.rootNode, node => {
        if (found || node.type !== "enum_declaration") {
            return;
        }

        const name = node.childForFieldName?.("name") ?? firstIdentifierChild(node);

        if (name && nodeText(document, name) === enumName) {
            found = node;
        }
    });

    return found;
}

function getEnumMemberNodes(enumNode: any): any[] {
    const name = enumNode.childForFieldName?.("name") ?? firstIdentifierChild(enumNode);
    const members: any[] = [];

    walkTree(enumNode, node => {
        if (node.type !== "identifier") {
            return;
        }

        if (name && node.startIndex === name.startIndex && node.endIndex === name.endIndex) {
            return;
        }

        // Avoid grabbing identifiers from nested syntax if the grammar changes later.
        if (node.parent?.type === "type_identifier") {
            return;
        }

        members.push(node);
    });

    return members;
}

function firstIdentifierChild(node: any): any | null {
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);

        if (child?.type === "identifier") {
            return child;
        }
    }

    return null;
}

async function inferEnumMemberType(
    document: vscode.TextDocument,
    node: any
): Promise<string | null> {
    if (node.type !== "member_expression") {
        return null;
    }

    const object = node.childForFieldName?.("object");
    const property = node.childForFieldName?.("property");

    if (!object || !property) {
        return null;
    }

    const memberName = nodeText(document, property);

    if (object.type === "identifier") {
        const enumName = nodeText(document, object);
        const enumNode = findEnumNodeByName(document, enumName);

        if (!enumNode) {
            return null;
        }

        const hasMember = getEnumMemberNodes(enumNode)
            .some(member => nodeText(document, member) === memberName);

        return hasMember ? enumName : null;
    }

    // Handles imported enum values such as tg.Random.test.
    if (object.type === "member_expression") {
        const aliasNode = object.childForFieldName?.("object");
        const enumNodeNameNode = object.childForFieldName?.("property");

        if (!aliasNode || !enumNodeNameNode || aliasNode.type !== "identifier") {
            return null;
        }

        const alias = nodeText(document, aliasNode);
        const enumName = nodeText(document, enumNodeNameNode);
        const imports = await getFileImportsFromTree(document);
        const imported = imports.find(item => item.alias === alias);

        if (!imported) {
            return null;
        }

        const exported = findExportedMember(imported, enumName);

        if (!exported || exported.type !== "enum_declaration") {
            return null;
        }

        const hasMember = getEnumMemberNodes(exported)
            .some(member => nodeTextFromText(imported.text, member) === memberName);

        return hasMember ? enumName : null;
    }

    return null;
}

async function inferSpawnExpressionType(
    document: vscode.TextDocument,
    spawnNode: any
): Promise<string> {
    const returnTypes: string[] = [];

    walkTree(spawnNode, node => {
        if (node.type !== "return_statement") {
            return;
        }

        const value = node.childForFieldName?.("value");

        if (!value) {
            returnTypes.push("undefined");
            return;
        }

        returnTypes.push("__PENDING__" + value.startIndex);
    });

    if (returnTypes.length === 0) {
        return "task<undefined>";
    }

    const resolvedTypes: string[] = [];

    for (const marker of returnTypes) {
        if (!marker.startsWith("__PENDING__")) {
            resolvedTypes.push(marker);
            continue;
        }

        const startIndex = Number(marker.replace("__PENDING__", ""));
        let valueNode: any | null = null;

        walkTree(spawnNode, node => {
            if (!valueNode && node.startIndex === startIndex) {
                valueNode = node;
            }
        });

        if (valueNode) {
            resolvedTypes.push(await inferTypeFromExpressionNode(document, valueNode));
        }
    }

    const first = resolvedTypes[0] ?? "undefined";
    const allSame = resolvedTypes.every(type => type === first);

    return `task<${allSame ? first : "any"}>`;
}

function inferSpawnExpressionTypeFromText(
    sourceText: string,
    spawnNode: any
): string {
    const returnTypes: string[] = [];

    walkTree(spawnNode, node => {
        if (node.type !== "return_statement") {
            return;
        }

        const value = node.childForFieldName?.("value");

        if (!value) {
            returnTypes.push("undefined");
            return;
        }

        returnTypes.push(inferTypeFromImportedExpressionNode(sourceText, value));
    });

    if (returnTypes.length === 0) {
        return "task<undefined>";
    }

    const first = returnTypes[0] ?? "undefined";
    const allSame = returnTypes.every(type => type === first);

    return `task<${allSame ? first : "any"}>`;
}

export function deactivate() { }
