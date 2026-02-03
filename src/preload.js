const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectSavePath: () => ipcRenderer.invoke('select-save-path'),
  getRecordings: () => ipcRenderer.invoke('db-get-recordings'),
  addRecording: (recording) => ipcRenderer.invoke('db-add-recording', recording),
  saveRecordingFile: (data) => ipcRenderer.invoke('save-recording-file', data),
  checkFileExists: (filePath) => ipcRenderer.invoke('check-file-exists', filePath),
  readRecordingFile: (filePath) => ipcRenderer.invoke('read-recording-file', filePath),
  deleteRecordingFile: ({ filePath, id }) => ipcRenderer.invoke('delete-recording-file', { filePath, id }),
  openFileLocation: (filePath) => ipcRenderer.invoke('open-file-location', filePath),
  
  startTranscodingBatch: (data) => ipcRenderer.send('start-transcoding-batch', data),
  getCompressionTasks: () => ipcRenderer.invoke('get-compression-tasks'),
  onCompressionProgress: (callback) => ipcRenderer.on('compression-progress', callback),
  onCompressionComplete: (callback) => ipcRenderer.on('compression-complete', callback),
  onCompressionError: (callback) => ipcRenderer.on('compression-error', callback),
  onCompressionTaskUpdated: (callback) => ipcRenderer.on('compression-task-updated', callback),
  deleteCompressionTask: (data) => ipcRenderer.invoke('delete-compression-task', data),
  getAppInfo: () => ipcRenderer.invoke('get-app-info')
});
