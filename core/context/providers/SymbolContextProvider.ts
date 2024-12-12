import * as vscode from "vscode";

import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";

function getDocumentSymbols(uri: vscode.Uri) {
  return (
    vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      uri,
    ) || []
  );
}

class SymbolContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "symbols",
    displayTitle: "Symbols",
    description: "Reference symbols in current file",
    type: "normal",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const editor = vscode.window.activeTextEditor;
    const doc = editor?.document;
    const symbols = doc
      ? await getDocumentSymbols(vscode.Uri.file(doc.fileName))
      : [];

    if (!symbols) {
      return [];
    }

    return symbols.map((symbol) => ({
      name: symbol.name,
      description: symbol.detail || symbol.name,
      content: `\`\`\`${doc?.languageId}\n${doc?.getText(symbol.range)}\n\`\`\``,
      uri: {
        type: "symbol",
        value: symbol.name,
      },
    }));
  }
}

export default SymbolContextProvider;
