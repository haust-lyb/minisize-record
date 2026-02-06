/**
 * preload.js - 预加载脚本
 * 在渲染进程和主进程之间建立安全的通信桥梁
 * 通过 contextBridge 暴露 API，避免直接暴露 Node.js 功能
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * electronAPI 对象
 * 向渲染进程（网页）暴露安全的 Electron API
 * 渲染进程通过 window.electronAPI 访问这些方法
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ============ 文件系统相关 ============

  /**
   * 选择保存路径
   * @returns {Promise<string|null>} 用户选择的文件夹路径
   */
  selectSavePath: () => ipcRenderer.invoke('select-save-path'),

  /**
   * 获取所有录制文件列表
   * @returns {Promise<Array>} 录制文件数组
   */
  getRecordings: () => ipcRenderer.invoke('db-get-recordings'),

  /**
   * 添加录制文件记录到数据库
   * @param {Object} recording - 录制文件信息
   * @returns {Promise<number>} 新记录的 ID
   */
  addRecording: (recording) => ipcRenderer.invoke('db-add-recording', recording),

  /**
   * 保存录制文件到磁盘
   * @param {Object} data - 包含 buffer, savePath, filename
   * @returns {Promise<Object>} 保存结果
   */
  saveRecordingFile: (data) => ipcRenderer.invoke('save-recording-file', data),

  /**
   * 检查文件是否存在
   * @param {string} filePath - 文件路径
   * @returns {Promise<boolean>} 文件是否存在
   */
  checkFileExists: (filePath) => ipcRenderer.invoke('check-file-exists', filePath),

  /**
   * 读取录制文件内容
   * @param {string} filePath - 文件路径
   * @returns {Promise<Buffer>} 文件内容的 Buffer
   */
  readRecordingFile: (filePath) => ipcRenderer.invoke('read-recording-file', filePath),

  /**
   * 删除录制文件
   * @param {Object} params - 包含 filePath 和 id
   * @returns {Promise<Object>} 删除结果
   */
  deleteRecordingFile: ({ filePath, id }) => ipcRenderer.invoke('delete-recording-file', { filePath, id }),

  /**
   * 在文件管理器中打开文件所在位置
   * @param {string} filePath - 文件路径
   * @returns {Promise<boolean>} 操作是否成功
   */
  openFileLocation: (filePath) => ipcRenderer.invoke('open-file-location', filePath),

  // ============ 视频压缩相关 ============

  /**
   * 开始批量转码任务
   * @param {Object} data - 包含 recordingIds 和 config
   */
  startTranscodingBatch: (data) => ipcRenderer.send('start-transcoding-batch', data),

  /**
   * 获取所有压缩任务列表
   * @returns {Promise<Array>} 压缩任务数组
   */
  getCompressionTasks: () => ipcRenderer.invoke('get-compression-tasks'),

  /**
   * 监听压缩进度更新
   * @param {Function} callback - 回调函数，接收 (event, { taskId, progress })
   */
  onCompressionProgress: (callback) => ipcRenderer.on('compression-progress', callback),

  /**
   * 监听压缩任务完成
   * @param {Function} callback - 回调函数，接收 (event, { taskId })
   */
  onCompressionComplete: (callback) => ipcRenderer.on('compression-complete', callback),

  /**
   * 监听压缩任务错误
   * @param {Function} callback - 回调函数，接收 (event, { taskId, error })
   */
  onCompressionError: (callback) => ipcRenderer.on('compression-error', callback),

  /**
   * 监听压缩任务列表更新
   * @param {Function} callback - 回调函数
   */
  onCompressionTaskUpdated: (callback) => ipcRenderer.on('compression-task-updated', callback),

  /**
   * 删除压缩任务
   * @param {Object} data - 包含 id 和 deleteFile
   * @returns {Promise<boolean>} 操作是否成功
   */
  deleteCompressionTask: (data) => ipcRenderer.invoke('delete-compression-task', data),

  // ============ 应用信息 ============

  /**
   * 获取应用信息
   * @returns {Promise<Object>} 包含 userDataPath 和 ffmpegPath
   */
  getAppInfo: () => ipcRenderer.invoke('get-app-info')
});
