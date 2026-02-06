/**
 * minisize-record 主进程入口文件
 * 负责处理文件系统操作、数据库管理、FFmpeg 视频压缩等核心功能
 */

// 引入 Electron 主进程模块
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
// 引入 SQLite 数据库模块，用于存储录制文件信息
const Database = require('better-sqlite3');
// 引入 FFmpeg 封装库，用于视频压缩和格式转换
const ffmpeg = require('fluent-ffmpeg');
// 使用 ffmpeg-static 自动获取 FFmpeg 可执行文件路径
const ffmpegStatic = require('ffmpeg-static');

// 处理生产环境中的路径问题
let ffmpegPath;
if (app.isPackaged) {
  // 生产环境：ffmpeg 在 app.asar.unpacked 目录下
  const appPath = app.getAppPath();
  const unpackedPath = appPath.replace('app.asar', 'app.asar.unpacked');
  ffmpegPath = ffmpegStatic.replace(appPath, unpackedPath);
} else {
  // 开发环境：直接使用 ffmpeg-static 返回的路径
  ffmpegPath = ffmpegStatic;
}

// 配置 fluent-ffmpeg 使用指定路径的 FFmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

// 主窗口实例
let mainWindow;
// 数据库实例
let db = null;
// 存储正在进行的转码任务，用于管理任务生命周期
let transcodingTasks = new Map();

// 数据库文件路径：用户数据目录下的 recordings.db
const dbPath = path.join(app.getPath('userData'), 'recordings.db');

/**
 * 初始化 SQLite 数据库
 * 创建 recordings（录制文件表）和 compression_tasks（压缩任务表）
 */
function initDatabase() {
  db = new Database(dbPath);

  // 创建录制文件表，存储所有录制的基本信息
  db.exec(`
    CREATE TABLE IF NOT EXISTS recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      duration INTEGER DEFAULT 0,
      file_size INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      transcoding_status TEXT DEFAULT 'none',
      transcoding_progress INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      camera_name TEXT,
      resolution TEXT,
      frame_rate INTEGER
    );
  `);

  // 创建压缩任务表，存储视频压缩/转码任务的详细信息
  db.exec(`
    CREATE TABLE IF NOT EXISTS compression_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recording_id INTEGER,
      output_path TEXT,
      config TEXT,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      output_size INTEGER DEFAULT 0,
      FOREIGN KEY(recording_id) REFERENCES recordings(id) ON DELETE CASCADE
    );
  `);

  return db;
}

/**
 * 创建应用主窗口
 * 配置窗口大小、WebPreferences 安全设置等
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    // WebPreferences：配置渲染进程的安全上下文
    webPreferences: {
      nodeIntegration: false,           // 禁用 Node.js 集成，防止渲染进程访问系统资源
      contextIsolation: true,           // 启用上下文隔离，增强安全性
      preload: path.join(__dirname, '../preload.js')  // 预加载脚本，用于安全的 IPC 通信
    },
    titleBarStyle: 'hiddenInset',       // macOS 风格：隐藏标题栏
    backgroundColor: '#1a1a2e'          // 应用背景色（深紫色）
  });

  // 加载渲染进程的 HTML 文件
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // 窗口关闭时清理引用
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * 应用准备就绪时初始化
 * Electron 应用的入口点
 */
app.whenReady().then(() => {
  initDatabase();  // 初始化数据库
  createWindow();  // 创建主窗口
});

/**
 * 窗口全部关闭事件
 * macOS 除外：用户通常会在dock中保留应用
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * 应用退出前事件
 * 确保数据库连接正确关闭
 */
app.on('before-quit', () => {
  if (db) {
    db.close();
  }
});

/**
 * IPC 处理程序：选择保存路径
 * 打开系统文件夹选择对话框
 * @returns {string|null} 选择的文件夹路径，或 null（用户取消）
 */
ipcMain.handle('select-save-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']  // 只允许选择文件夹
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

/**
 * IPC 处理程序：保存录制文件
 * 将内存中的视频数据写入磁盘
 * @param {Object} event - IPC 事件对象
 * @param {ArrayBuffer} buffer - 视频数据的 ArrayBuffer
 * @param {string} savePath - 保存目录路径
 * @param {string} filename - 文件名
 * @returns {Object} 保存结果，包含文件路径和大小
 */
ipcMain.handle('save-recording-file', async (event, { buffer, savePath, filename }) => {
  try {
    const filePath = path.join(savePath, filename);
    fs.writeFileSync(filePath, Buffer.from(buffer));
    const stats = fs.statSync(filePath);
    return { success: true, filePath, fileSize: stats.size };
  } catch (error) {
    console.error('Failed to save file:', error);
    throw error;
  }
});

/**
 * IPC 处理程序：检查文件是否存在
 * @param {string} filePath - 要检查的文件路径
 * @returns {boolean} 文件是否存在
 */
ipcMain.handle('check-file-exists', async (event, filePath) => {
  return fs.existsSync(filePath);
});

/**
 * IPC 处理程序：读取录制文件
 * 将文件内容作为 Buffer 返回，供渲染进程播放
 * @param {string} filePath - 要读取的文件路径
 * @returns {Buffer} 文件内容的 Buffer
 */
ipcMain.handle('read-recording-file', async (event, filePath) => {
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    console.error('Failed to read file:', error);
    throw error;
  }
});

/**
 * IPC 处理程序：打开文件所在位置
 * 在文件管理器中定位并选中指定文件
 * @param {string} filePath - 文件路径
 * @returns {boolean} 操作是否成功
 */
ipcMain.handle('open-file-location', async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

/**
 * IPC 事件：开始批量转码任务
 * 根据配置决定是合并视频还是逐个压缩
 * @param {Object} event - IPC 事件对象
 * @param {number[]} recordingIds - 要处理的录制文件 ID 数组
 * @param {Object} config - 转码配置（分辨率、码率、帧率、编码格式等）
 */
ipcMain.on('start-transcoding-batch', (event, { recordingIds, config }) => {
  if (config.mode === 'merge' && recordingIds.length > 1) {
    // 合并模式：多个视频合并为一个
    startMergeTask(recordingIds, config);
  } else {
    // 单独模式：逐个处理每个视频
    recordingIds.forEach(id => {
      startTranscodingTask(id, config);
    });
  }
});

/**
 * IPC 处理程序：获取所有压缩任务列表
 * @returns {Array} 压缩任务数组，包含关联的原始文件名
 */
ipcMain.handle('get-compression-tasks', () => {
  if (!db) return [];
  try {
    // 关联查询：获取任务信息及对应的原始文件名
    const stmt = db.prepare(`
      SELECT t.*, r.filename as source_filename
      FROM compression_tasks t
      LEFT JOIN recordings r ON t.recording_id = r.id
      ORDER BY t.created_at DESC
    `);
    const tasks = stmt.all();
    // 将 JSON 字符串格式的配置解析为对象
    return tasks.map(t => ({
      ...t,
      config: JSON.parse(t.config || '{}')
    }));
  } catch (error) {
    console.error('Failed to get compression tasks:', error);
    return [];
  }
});

/**
 * 启动合并转码任务
 * 将多个视频文件合并为一个，并应用指定的转码配置
 * @param {number[]} recordingIds - 要合并的录制文件 ID 数组
 * @param {Object} config - 转码配置
 */
function startMergeTask(recordingIds, config) {
  if (!db) return;

  // 验证所有文件是否存在
  const recordings = [];
  for (const id of recordingIds) {
    const rec = db.prepare('SELECT * FROM recordings WHERE id = ?').get(id);
    if (!rec || !fs.existsSync(rec.file_path)) {
      return;
    }
    recordings.push(rec);
  }

  const timestamp = new Date().getTime();
  const firstRec = recordings[0];
  const parsedPath = path.parse(firstRec.file_path);
  const ext = config.format || 'mp4';
  const codec = config.codec === 'h265' ? 'libx265' : 'libx264';

  // 生成输出文件名：merged_{数量}_files_{时间戳}.{格式}
  const outputFilename = `merged_${recordings.length}_files_${timestamp}.${ext}`;
  const outputPath = path.join(parsedPath.dir, outputFilename);

  // 在数据库中创建任务记录
  let taskId;
  try {
    const stmt = db.prepare(`
      INSERT INTO compression_tasks (recording_id, output_path, config, status, progress)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      firstRec.id,
      outputPath,
      JSON.stringify({ ...config, isMerge: true, count: recordings.length }),
      'processing',
      0
    );
    taskId = result.lastInsertRowid;
  } catch (e) {
    console.error('Failed to create merge task:', e);
    return;
  }

  // 通知渲染进程有新任务
  mainWindow.webContents.send('compression-task-updated');

  // 创建临时文件列表，用于 FFmpeg concat 合并
  const listFilePath = path.join(parsedPath.dir, `concat_list_${timestamp}.txt`);
  const fileContent = recordings.map(r => `file '${r.file_path}'`).join('\n');
  fs.writeFileSync(listFilePath, fileContent);

  // 构建 FFmpeg 命令
  let command = ffmpeg(listFilePath)
    .inputOptions(['-f concat', '-safe 0']);

  // 应用分辨率设置
  if (config.resolution && config.resolution !== 'original') {
    command = command.size(config.resolution);
  }

  // 应用码率设置
  if (config.bitrate) {
    command = command.videoBitrate(config.bitrate);
  }

  // 应用帧率设置
  if (config.fps) {
    command = command.fps(parseInt(config.fps));
  }

  // H.265 编码特殊处理：需要添加 hvc1 标签以确保兼容性
  if (codec === 'libx265') {
    command = command.videoCodec('libx265').outputOptions('-tag:v hvc1');
  }

  // 绑定事件处理程序
  command
    .on('progress', (progress) => {
      const percent = Math.round(progress.percent || 0);
      mainWindow.webContents.send('compression-progress', { taskId, progress: percent });
    })
    .on('end', () => {
      try {
        // 清理临时文件列表
        fs.unlinkSync(listFilePath);
        const stats = fs.statSync(outputPath);

        // 更新数据库中的任务状态
        db.prepare(`
          UPDATE compression_tasks
          SET status = ?, progress = 100, completed_at = CURRENT_TIMESTAMP, output_size = ?
          WHERE id = ?
        `).run('completed', stats.size, taskId);

        // 通知渲染进程任务完成
        mainWindow.webContents.send('compression-task-updated');
        mainWindow.webContents.send('compression-complete', { taskId });
      } catch (e) {
        console.error('Error on merge end:', e);
      }
    })
    .on('error', (err) => {
      console.error('Merge error:', err);
      try {
        if (fs.existsSync(listFilePath)) fs.unlinkSync(listFilePath);
      } catch (e) {}

      // 更新任务状态为失败
      db.prepare('UPDATE compression_tasks SET status = ?, progress = 0 WHERE id = ?')
        .run('failed', taskId);
      mainWindow.webContents.send('compression-task-updated');
      mainWindow.webContents.send('compression-error', { taskId, error: err.message });
    })
    .save(outputPath);

  // 保存任务引用，用于可能的取消操作
  transcodingTasks.set(taskId, command);
}

/**
 * 启动单个视频压缩任务
 * 对指定录制文件进行转码，应用分辨率、码率、帧率等配置
 * @param {number} recordingId - 要压缩的录制文件 ID
 * @param {Object} config - 转码配置
 */
function startTranscodingTask(recordingId, config) {
  if (!db) return;

  // 从数据库获取录制文件信息
  const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(recordingId);
  if (!recording || !fs.existsSync(recording.file_path)) {
    return;
  }

  const inputPath = recording.file_path;
  const parsedPath = path.parse(inputPath);
  // 根据配置选择编码器：H.265 (libx265) 或 H.264 (libx264)
  const codec = config.codec === 'h265' ? 'libx265' : 'libx264';
  const ext = config.format || 'mp4';

  // 生成输出文件名：原名_compressed_{分辨率}_{时间戳}.{格式}
  const timestamp = new Date().getTime();
  const outputFilename = `${parsedPath.name}_compressed_${config.resolution || 'original'}_${timestamp}.${ext}`;
  const outputPath = path.join(parsedPath.dir, outputFilename);

  // 在数据库中创建任务记录
  let taskId;
  try {
    const stmt = db.prepare(`
      INSERT INTO compression_tasks (recording_id, output_path, config, status, progress)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(recordingId, outputPath, JSON.stringify(config), 'processing', 0);
    taskId = result.lastInsertRowid;
  } catch (e) {
    console.error('Failed to create compression task:', e);
    return;
  }

  // 通知渲染进程有新任务
  mainWindow.webContents.send('compression-task-updated');

  // 构建 FFmpeg 命令
  let command = ffmpeg(inputPath);

  // 应用分辨率设置
  if (config.resolution && config.resolution !== 'original') {
    command = command.size(config.resolution);
  }

  // 应用码率设置
  if (config.bitrate) {
    command = command.videoBitrate(config.bitrate);
  }

  // 应用帧率设置
  if (config.fps) {
    command = command.fps(parseInt(config.fps));
  }

  // H.265 编码特殊处理
  if (codec === 'libx265') {
    command = command.videoCodec('libx265').outputOptions('-tag:v hvc1');
  }

  // 绑定事件处理程序
  command
    .on('progress', (progress) => {
      const percent = Math.round(progress.percent || 0);
      // 发送进度到渲染进程，更新 UI
      mainWindow.webContents.send('compression-progress', { taskId, progress: percent });
    })
    .on('end', () => {
      try {
        const stats = fs.statSync(outputPath);

        // 更新数据库中的任务状态
        db.prepare(`
          UPDATE compression_tasks
          SET status = ?, progress = 100, completed_at = CURRENT_TIMESTAMP, output_size = ?
          WHERE id = ?
        `).run('completed', stats.size, taskId);

        // 通知渲染进程任务完成
        mainWindow.webContents.send('compression-task-updated');
        mainWindow.webContents.send('compression-complete', { taskId });
      } catch (e) {
        console.error('Error on transcoding end:', e);
      }
    })
    .on('error', (err) => {
      console.error('Transcoding error:', err);
      // 更新任务状态为失败
      db.prepare('UPDATE compression_tasks SET status = ?, progress = 0 WHERE id = ?')
        .run('failed', taskId);
      mainWindow.webContents.send('compression-task-updated');
      mainWindow.webContents.send('compression-error', { taskId, error: err.message });
    })
    .save(outputPath);

  // 保存任务引用，用于可能的取消操作
  transcodingTasks.set(taskId, command);
}

/**
 * IPC 处理程序：删除压缩任务
 * @param {number} id - 要删除的任务 ID
 * @param {boolean} deleteFile - 是否同时删除输出文件
 * @returns {boolean} 操作是否成功
 */
ipcMain.handle('delete-compression-task', (event, { id, deleteFile }) => {
  if (!db) return false;
  try {
    const task = db.prepare('SELECT * FROM compression_tasks WHERE id = ?').get(id);
    if (!task) return false;

    // 如果请求删除文件，且文件存在，则删除
    if (deleteFile && task.output_path && fs.existsSync(task.output_path)) {
      try {
        fs.unlinkSync(task.output_path);
      } catch (e) {
        console.error('Failed to delete output file:', e);
      }
    }

    // 从数据库删除任务记录
    db.prepare('DELETE FROM compression_tasks WHERE id = ?').run(id);
    return true;
  } catch (error) {
    console.error('Failed to delete task:', error);
    throw error;
  }
});

/**
 * IPC 处理程序：获取应用信息
 * @returns {Object} 包含用户数据目录路径和 FFmpeg 路径
 */
ipcMain.handle('get-app-info', () => {
  return {
    userDataPath: app.getPath('userData'),
    ffmpegPath: ffmpegPath
  };
});

/**
 * IPC 处理程序：获取所有录制文件列表
 * @returns {Array} 录制文件数组，按创建时间倒序排列
 */
ipcMain.handle('db-get-recordings', () => {
  if (!db) return [];
  try {
    const stmt = db.prepare('SELECT * FROM recordings ORDER BY created_at DESC');
    return stmt.all();
  } catch (error) {
    console.error('Failed to get recordings:', error);
    return [];
  }
});

/**
 * IPC 处理程序：添加录制文件记录
 * @param {Object} recording - 录制文件信息对象
 * @returns {number|null} 新记录的 ID，或失败时返回 null
 */
ipcMain.handle('db-add-recording', (event, recording) => {
  if (!db) return null;
  try {
    const stmt = db.prepare(`
      INSERT INTO recordings (filename, file_path, camera_name, resolution, frame_rate, duration, file_size, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      recording.filename,
      recording.filePath,
      recording.cameraName || '默认摄像头',
      recording.resolution || '1280x720',
      recording.frameRate || 30,
      recording.duration || 0,
      recording.fileSize || 0,
      recording.status || 'completed'
    );
    return result.lastInsertRowid;
  } catch (error) {
    console.error('Failed to add recording:', error);
    return null;
  }
});

/**
 * IPC 处理程序：删除录制文件
 * 同时删除数据库记录和磁盘文件
 * @param {string} filePath - 要删除的文件路径
 * @param {number} id - 数据库记录 ID
 * @returns {Object} 操作结果
 */
ipcMain.handle('delete-recording-file', async (event, { filePath, id }) => {
  try {
    // 删除磁盘文件
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    // 删除数据库记录
    if (id && db) {
      db.prepare('DELETE FROM recordings WHERE id = ?').run(id);
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to delete file:', error);
    return { success: false, error: error.message };
  }
});
