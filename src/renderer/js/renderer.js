class RecordingApp {
  constructor() {
    this.isRecording = false;
    this.isPaused = false;
    this.recordingStartTime = null;
    this.pausedAt = null;
    this.totalPausedTime = 0;
    this.timerInterval = null;
    this.currentRecordingPath = null;
    this.savePath = null;
    this.compressionTasks = [];
    this.currentView = 'setup';
    this.defaultCameraId = null;
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.currentRecordingData = null;
    this.selectedRecordingIds = [];
    this.currentTaskFilter = 'all';
    
    this.init();
  }
  
  init() {
    this.bindElements();
    this.bindEvents();
    this.bindIPC();
    this.checkSetup();
    this.startTaskPolling();
  }
  
  bindElements() {
    this.elements = {
      viewSetup: document.getElementById('view-setup'),
      viewHome: document.getElementById('view-home'),
      viewSettings: document.getElementById('view-settings'),
      viewRecording: document.getElementById('view-recording'),
      viewPlayer: document.getElementById('view-player'),
      viewTasks: document.getElementById('view-tasks'),
      
      headerActions: document.getElementById('header-actions'),
      btnSettings: document.getElementById('btn-settings'),
      btnTasks: document.getElementById('btn-tasks'),
      btnAddRecording: document.getElementById('btn-add-recording'),
      btnSetupSelectPath: document.getElementById('btn-setup-select-path'),
      btnSetupSave: document.getElementById('btn-setup-save'),
      txtSetupSavePath: document.getElementById('txt-setup-save-path'),
      btnSettingsSelectPath: document.getElementById('btn-settings-select-path'),
      txtSettingsSavePath: document.getElementById('txt-settings-save-path'),
      txtSettingsUserData: document.getElementById('txt-settings-user-data'),
      txtSettingsFfmpeg: document.getElementById('txt-settings-ffmpeg'),
      btnSettingsBack: document.getElementById('btn-settings-back'),
      btnBack: document.getElementById('btn-back'),
      btnPlayerBack: document.getElementById('btn-player-back'),
      btnTasksBack: document.getElementById('btn-tasks-back'),
      btnSave: document.getElementById('btn-save'),
      videoPreview: document.getElementById('video-preview'),
      videoPlayer: document.getElementById('video-player'),
      btnStart: document.getElementById('btn-start'),
      btnPause: document.getElementById('btn-pause'),
      btnResume: document.getElementById('btn-resume'),
      txtRecordingTime: document.getElementById('txt-recording-time'),
      toastContainer: document.getElementById('toast-container'),
      recordingStatusIndicator: document.getElementById('recording-status-indicator'),
      recordingStatusText: document.getElementById('recording-status-text'),
      recordingIndicator: document.getElementById('recording-indicator'),
      selectCamera: document.getElementById('select-camera'),
      recordingsList: document.getElementById('recordings-list'),
      tasksList: document.getElementById('tasks-list'),
      playerTitle: document.getElementById('player-title'),
      
      // Tabs
      tabBtns: document.querySelectorAll('.tab-btn'),
      
      // Task Filters
      filterBtns: document.querySelectorAll('.filter-btn'),
      
      // Batch Export Elements
      btnBatchExport: document.getElementById('btn-batch-export'),
      modalExport: document.getElementById('modal-export'),
      btnCloseModal: document.querySelector('.btn-close-modal'),
      btnExportCancel: document.getElementById('btn-export-cancel'),
      btnExportConfirm: document.getElementById('btn-export-confirm'),
      exportMode: document.getElementById('export-mode'),
      exportResolution: document.getElementById('export-resolution'),
      exportBitrate: document.getElementById('export-bitrate'),
      exportFps: document.getElementById('export-fps'),
      exportCodec: document.getElementById('export-codec')
    };
  }
  
  bindEvents() {
    if (this.elements.btnSettings) {
      this.elements.btnSettings.addEventListener('click', () => this.showView('settings'));
    }
    if (this.elements.btnTasks) {
      this.elements.btnTasks.addEventListener('click', () => this.showView('tasks'));
    }
    if (this.elements.btnAddRecording) {
      this.elements.btnAddRecording.addEventListener('click', () => this.startRecordingFlow());
    }
    if (this.elements.btnSetupSelectPath) {
      this.elements.btnSetupSelectPath.addEventListener('click', () => this.selectSetupPath());
    }
    if (this.elements.btnSetupSave) {
      this.elements.btnSetupSave.addEventListener('click', () => this.saveSetup());
    }
    if (this.elements.btnSettingsSelectPath) {
      this.elements.btnSettingsSelectPath.addEventListener('click', () => this.selectSettingsPath());
    }
    if (this.elements.btnSettingsBack) {
      this.elements.btnSettingsBack.addEventListener('click', () => this.showView('home'));
    }
    if (this.elements.btnBack) {
      this.elements.btnBack.addEventListener('click', () => this.confirmBack());
    }
    if (this.elements.btnPlayerBack) {
      this.elements.btnPlayerBack.addEventListener('click', () => this.showView('home'));
    }
    if (this.elements.btnTasksBack) {
      this.elements.btnTasksBack.addEventListener('click', () => this.showView('home'));
    }
    if (this.elements.btnSave) {
      this.elements.btnSave.addEventListener('click', () => this.handleSaveClick());
    }
    if (this.elements.btnStart) {
      this.elements.btnStart.addEventListener('click', () => this.startRecording());
    }
    if (this.elements.btnPause) {
      this.elements.btnPause.addEventListener('click', () => this.pauseRecording());
    }
    if (this.elements.btnResume) {
      this.elements.btnResume.addEventListener('click', () => this.resumeRecording());
    }
    if (this.elements.selectCamera) {
      this.elements.selectCamera.addEventListener('change', () => {
        this.switchCamera(this.elements.selectCamera.value);
      });
    }
    
    // Tab Navigation
    this.elements.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.showView(view);
      });
    });
    
    // Task Filters
    this.elements.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTaskFilter = btn.dataset.filter;
        this.elements.filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderTasks();
      });
    });
    
    // Batch Export Events
    if (this.elements.btnBatchExport) {
      this.elements.btnBatchExport.addEventListener('click', () => this.showExportModal());
    }
    if (this.elements.btnCloseModal) {
      this.elements.btnCloseModal.addEventListener('click', () => this.hideExportModal());
    }
    if (this.elements.btnExportCancel) {
      this.elements.btnExportCancel.addEventListener('click', () => this.hideExportModal());
    }
    if (this.elements.btnExportConfirm) {
      this.elements.btnExportConfirm.addEventListener('click', () => this.startBatchExport());
    }
  }
  
  bindIPC() {
    window.electronAPI.onCompressionProgress((event, { taskId, progress }) => {
      this.updateTaskProgress(taskId, progress);
    });
    
    window.electronAPI.onCompressionComplete((event, { taskId }) => {
      this.loadTasks(); // Reload to get updated size and status
    });
    
    window.electronAPI.onCompressionError((event, { taskId, error }) => {
      this.showToast(`任务失败: ${error}`, true);
      this.loadTasks();
    });
    
    window.electronAPI.onCompressionTaskUpdated(() => {
      this.loadTasks();
    });
  }
  
  startTaskPolling() {
     // Optional: poll every few seconds just in case
     setInterval(() => {
       if (this.currentView === 'tasks') {
         this.loadTasks();
       }
     }, 5000);
  }
  
  checkSetup() {
    this.savePath = localStorage.getItem('savePath') || '';
    this.defaultCameraId = localStorage.getItem('defaultCameraId') || null;
    
    if (!this.savePath) {
      this.showView('setup');
    } else {
      this.showView('home');
      this.loadRecordings();
    }
  }
  
  showView(view) {
    this.currentView = view;
    
    // Update Tab UI
    this.elements.tabBtns.forEach(btn => {
      if (btn.dataset.view === view) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    const views = ['viewSetup', 'viewHome', 'viewSettings', 'viewRecording', 'viewPlayer', 'viewTasks'];
    views.forEach(v => {
      if (this.elements[v]) {
        this.elements[v].classList.add('hidden');
      }
    });
    
    const viewEl = this.elements[`view${view.charAt(0).toUpperCase() + view.slice(1)}`];
    if (viewEl) {
      viewEl.classList.remove('hidden');
    }
    
    if (this.elements.headerActions) {
      if (view === 'recording' || view === 'setup') {
        this.elements.headerActions.style.display = 'none';
      } else {
        this.elements.headerActions.style.display = 'flex';
      }
    }
    
    if (view === 'settings') {
      this.loadSettings();
    }
    
    if (view === 'home') {
      this.loadRecordings();
    }
    
    if (view === 'tasks') {
      this.loadTasks();
    }
  }
  
  async loadCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      
      if (this.elements.selectCamera) {
        this.elements.selectCamera.innerHTML = '';
        cameras.forEach(camera => {
          const option = document.createElement('option');
          option.value = camera.deviceId;
          option.textContent = camera.label || `摄像头 ${cameras.indexOf(camera) + 1}`;
          this.elements.selectCamera.appendChild(option);
        });
        
        if (this.defaultCameraId && cameras.some(c => c.deviceId === this.defaultCameraId)) {
          this.elements.selectCamera.value = this.defaultCameraId;
        } else if (cameras.length > 0) {
          this.elements.selectCamera.value = cameras[0].deviceId;
        }
      }
    } catch (error) {
      console.error('Failed to load cameras:', error);
    }
  }
  
  async selectSetupPath() {
    const path = await window.electronAPI.selectSavePath();
    if (path) {
      this.savePath = path;
      this.elements.txtSetupSavePath.value = path;
      this.elements.btnSetupSave.disabled = false;
    }
  }
  
  async saveSetup() {
    if (this.savePath) {
      localStorage.setItem('savePath', this.savePath);
      this.showView('home');
      this.loadRecordings();
    }
  }
  
  async selectSettingsPath() {
    const path = await window.electronAPI.selectSavePath();
    if (path) {
      this.savePath = path;
      localStorage.setItem('savePath', this.savePath);
      this.loadSettings();
      this.showToast('保存路径已更新');
    }
  }
  
  async loadSettings() {
    this.elements.txtSettingsSavePath.value = this.savePath || '未设置';
    
    try {
      const info = await window.electronAPI.getAppInfo();
      if (this.elements.txtSettingsUserData) this.elements.txtSettingsUserData.value = info.userDataPath;
      if (this.elements.txtSettingsFfmpeg) this.elements.txtSettingsFfmpeg.value = info.ffmpegPath;
    } catch (error) {
      console.error('Failed to load app info:', error);
    }
  }
  
  async startRecordingFlow() {
    if (!this.savePath) {
      this.showView('settings');
      this.showToast('请先设置保存路径', true);
      return;
    }
    this.showView('recording');
    this.resetRecordingState();
    await this.loadCameras();
    
    if (this.elements.selectCamera.value) {
      await this.startCameraPreview(this.elements.selectCamera.value);
    } else {
      await this.startCameraPreview();
    }
  }
  
  confirmBack() {
    if (this.isRecording) {
      if (confirm('确定要取消录制吗？录制内容将不会被保存。')) {
        this.cancelRecording();
      }
    } else {
      this.stopCameraPreview().then(() => {
        this.showView('home');
      });
    }
  }
  
  async cancelRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.stopRecordingLogic();
    await this.stopCameraPreview();
    this.resetRecordingState();
    this.showView('home');
  }
  
  async loadRecordings() {
    try {
      this.recordings = await window.electronAPI.getRecordings();
      this.selectedRecordingIds = []; // Clear selection
      this.updateBatchExportButton();
      this.renderRecordings();
    } catch (error) {
      console.error('Failed to load recordings:', error);
      this.renderRecordings();
    }
  }
  
  renderRecordings() {
    if (this.recordings.length === 0) {
      this.elements.recordingsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📹</div>
          <p>暂无录制文件</p>
          <p class="empty-hint">点击"新增录制"开始录制第一个视频</p>
        </div>
      `;
      return;
    }
    
    this.elements.recordingsList.innerHTML = this.recordings.map(r => this.createRecordingCard(r)).join('');
    
    this.recordings.forEach(r => {
      const card = this.elements.recordingsList.querySelector(`[data-id="${r.id}"]`);
      if (card) {
        card.querySelector('.btn-play')?.addEventListener('click', () => this.playRecording(r));
        card.querySelector('.btn-delete')?.addEventListener('click', () => this.deleteRecording(r));
        card.querySelector('.btn-open-folder')?.addEventListener('click', () => this.openFileLocation(r.file_path));
        
        const checkbox = card.querySelector('.recording-checkbox');
        if (checkbox) {
          checkbox.addEventListener('change', (e) => this.handleRecordingSelection(r.id, e.target.checked));
        }
      }
    });
  }
  
  createRecordingCard(recording) {
    const sizeMB = (recording.file_size / (1024 * 1024)).toFixed(2);
    // Use ISO string for consistency or a fixed locale if needed, but toLocaleString should work.
    // Issue might be timezone offset. Let's try explicit formatting.
    const date = new Date(recording.created_at);
    // Adjust for timezone if created_at is UTC but treated as local, or vice versa.
    // Usually DB stores as string. If it's "YYYY-MM-DD HH:mm:ss", Date.parse assumes local.
    // If it's ISO with Z, it's UTC.
    // Let's assume standard local string display.
    const createdAt = date.toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
    
    const duration = recording.duration ? this.formatDuration(recording.duration) : '--:--:--';
    
    return `
      <div class="recording-card" data-id="${recording.id}">
        <div class="card-header">
          <div class="recording-checkbox-container">
            <input type="checkbox" class="recording-checkbox" data-id="${recording.id}">
          </div>
          <span class="card-title">${recording.filename}</span>
          <span class="card-status completed">
            <span class="status-dot"></span>
            ${duration}
          </span>
        </div>
        <div class="card-body">
          <div class="card-info">
            <div class="card-info-item">
              <span>创建时间</span>
              <span>${createdAt}</span>
            </div>
            <div class="card-info-item">
              <span>文件大小</span>
              <span class="file-size">${sizeMB} MB</span>
            </div>
          </div>
          
          <div class="card-actions">
            <button class="btn btn-primary btn-play" data-id="${recording.id}">播放</button>
            <button class="btn btn-secondary btn-open-folder" data-id="${recording.id}">打开位置</button>
            <button class="btn btn-danger btn-delete" data-id="${recording.id}">删除</button>
          </div>
        </div>
      </div>
    `;
  }
  
  handleRecordingSelection(id, isSelected) {
    if (isSelected) {
      if (!this.selectedRecordingIds.includes(id)) {
        this.selectedRecordingIds.push(id);
      }
    } else {
      this.selectedRecordingIds = this.selectedRecordingIds.filter(rid => rid !== id);
    }
    this.updateBatchExportButton();
  }
  
  updateBatchExportButton() {
    this.elements.btnBatchExport.disabled = this.selectedRecordingIds.length === 0;
  }
  
  showExportModal() {
    this.elements.modalExport.classList.remove('hidden');
  }
  
  hideExportModal() {
    this.elements.modalExport.classList.add('hidden');
  }
  
  startBatchExport() {
    const config = {
      mode: this.elements.exportMode.value,
      resolution: this.elements.exportResolution.value,
      bitrate: this.elements.exportBitrate.value,
      fps: this.elements.exportFps.value,
      codec: this.elements.exportCodec.value
    };
    
    window.electronAPI.startTranscodingBatch({
      recordingIds: [...this.selectedRecordingIds],
      config
    });
    
    this.hideExportModal();
    this.showToast(config.mode === 'merge' ? '合并任务已开始' : '压缩任务已开始');
    
    // Clear selection
    this.selectedRecordingIds = [];
    document.querySelectorAll('.recording-checkbox').forEach(cb => cb.checked = false);
    this.updateBatchExportButton();
    
    // Switch to tasks view
    this.showView('tasks');
  }
  
  async loadTasks() {
    try {
      this.compressionTasks = await window.electronAPI.getCompressionTasks();
      this.renderTasks();
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  }
  
  renderTasks() {
    if (!this.elements.tasksList) return;
    
    let filteredTasks = this.compressionTasks;
    if (this.currentTaskFilter !== 'all') {
      filteredTasks = this.compressionTasks.filter(t => {
        if (this.currentTaskFilter === 'processing') return t.status === 'processing' || t.status === 'pending';
        return t.status === this.currentTaskFilter;
      });
    }
    
    if (filteredTasks.length === 0) {
      this.elements.tasksList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📉</div>
          <p>暂无${this.currentTaskFilter === 'all' ? '' : '此状态的'}压缩任务</p>
        </div>
      `;
      return;
    }
    
    this.elements.tasksList.innerHTML = filteredTasks.map(task => this.createTaskCard(task)).join('');
    
    // Bind events
    filteredTasks.forEach(task => {
      const card = this.elements.tasksList.querySelector(`[data-task-id="${task.id}"]`);
      if (card) {
        if (task.status === 'completed') {
          card.querySelector('.btn-open-folder')?.addEventListener('click', () => this.openFileLocation(task.output_path));
          card.querySelector('.btn-play-task')?.addEventListener('click', () => this.playTaskVideo(task));
        }
        card.querySelector('.btn-delete-task')?.addEventListener('click', () => this.deleteTask(task));
      }
    });
  }
  
  createTaskCard(task) {
    const statusText = {
      'pending': '等待中',
      'processing': '压缩中',
      'completed': '已完成',
      'failed': '失败'
    }[task.status] || task.status;
    
    // Get output filename from path
    // Handle both Windows (\) and Unix (/) paths
    const outputFilename = task.output_path 
      ? task.output_path.split(/[/\\]/).pop() 
      : (task.config.isMerge ? `合并任务 (${task.config.count} 个视频)` : task.source_filename);
    
    const date = new Date(task.created_at);
    const createdAt = date.toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });

    const configSummary = `${task.config.resolution}, ${task.config.bitrate}, ${task.config.fps}fps, ${task.config.codec === 'h265' ? 'H.265' : 'H.264'}`;
    const outputSize = task.output_size ? ` • ${(task.output_size / (1024 * 1024)).toFixed(2)} MB` : '';
    
    let progressHtml = '';
    if (task.status === 'processing') {
      progressHtml = `
        <div class="task-progress-bar">
          <div class="task-progress-fill" style="width: ${task.progress}%" id="task-progress-${task.id}"></div>
        </div>
      `;
    }
    
    let actionHtml = '';
    if (task.status === 'completed') {
      actionHtml = `
        <button class="btn btn-primary btn-play-task" style="font-size: 12px; padding: 4px 10px; margin-right: 8px;">播放</button>
        <button class="btn btn-secondary btn-open-folder" style="font-size: 12px; padding: 4px 10px; margin-right: 8px;">打开位置</button>
        <button class="btn btn-danger btn-delete-task" style="font-size: 12px; padding: 4px 10px;">删除</button>
      `;
    } else if (task.status === 'failed' || task.status === 'pending') {
      actionHtml = `
        <button class="btn btn-danger btn-delete-task" style="font-size: 12px; padding: 4px 10px;">删除</button>
      `;
    }
    
    return `
      <div class="task-card" data-task-id="${task.id}">
        <div class="task-header">
          <span class="task-title" title="${task.output_path}">${outputFilename}</span>
          <span class="task-status ${task.status}">${statusText}${outputSize}</span>
        </div>
        <div class="task-info">
          <span>${configSummary}</span>
          <span>${createdAt}</span>
        </div>
        ${progressHtml}
        <div class="task-actions">
          ${actionHtml}
        </div>
      </div>
    `;
  }
  
  async deleteTask(task) {
    const confirmDelete = confirm('确定要删除此压缩任务吗？\n(如果文件存在，将会一并删除)');
    if (!confirmDelete) return;
    
    try {
      await window.electronAPI.deleteCompressionTask({
        id: task.id,
        deleteFile: true
      });
      this.loadTasks();
      this.showToast('任务已删除');
    } catch (error) {
      console.error('Failed to delete task:', error);
      this.showToast('删除失败', true);
    }
  }

  async playTaskVideo(task) {
    try {
      const fileExists = await window.electronAPI.checkFileExists(task.output_path);
      if (!fileExists) {
        this.showToast('文件不存在', true);
        return;
      }
      
      const buffer = await window.electronAPI.readRecordingFile(task.output_path);
      const blob = new Blob([buffer], { type: 'video/mp4' }); // Assuming mp4 usually
      const url = URL.createObjectURL(blob);
      
      const outputFilename = task.output_path 
        ? task.output_path.split(/[/\\]/).pop() 
        : (task.config.isMerge ? `合并视频 (${task.config.count} clips)` : task.source_filename);
        
      this.elements.playerTitle.textContent = outputFilename;
      this.elements.videoPlayer.src = url;
      this.showView('player');
    } catch (error) {
      console.error('Failed to play task video:', error);
      this.showToast('无法播放视频', true);
    }
  }
  
  updateTaskProgress(taskId, progress) {
    const bar = document.getElementById(`task-progress-${taskId}`);
    if (bar) {
      bar.style.width = `${progress}%`;
    }
    // Also update status text if needed?
    // Since we re-render on completion/update, this is just for smooth animation.
  }
  
  updateTranscodingProgress(id, progress, status) {
    // Deprecated for home view, but keeping method to avoid errors if called
  }
  
  updateTranscodingComplete(id, outputPath, newSize) {
    // Deprecated for home view
  }
  
  updateTranscodingError(id) {
    // Deprecated for home view
  }

  formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  
  async playRecording(recording) {
    try {
      const fileExists = await window.electronAPI.checkFileExists(recording.file_path);
      if (!fileExists) {
        this.showToast('文件不存在', true);
        return;
      }
      
      const buffer = await window.electronAPI.readRecordingFile(recording.file_path);
      const blob = new Blob([buffer], { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      
      this.elements.playerTitle.textContent = recording.filename;
      this.elements.videoPlayer.src = url;
      this.showView('player');
    } catch (error) {
      console.error('Failed to play recording:', error);
      this.showToast('无法播放视频', true);
    }
  }
  
  async deleteRecording(recording) {
    if (!confirm(`确定要删除 "${recording.filename}" 吗？`)) {
      return;
    }
    
    try {
      await window.electronAPI.deleteRecordingFile({
        filePath: recording.file_path,
        id: recording.id
      });
      this.loadRecordings();
      this.showToast('文件已删除');
    } catch (error) {
      this.showToast(`删除失败: ${error.message}`, true);
    }
  }
  
  async openFileLocation(filePath) {
    const success = await window.electronAPI.openFileLocation(filePath);
    if (!success) {
      this.showToast('文件不存在', true);
    }
  }
  
  async startCameraPreview(deviceId) {
    try {
      this.showToast('正在打开摄像头...');
      
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
      }
      
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: true
      });
      
      this.elements.videoPreview.srcObject = this.mediaStream;
      this.showToast('预览已开启');
      
      const firstOption = this.elements.selectCamera.options[0];
      if (!firstOption || firstOption.textContent.startsWith('摄像头')) {
         await this.loadCameras();
      }
      
    } catch (error) {
      console.error('Camera preview error:', error);
      this.showToast('无法打开摄像头: ' + error.message, true);
    }
  }
  
  async switchCamera(deviceId) {
    if (this.currentView === 'recording' && !this.isRecording) {
      await this.startCameraPreview(deviceId);
    }
  }
  
  async stopCameraPreview() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.elements.videoPreview.srcObject = null;
  }
  
  async startRecording() {
    if (!this.savePath) {
      this.showToast('请先设置保存路径', true);
      return;
    }
    
    try {
      this.showToast('正在开始录制...');
      
      this.recordedChunks = [];
      const cameraName = this.elements.selectCamera.options[this.elements.selectCamera.selectedIndex]?.text || '默认摄像头';
      
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'video/webm;codecs=vp9'
      });
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        this.currentRecordingData = {
          blob,
          cameraName,
          timestamp: Date.now()
        };
        this.stopRecordingLogic();
        this.showToast('录制完成');
        // Automatically save logic is handled in saveRecording now if triggered manually
        // But wait, the flow is: User clicks Save -> we stop -> onstop -> we save.
        // So we need to trigger the save process from here? 
        // No, 'saveRecording' calls 'stop' then waits for this event?
        // Actually, 'mediaRecorder.stop()' is async in terms of event firing.
        // So we need a way to know if we should save.
        // Let's call saveInternal() directly from here if a flag is set?
        // Or simpler: make saveRecording async wait for the stop event?
        // Simplest: The user clicks "Save", we call stop, and in onstop we enable a "Ready to Save" state?
        // No, user wants "Click Save -> Saves".
        // So:
        if (this.isSaving) {
             this.performSave();
        }
      };
      
      this.mediaRecorder.start(1000);
      
      this.isRecording = true;
      this.isPaused = false;
      this.isSaving = false; // Reset saving flag
      this.recordingStartTime = Date.now();
      this.totalPausedTime = 0;
      this.startTimer();
      this.updateUIState();
      this.showToast('录制中');
      this.elements.recordingIndicator.classList.remove('hidden');
      this.elements.recordingStatusIndicator.classList.add('active', 'pulse');
      this.elements.recordingStatusText.textContent = '录制中';
      
    } catch (error) {
      this.showToast(`录制失败: ${error.message}`, true);
      console.error('Recording error:', error);
    }
  }
  
  pauseRecording() {
    if (this.isRecording && !this.isPaused && this.mediaRecorder) {
      this.mediaRecorder.pause();
      this.isPaused = true;
      this.pausedAt = Date.now();
      this.stopTimer();
      this.updateUIState();
      this.showToast('已暂停');
      this.elements.recordingStatusIndicator.classList.remove('pulse');
      this.elements.recordingStatusText.textContent = '已暂停';
    }
  }
  
  resumeRecording() {
    if (this.isRecording && this.isPaused && this.mediaRecorder) {
      this.mediaRecorder.resume();
      this.isPaused = false;
      this.totalPausedTime += Date.now() - this.pausedAt;
      this.pausedAt = null;
      this.startTimer();
      this.updateUIState();
      this.showToast('录制中...');
      this.elements.recordingStatusIndicator.classList.add('pulse');
      this.elements.recordingStatusText.textContent = '录制中';
    }
  }
  
  stopRecordingLogic() {
    this.isRecording = false;
    this.isPaused = false;
    this.stopTimer();
    this.updateUIState();
  }
  
  handleSaveClick() {
      // User clicked save. 
      // If recording or paused, we need to stop first.
      if (this.isRecording) {
          this.isSaving = true;
          this.mediaRecorder.stop();
          // The onstop handler will call performSave()
      }
  }
  
  async performSave() {
    if (!this.currentRecordingData) return;
    
    try {
      this.showToast('正在保存...');
      
      const { blob, cameraName, timestamp } = this.currentRecordingData;
      const date = new Date(timestamp);
      const dateStr = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `recording_${dateStr}.webm`;
      
      const buffer = await blob.arrayBuffer();
      
      const result = await window.electronAPI.saveRecordingFile({
        buffer,
        savePath: this.savePath,
        filename
      });
      
      const duration = Math.floor((Date.now() - this.recordingStartTime - this.totalPausedTime) / 1000);
      
      await window.electronAPI.addRecording({
        filename,
        filePath: result.filePath,
        cameraName,
        resolution: '1280x720',
        frameRate: 30,
        duration,
        fileSize: result.fileSize,
        status: 'completed'
      });
      
      this.currentRecordingData = null;
      this.isSaving = false;
      this.elements.btnSave.style.display = 'none';
      await this.stopCameraPreview();
      this.resetRecordingState();
      this.showView('home');
      this.showToast('录像已保存');
      
    } catch (error) {
      this.showToast(`保存失败: ${error.message}`, true);
      console.error('Save error:', error);
      this.isSaving = false;
    }
  }
  
  startTimer() {
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.recordingStartTime - this.totalPausedTime) / 1000);
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;
      this.elements.txtRecordingTime.textContent = 
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
  }
  
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
  
  updateUIState() {
    const recording = this.isRecording;
    const paused = this.isPaused;
    
    this.elements.btnStart.disabled = recording;
    this.elements.btnPause.disabled = !recording || paused;
    this.elements.btnResume.disabled = !recording || !paused;
    this.elements.selectCamera.disabled = recording;
    
    // Save button visibility logic:
    // Show only when paused (as per user request "whenever paused, can click save")
    // Or should it be visible during recording too? User said "remove stop button, just click save when paused".
    // I will show it when paused.
    if (paused) {
        this.elements.btnSave.style.display = 'block';
    } else {
        this.elements.btnSave.style.display = 'none';
    }
  }
  
  showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = isError ? 'toast error' : 'toast';
    toast.textContent = message;
    
    this.elements.toastContainer.appendChild(toast);
    
    // Remove after animation
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  resetRecordingState() {
    this.isRecording = false;
    this.isPaused = false;
    this.recordingStartTime = null;
    this.pausedAt = null;
    this.totalPausedTime = 0;
    this.currentRecordingData = null;
    this.stopTimer();
    this.elements.txtRecordingTime.textContent = '00:00:00';
    this.elements.recordingIndicator.classList.add('hidden');
    this.elements.recordingStatusIndicator.classList.remove('active', 'pulse');
    this.elements.recordingStatusText.textContent = '准备录制';
    this.elements.btnSave.style.display = 'none';
    this.updateUIState();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new RecordingApp();
});