const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const ffmpeg = require('fluent-ffmpeg');
let ffmpegPath;

if (app.isPackaged) {
  // In production, use the binary from resources/bin/{platform}/
  // 'process.resourcesPath' points to the 'resources' folder in the installed app
  const platform = process.platform === 'win32' ? 'win' : 'mac';
  const exeName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  ffmpegPath = path.join(process.resourcesPath, 'bin', exeName);
} else {
  // In development, use the one from node_modules
  ffmpegPath = require('ffmpeg-static');
}

ffmpeg.setFfmpegPath(ffmpegPath);

let mainWindow;
let db = null;
let transcodingTasks = new Map(); // Store active transcoding tasks

const dbPath = path.join(app.getPath('userData'), 'recordings.db');

function initDatabase() {
  db = new Database(dbPath);
  
  // Create recordings table
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

  // Create compression_tasks table separately to ensure it's created even if recordings table exists
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js')
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a2e'
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (db) {
    db.close();
  }
});

ipcMain.handle('select-save-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

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

ipcMain.handle('check-file-exists', async (event, filePath) => {
  return fs.existsSync(filePath);
});

ipcMain.handle('read-recording-file', async (event, filePath) => {
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    console.error('Failed to read file:', error);
    throw error;
  }
});

ipcMain.handle('open-file-location', async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

ipcMain.on('start-transcoding-batch', (event, { recordingIds, config }) => {
  if (config.mode === 'merge' && recordingIds.length > 1) {
    startMergeTask(recordingIds, config);
  } else {
    recordingIds.forEach(id => {
      startTranscodingTask(id, config);
    });
  }
});

ipcMain.handle('get-compression-tasks', () => {
  if (!db) return [];
  try {
    // Join with recordings to get original filename
    const stmt = db.prepare(`
      SELECT t.*, r.filename as source_filename 
      FROM compression_tasks t
      LEFT JOIN recordings r ON t.recording_id = r.id
      ORDER BY t.created_at DESC
    `);
    const tasks = stmt.all();
    // Parse config JSON
    return tasks.map(t => ({
      ...t,
      config: JSON.parse(t.config || '{}')
    }));
  } catch (error) {
    console.error('Failed to get compression tasks:', error);
    return [];
  }
});

function startMergeTask(recordingIds, config) {
  if (!db) return;
  
  // Verify all files exist
  const recordings = [];
  for (const id of recordingIds) {
    const rec = db.prepare('SELECT * FROM recordings WHERE id = ?').get(id);
    if (!rec || !fs.existsSync(rec.file_path)) {
      // Handle error
      return;
    }
    recordings.push(rec);
  }
  
  const timestamp = new Date().getTime();
  const firstRec = recordings[0];
  const parsedPath = path.parse(firstRec.file_path);
  const ext = config.format || 'mp4';
  const codec = config.codec === 'h265' ? 'libx265' : 'libx264';
  
  const outputFilename = `merged_${recordings.length}_files_${timestamp}.${ext}`;
  const outputPath = path.join(parsedPath.dir, outputFilename);
  
  // Create task entry
  let taskId;
  try {
    const stmt = db.prepare(`
      INSERT INTO compression_tasks (recording_id, output_path, config, status, progress)
      VALUES (?, ?, ?, ?, ?)
    `);
    // Link to the first recording for reference, or maybe we need a way to link multiple?
    // For now, linking to first is enough to show in list (if we modify query) or just separate.
    // Our query joins on recording_id, so we need a valid one.
    const result = stmt.run(firstRec.id, outputPath, JSON.stringify({ ...config, isMerge: true, count: recordings.length }), 'processing', 0);
    taskId = result.lastInsertRowid;
  } catch (e) {
    console.error('Failed to create merge task:', e);
    return;
  }
  
  mainWindow.webContents.send('compression-task-updated');
  
  // Create temporary list file for ffmpeg concat
  const listFilePath = path.join(parsedPath.dir, `concat_list_${timestamp}.txt`);
  const fileContent = recordings.map(r => `file '${r.file_path}'`).join('\n');
  fs.writeFileSync(listFilePath, fileContent);
  
  let command = ffmpeg(listFilePath)
    .inputOptions(['-f concat', '-safe 0']);
    
  // Apply configuration
  if (config.resolution && config.resolution !== 'original') {
    command = command.size(config.resolution);
  }
  
  if (config.bitrate) {
    command = command.videoBitrate(config.bitrate);
  }
  
  if (config.fps) {
    command = command.fps(parseInt(config.fps));
  }
  
  if (codec === 'libx265') {
     command = command.videoCodec('libx265').outputOptions('-tag:v hvc1');
  }
  
  command
    .on('progress', (progress) => {
      const percent = Math.round(progress.percent || 0);
      mainWindow.webContents.send('compression-progress', { taskId, progress: percent });
    })
    .on('end', () => {
      try {
         fs.unlinkSync(listFilePath); // Clean up list file
         const stats = fs.statSync(outputPath);
         
         db.prepare(`
           UPDATE compression_tasks 
           SET status = ?, progress = 100, completed_at = CURRENT_TIMESTAMP, output_size = ? 
           WHERE id = ?
         `).run('completed', stats.size, taskId);
         
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
      
      db.prepare('UPDATE compression_tasks SET status = ?, progress = 0 WHERE id = ?')
        .run('failed', taskId);
      mainWindow.webContents.send('compression-task-updated');
      mainWindow.webContents.send('compression-error', { taskId, error: err.message });
    })
    .save(outputPath);
    
  transcodingTasks.set(taskId, command);
}

function startTranscodingTask(recordingId, config) {
  if (!db) return;
  
  const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(recordingId);
  if (!recording || !fs.existsSync(recording.file_path)) {
    // Should notify error, but no task ID yet. 
    // Maybe we should create task first as failed?
    return;
  }

  const inputPath = recording.file_path;
  const parsedPath = path.parse(inputPath);
  const codec = config.codec === 'h265' ? 'libx265' : 'libx264';
  const ext = config.format || 'mp4';
  
  const timestamp = new Date().getTime();
  const outputFilename = `${parsedPath.name}_compressed_${config.resolution || 'original'}_${timestamp}.${ext}`;
  const outputPath = path.join(parsedPath.dir, outputFilename);

  // Create Task in DB
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
  
  // Notify UI of new task
  mainWindow.webContents.send('compression-task-updated');

  let command = ffmpeg(inputPath);

  // Apply configuration
  if (config.resolution && config.resolution !== 'original') {
    command = command.size(config.resolution);
  }
  
  if (config.bitrate) {
    command = command.videoBitrate(config.bitrate);
  }
  
  if (config.fps) {
    command = command.fps(parseInt(config.fps));
  }
  
  if (codec === 'libx265') {
     command = command.videoCodec('libx265').outputOptions('-tag:v hvc1');
  }

  command
    .on('progress', (progress) => {
      const percent = Math.round(progress.percent || 0);
      
      // Update DB
      // Ideally we don't write to DB on every tick for progress, but for simplicity we do.
      // Or we can just send IPC to UI.
      
      // Update DB occasionally or just send IPC?
      // Let's update DB so if app restarts we know where we were (though ffmpeg won't resume).
      // Actually for now just send IPC to update UI smoothly.
      
      mainWindow.webContents.send('compression-progress', { taskId, progress: percent });
    })
    .on('end', () => {
      try {
         const stats = fs.statSync(outputPath);
         
         db.prepare(`
           UPDATE compression_tasks 
           SET status = ?, progress = 100, completed_at = CURRENT_TIMESTAMP, output_size = ? 
           WHERE id = ?
         `).run('completed', stats.size, taskId);
         
         mainWindow.webContents.send('compression-task-updated');
         mainWindow.webContents.send('compression-complete', { taskId });
      } catch (e) {
        console.error('Error on transcoding end:', e);
      }
    })
    .on('error', (err) => {
      console.error('Transcoding error:', err);
      db.prepare('UPDATE compression_tasks SET status = ?, progress = 0 WHERE id = ?')
        .run('failed', taskId);
      mainWindow.webContents.send('compression-task-updated');
      mainWindow.webContents.send('compression-error', { taskId, error: err.message });
    })
    .save(outputPath);
    
  transcodingTasks.set(taskId, command);
}

ipcMain.handle('delete-compression-task', (event, { id, deleteFile }) => {
  if (!db) return false;
  try {
    const task = db.prepare('SELECT * FROM compression_tasks WHERE id = ?').get(id);
    if (!task) return false;
    
    // Delete file if requested
    if (deleteFile && task.output_path && fs.existsSync(task.output_path)) {
      try {
        fs.unlinkSync(task.output_path);
      } catch (e) {
        console.error('Failed to delete output file:', e);
      }
    }
    
    db.prepare('DELETE FROM compression_tasks WHERE id = ?').run(id);
    return true;
  } catch (error) {
    console.error('Failed to delete task:', error);
    throw error;
  }
});

ipcMain.handle('get-app-info', () => {
  return {
    userDataPath: app.getPath('userData'),
    ffmpegPath: ffmpegPath
  };
});

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

ipcMain.handle('delete-recording-file', async (event, { filePath, id }) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    if (id && db) {
      db.prepare('DELETE FROM recordings WHERE id = ?').run(id);
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to delete file:', error);
    return { success: false, error: error.message };
  }
});
