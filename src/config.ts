import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '.env') })

const PORT_LOCAL = 8886
const CONFIGURATION_FILE = '.CΩ'
const CΩ_SCHEMA = 'codeAwareness'
const EXT_URL = process.env.LOCAL ? `http://localhost:${PORT_LOCAL}` : 'https://ext.codeawareness.com' // CΩ Webview server
const API_URL = process.env.LOCAL ? `http://localhost:${PORT_LOCAL}/api/v1` : 'https://api.codeawareness.com/v1'
const SERVER_WSS = process.env.LOCAL ? 'wss://localhost:48408/v1' : 'wss://api.codeawareness.com/v1'

// Workspace: SYNC_INTERVAL gives the timer for syncing with the server
const SYNC_INTERVAL = 1000 * 100 // download diffs from the server every minute or so

// Diffs: SYNC_THRESHOLD gives the throttling interval for sending and receiving diffs
const SYNC_THRESHOLD = 1000 // avoid too many send/receive requests per second

const LOG_LEVEL = process.env.LOG_LEVEL || 'debug' // ['verbose', 'debug', 'error']

// EXTRACT_BRANCH_DIR where we extract the file from a specific branch, to be compared with the activeTextEditor
const EXTRACT_BRANCH_DIR = 'b'

// EXTRACT_LOCAL_DIR where we write the contents of the activeTextEditor, to be compared with peer files or otherwise processed with git commands
const EXTRACT_LOCAL_DIR = 'l'

// EXTRACT_REPO_DIR where we gather all the files from common SHA commit, but only those touched by a peer
const EXTRACT_REPO_DIR = 'r'

// EXTRACT_PEER_DIR where we have the peer versions for the files touched by a single peer
const EXTRACT_PEER_DIR = 'e'

export {
  API_URL,
  CONFIGURATION_FILE,
  EXT_URL,
  EXTRACT_BRANCH_DIR,
  EXTRACT_LOCAL_DIR,
  EXTRACT_PEER_DIR,
  EXTRACT_REPO_DIR,
  LOG_LEVEL,
  CΩ_SCHEMA,
  PORT_LOCAL,
  SERVER_WSS,
  SYNC_INTERVAL,
  SYNC_THRESHOLD,
}
