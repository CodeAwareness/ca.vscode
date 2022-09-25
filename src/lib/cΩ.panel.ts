import axios from 'axios'
import * as vscode from 'vscode'
import * as path from 'path'

import config from '@/config'
import logger from './logger'

import { CΩStore } from './cΩ.store'
import { locale } from './locale'

import CΩIPC from './cΩ.ipc'
import CΩWorkspace from './cΩ.workspace'
import CΩEditor from './cΩ.editor'

let panelColumn: vscode.ViewColumn = vscode.ViewColumn.Two

function getPanel() {
  return CΩStore.panel
}

function hasPanel() {
  return !!CΩStore.panel
}

function dispose() {
  if (CΩStore.panel) {
    CΩWorkspace.dispose()
  }
}

let editorMoveToggle = 1
function moveEditor(webviewPanel: vscode.WebviewPanel) {
  panelColumn = webviewPanel.viewColumn || vscode.ViewColumn.Two
  if (!webviewPanel.active && editorMoveToggle++ % 2) {
    const to = webviewPanel.viewColumn === vscode.ViewColumn.One ? 'last' : 'first'
    vscode.commands.executeCommand('moveActiveEditor', { to, by: 'group' })
  }
}

function createPanel(extensionPath: string) {
  CΩStore.panel = vscode.window.createWebviewPanel(
    'codeAwareness',
    'codeAwareness',
    panelColumn,
    {
      retainContextWhenHidden: true,
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(extensionPath, 'media')),
        vscode.Uri.file(path.join(extensionPath, 'out')),
      ],
    },
  )

  return CΩStore.panel
}

/************************************************************************************
 * toggle cΩ panel on and off
 *
 * When toggling the CodeAwareness webview panel on and off,
 * we load the svelte app into the webview and show or hide the panel.
 *
 * @param Object - context object from VSCode
 *
 ************************************************************************************/
function toggle(context: vscode.ExtensionContext) {
  const { extensionPath } = context
  let panel = CΩStore.panel

  if (panel && !panel.visible) {
    panel.reveal()
    return
  }

  if (panel && panel.visible) {
    return setTimeout(dispose, 100)
  }

  if (!panel) {
    panel = createPanel(extensionPath)
  }

  if (!panel.webview) return

  return getWebviewContent(panel.webview, config.EXT_URL)
    .then(() => {
      CΩEditor.focusTextEditor()
      CΩIPC.setup(panel.webview, context)
      panel.onDidDispose(dispose, undefined, context.subscriptions)
      panel.onDidChangeViewState((state: vscode.WindowState) => CΩPanel.didChangeViewState(state), undefined, context.subscriptions)
    })
}

axios.defaults.adapter = require('axios/lib/adapters/http')
const axiosEXT = axios.create({ baseURL: config.EXT_URL })

function getWebviewContent(webview: vscode.Webview, extURL: string) {
  webview.html = '<h1>Loading...</h1>'
  console.log('WEBVIEW: ', extURL, locale)
  return axiosEXT.get(extURL + `/index.html?l=${locale}`)
    .then(response => (webview.html = response.data))
    .catch(err => {
      webview.html = '<h1>Offline</h1><p>You are either offline or the CodeAwareness server is down.</p></h1>'
      logger.error('PANEL getWebviewContent error', err)
    })
}

/************************************************************************************
 * post a message back to VSCode API
 *
 * @param Object - data to be sent to the webview
 ************************************************************************************/
function postMessage(data: any) {
  if (CΩStore.panel) {
    logger.info('PANEL postMessage', JSON.stringify(data))
    CΩStore.panel.webview.postMessage(data)
  }
}

/************************************************************************************
 * ensure we're not focusing the cΩ panel
 *
 * We have to find a way to avoid opening a file in the same window group as the webview.
 * From what I could find, VSCode does not provide any means to doing that,
 * so I'm instead using this trick, of moving the code to the left.
 * (sorry for those people with portrait monitors... I'll figure something out later)
 *
 * @param Object - the state object received from VSCode API
 *
 ************************************************************************************/
function didChangeViewState(state: any) {
  logger.info('PANEL didChangeViewState', state)
  if (hasPanel()) {
    moveEditor(state.webviewPanel)
  }
}

/************************************************************************************
 * update contributor information
 *
 * We have to find a way to avoid opening a file in the same window group as the webview.
 * From what I could find, VSCode does not provide any means to doing that,
 * so I'm instead using this trick, of moving the code to the left.
 * (sorry for those people with portrait monitors... I'll figure something out later)
 *
 * @param Object - the project (received from VSCode API)
 *
 ************************************************************************************/
function updateProject(data: any) {
  postMessage({ command: 'setProject', data })
}

const CΩPanel = {
  createPanel,
  didChangeViewState,
  dispose,
  getPanel,
  hasPanel,
  postMessage,
  toggle,
  updateProject,
}

export default CΩPanel
