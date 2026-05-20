import * as vscode from "vscode";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
    const serverOptions: ServerOptions = {
        command: "tiny",
        args: ["lsp"],
        transport: TransportKind.stdio
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: "file", language: "tiny" }
        ],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher("**/*.tiny")
        }
    };

    client = new LanguageClient(
        "tinyLanguageServer",
        "Tiny Language Server",
        serverOptions,
        clientOptions
    );

    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }

    return client.stop();
}