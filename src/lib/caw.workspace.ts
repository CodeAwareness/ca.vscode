/**************************
 * Code Awareness workspace
 **************************/
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as vscode from 'vscode'

import logger from './logger'

import { CAWStore, CAWWork } from './caw.store'

import type { TCAWEditor } from './caw.editor'

import CAWDeco from './caw.deco'
import CAWDiffs from './caw.diffs'
import CAWEditor from './caw.editor'
import CAWSCM from './caw.scm'
import CAWIPC from './caw.ipc'

// TODO: this doesn't quite work.
const isWindows = !!process.env.ProgramFiles

function init(data?: any) {
  console.log('Workspace: init', data)
  if (data?.user) {
    CAWStore.user = data.user
    CAWStore.tokens = data.tokens
    CAWDiffs.init()
  }
  return setupTempFiles()
}

function dispose() {
  logger.info('WORKSPACE: dispose')
  // TODO: cleanup temp files
  if (CAWWork.syncTimer) clearInterval(CAWWork.syncTimer)
  CAWStore.panel?.dispose()
  CAWStore.panel = undefined
  CAWEditor.updateDecorations(CAWStore.activeProject)
}

function setupTempFiles() {
  return CAWIPC.transmit('repo:get-tmp-dir', CAWIPC.guid)
    .then((data: any) => {
      CAWStore.tmpDir = data.tmpDir
      logger.info('WORKSPACE: temporary folder used: ', CAWStore.tmpDir)
    })
}

/************************************************************************************
 * refreshLines
 *
 * @param Object { contentChanges, document }
 *
 * Refresh changed lines (orange hints in the ruler, and line highlights in the editor).
 *
 * The vscodeChanges is an object received from VSCode, and contains the details about the changes that occured in the document.
 * The range lines numbers are zero indexed.
 * For a DELETE operation: range contains the range that was deleted, text is the empty string.
 * For an INSERT operation (including PASTE): range length is 0, text is the code that was inserted.
 *
 * Scenario to help visualize the folding algorithm:
 * Marked lines: 1, 2, 9, 13, 14, 20
 * change 1: we have removed 5 lines previously from line 8 through 13;
 * change 2: we have changed line 8;
 * change 3: we paste 2 new lines after line 11;
 * change 4: we press Enter line somewhere inside line 2
 * change 5: we delete line 12
 *
 * The result of these changes ([line, len], replaceLen), incrementally:
 * 1: changes: [8, 5], 1 (lines > 8 => max(8, line - 5))     Marked: 1, 2, 8, 9, 15
 * 2: changes: [8, 0], 1 (same ^^)                           --
 * 3: changes: [11, 0], 3 (lines > 11 => max(11, line + 2))  Marked: 1, 2, 8, 9, 17
 * 4: changes: [2, 1], 2 (lines > 2 => max(2, line + 1))     Marked: 1, 2, 9, 10, 18
 * 5: changes: [12, 1], 1 (lines > 12 => max(12, line -1))   Marked: 1, 2, 9, 10, 17
 ************************************************************************************/
function refreshLines(options: vscode.TextDocumentChangeEvent) {
  console.log('WORKSPACE: refreshLines options', options)
  const { contentChanges, document } = options
  if (!CAWStore.activeProject.activePath || !CAWStore.user || !contentChanges?.length) return Promise.resolve()
  // TODO: maybe use the `document` object we receive along with contentChanges, to ensure correct project / fpath selection
  const fpath = document.uri.fsPath
  if (!fpath) return Promise.reject(new Error('No active file'))
  const project = CAWStore.activeProject
  // TODO: why sometimes we make a change, but we receive an empty contentChanges array? (for example when we insert a new line)
  contentChanges.map(change => {
    logger.log('WORKSPACE: CHANGE', change.range, change.range.start, change.range.end)
    const startLine = change.range.start.line
    const endLine = change.range.end.line
    const endLineChar = isWindows ? '\r\n' : /\n|\r/ // TODO: better handling of CR LF, based on user pref ? source file defaults ? editor prefs ?
    const replaceLen = change.text.split(endLineChar).length - 1
    const range = {
      line: startLine,
      len: endLine - startLine + replaceLen,
    }
    const changes = { range, replaceLen }
    logger.log('WORKSPACE: refreshLines changes', range, replaceLen, changes)
    // TODO: deal with live changes in the editor

    project.editorDiff = project.editorDiff || {}
    const editorDiff = project.editorDiff
    editorDiff[fpath] = editorDiff[fpath] || []
    editorDiff[fpath].push(changes)

    if (!CAWDiffs.pendingDiffs[fpath]) {
      CAWDiffs.shiftWithLiveEdits(project, fpath)
      delete editorDiff[fpath]
    }
  })
  CAWDeco.insertDecorations(true)
  return Promise.resolve()
}

/************************************************************************************
 * Close text document
 *
 * (cleanup)
 ************************************************************************************/
function closeTextDocument(params: any) {
  console.log('WORKSPACE: closeTextDocument', params)
}

/************************************************************************************
 * Diff code slices navigation
 *
 * Ideally we could press a key combo to replace chunks of our code with the code from
 * our contributors diff, and cycle through all variations this way.
 * This would allow us to quickly check a single block of changes without having to
 * open the diff editor for each contributor.
 ************************************************************************************/
function highlight() {
  // TODO: cycle through the changes while highlighting changes existing at peers
}

const getCode = (editor: TCAWEditor) => editor?.document.getText()

function saveCode() {
  if (!CAWStore.activeTextEditor) return Promise.reject(new Error('No active editor')) // TODO:
  const existingCode = getCode(CAWStore.activeTextEditor)
  // TODO:
  return Promise.resolve()
}

function getSavedCode() {
  // TODO: return readFile(_tmpFile).catch(err => null && err)
}

// TODO: add heartbeat so that we can clean up duplicate projects (which accumulate on Local Service due to restarting VSCode)
async function addProject(wsFolder: any) {
  const folder: string = wsFolder.uri ? wsFolder.uri.path : wsFolder.toString()
  logger.log('WORKSPACE: addProject', folder)

  CAWIPC.transmit('repo:add', { folder })
    .then(() => {
      CAWSCM.addProject(wsFolder)
      logger.info('WORKSPACE: Folder added to workspace: ', folder)
    })

  CAWIPC.transmit('repo:add-submodules', { folder })
    .then((subs: any) => {
      subs?.map((p: any) => CAWSCM.addProject(p))
      logger.info('WORKSPACE: Folder submodules added to workspace: ', subs)
    })
}

function removeProject(wsFolder: any) {
  const folder: string = wsFolder.uri ? wsFolder.uri.path : wsFolder.toString()

  CAWIPC.transmit('repo:remove', { folder })
    .then(() => {
      logger.info('WORKSPACE: Folder removed from workspace: ', folder)
    })
}

/************************************************************************************
 * Export module
 ************************************************************************************/
const CAWWorkspace = {
  addProject,
  closeTextDocument,
  dispose,
  getSavedCode,
  highlight,
  init,
  refreshLines,
  removeProject,
  saveCode,
  setupTempFiles,
}

export default CAWWorkspace