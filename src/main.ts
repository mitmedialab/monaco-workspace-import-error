import "@codingame/monaco-vscode-python-default-extension";
import {
  RegisteredFileSystemProvider,
  registerFileSystemOverlay,
  RegisteredMemoryFile,
} from "@codingame/monaco-vscode-files-service-override";
import {
  MonacoEditorLanguageClientWrapper,
  type UserConfig,
} from "monaco-editor-wrapper";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import {
  BrowserMessageReader,
  BrowserMessageWriter,
} from "vscode-languageserver-protocol/browser.js";
import { CloseAction, ErrorAction } from "vscode-languageclient";
import { useWorkerFactory } from "monaco-editor-wrapper/workerFactory";
import * as vscode from "vscode";

import { readZipFile } from "./zip";

const htmlElement = document.querySelector<HTMLDivElement>('#app')!;

const getTypeDefinitionFiles = () => {
  const typeshedSrc = "stdlib-source-with-typeshed-pyi.zip";
  console.log(`readZipFile ${typeshedSrc}`);
  const tryPrependSlash = (filename: string) => filename.replace(/^(stdlib|stubs)/, '/$1');;
  return readZipFile(new URL(`./${typeshedSrc}`, window.location.href).href, tryPrependSlash);
}

async function setup() {
  useWorkerFactory({
    ignoreMapping: true,
    workerLoaders: {
      editorWorkerService: () => new EditorWorker(),
    },
  });

  const typeshedFiles = await getTypeDefinitionFiles();

  const pyrightWorker = new Worker(new URL("./pyright.worker.js", window.location.href));

  const workspaceRoot = `/workspace`;
  const workspaceUri = vscode.Uri.parse(workspaceRoot);

  const helloPy = {
    code: `from hello2 import print_hello
print_hello()
print("Hello Moon!")`,
    uri: vscode.Uri.file("/workspace/hello.py"),
  };

  const hello2Py = {
    code: `def print_hello():
print("Hello World!")`,
    uri: vscode.Uri.file("/workspace/hello2.py"),
  };

  const fileSystemProvider = new RegisteredFileSystemProvider(false);
  fileSystemProvider.registerFile(new RegisteredMemoryFile(helloPy.uri, helloPy.code));
  fileSystemProvider.registerFile(new RegisteredMemoryFile(hello2Py.uri, hello2Py.code));

  registerFileSystemOverlay(1, fileSystemProvider);

  pyrightWorker.postMessage({
    type: "browser/boot",
    mode: "foreground",
  });

  const pyrightReader = new BrowserMessageReader(pyrightWorker);
  const pyrightWriter = new BrowserMessageWriter(pyrightWorker);

  const wrapperConfig: UserConfig["wrapperConfig"] = {
    editorAppConfig: {
      $type: "extended",
      useDiffEditor: false,
      codeResources: {
        main: {
          uri: helloPy.uri.toString(),
          text: helloPy.code,
        },
      },
    },
  };

  const languageClientConfig: UserConfig["languageClientConfig"] = {
    name: "Pyright Language Client",
    languageId: "python",
    options: {
      $type: "WorkerDirect",
      worker: pyrightWorker,
    },
    clientOptions: {
      documentSelector: ["python"],
      workspaceFolder: {
        index: 0,
        name: "workspace",
        uri: workspaceUri,
      },
      initializationOptions: {
        files: typeshedFiles,
      },
      errorHandler: {
        error: () => ({ action: ErrorAction.Continue }),
        closed: () => ({ action: CloseAction.DoNotRestart }),
      },
    },
    connectionProvider: {
      get: () => Promise.resolve({
        reader: pyrightReader,
        writer: pyrightWriter
      }),
    },
  };

  const wrapper = new MonacoEditorLanguageClientWrapper();

  await wrapper.init({ wrapperConfig, languageClientConfig });
  await vscode.workspace.openTextDocument(hello2Py.uri);
  await vscode.workspace.openTextDocument(helloPy.uri);
  await wrapper.start(htmlElement);

}

setup();