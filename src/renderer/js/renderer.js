/**
 * RecordingApp - 录制应用主类
 * 负责管理整个应用的 UI 逻辑、状态控制和事件处理
 */
class RecordingApp {
  constructor() {
    // ============ 录制状态 ============
    this.isRecording = false;           // 是否正在录制
    this.isPaused = false;              // 是否暂停
    this.recordingStartTime = null;     // 录制开始时间
    this.pausedAt = null;               // 暂停开始时间
    this.totalPausedTime = 0;           // 累计暂停时间（毫秒）
    this.timerInterval = null;          // 定时器引用

    // ============ 数据存储 ============
    this.currentRecordingPath = null;   // 当前录制文件路径
    this.savePath = null;               // 视频保存路径
    this.compressionTasks = [];         // 压缩任务列表
    this.recordings = [];               // 录制文件列表
    this.selectedRecordingIds = [];     // 选中的录制文件 ID 数组
    this.currentTaskFilter = 'all';     // 当前任务筛选条件
    this.currentPlayerUrl = null;       // 当前播放视频的 Blob URL

    // ============ 视图状态 ============
    this.currentView = 'setup';         // 当前视图名称

    // ============ 摄像头和录制相关 ============
    this.defaultCameraId = null;        // 默认摄像头 ID
    this.mediaStream = null;            // 媒体流对象
    this.mediaRecorder = null;          // 媒体录制器
    this.recordedChunks = [];           // 录制的视频数据块
    this.currentRecordingData = null;   // 当前录制数据（保存时使用）

    // 初始化应用
    this.init();
  }

  /**
   * 初始化应用
   * 绑定元素、事件、IPC 通信，并检查初始化状态
   */
  init() {
    this.bindElements();
    this.bindEvents();
    this.bindIPC();
    this.checkSetup();
    this.startTaskPolling();
  }

  /**
   * 绑定 DOM 元素引用
   * 将 HTML 元素缓存到 this.elements 对象中，避免重复查询
   */
  bindElements() {
    this.elements = {
      // ============ 视图元素 ============
      viewSetup: document.getElementById('view-setup'),
      viewHome: document.getElementById('view-home'),
      viewSettings: document.getElementById('view-settings'),
      viewRecording: document.getElementById('view-recording'),
      viewPlayer: document.getElementById('view-player'),
      viewTasks: document.getElementById('view-tasks'),

      // ============ 头部和导航 ============
      headerActions: document.getElementById('header-actions'),
      btnSettings: document.getElementById('btn-settings'),
      btnTasks: document.getElementById('btn-tasks'),
      btnAddRecording: document.getElementById('btn-add-recording'),

      // ============ 设置页面 ============
      btnSetupSelectPath: document.getElementById('btn-setup-select-path'),
      btnSetupSave: document.getElementById('btn-setup-save'),
      txtSetupSavePath: document.getElementById('txt-setup-save-path'),
      btnSettingsSelectPath: document.getElementById('btn-settings-select-path'),
      txtSettingsSavePath: document.getElementById('txt-settings-save-path'),
      txtSettingsUserData: document.getElementById('txt-settings-user-data'),
      txtSettingsFfmpeg: document.getElementById('txt-settings-ffmpeg'),
      btnSettingsBack: document.getElementById('btn-settings-back'),

      // ============ 通用按钮 ============
      btnBack: document.getElementById('btn-back'),
      btnPlayerBack: document.getElementById('btn-player-back'),
      btnTasksBack: document.getElementById('btn-tasks-back'),
      btnSave: document.getElementById('btn-save'),

      // ============ 视频元素 ============
      videoPreview: document.getElementById('video-preview'),
      videoPlayer: document.getElementById('video-player'),

      // ============ 录制控制 ============
      btnStart: document.getElementById('btn-start'),
      btnPause: document.getElementById('btn-pause'),
      btnResume: document.getElementById('btn-resume'),
      txtRecordingTime: document.getElementById('txt-recording-time'),
      recordingStatusIndicator: document.getElementById('recording-status-indicator'),
      recordingStatusText: document.getElementById('recording-status-text'),
      recordingIndicator: document.getElementById('recording-indicator'),
      selectCamera: document.getElementById('select-camera'),

      // ============ 列表元素 ============
      recordingsList: document.getElementById('recordings-list'),
      tasksList: document.getElementById('tasks-list'),
      playerTitle: document.getElementById('player-title'),

      // ============ Tab 按钮 ============
      tabBtns: document.querySelectorAll('.tab-btn'),

      // ============ 任务筛选按钮 ============
      filterBtns: document.querySelectorAll('.filter-btn'),

      // ============ 批量导出相关 ============
      btnBatchExport: document.getElementById('btn-batch-export'),
      modalExport: document.getElementById('modal-export'),
      btnCloseModal: document.querySelector('.btn-close-modal'),
      btnExportCancel: document.getElementById('btn-export-cancel'),
      btnExportConfirm: document.getElementById('btn-export-confirm'),
      exportMode: document.getElementById('export-mode'),
      exportResolution: document.getElementById('export-resolution'),
      exportBitrate: document.getElementById('export-bitrate'),
      exportFps: document.getElementById('export-fps'),
      exportCodec: document.getElementById('export-codec'),

      // ============ 其他 ============
      toastContainer: document.getElementById('toast-container')
    };
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
  
  /**
   * 绑定事件监听器
   * 为所有 UI 元素添加点击、变更等事件处理
   */
  bindEvents() {
    // ============ 导航按钮 ============
    if (this.elements.btnSettings) {
      this.elements.btnSettings.addEventListener('click', () => this.showView('settings'));
    }
    if (this.elements.btnTasks) {
      this.elements.btnTasks.addEventListener('click', () => this.showView('tasks'));
    }
    if (this.elements.btnAddRecording) {
      this.elements.btnAddRecording.addEventListener('click', () => this.startRecordingFlow());
    }

    // ============ 设置页面 ============
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

    // ============ 返回按钮 ============
    if (this.elements.btnBack) {
      this.elements.btnBack.addEventListener('click', () => this.confirmBack());
    }
    if (this.elements.btnPlayerBack) {
      this.elements.btnPlayerBack.addEventListener('click', () => this.showView('home'));
    }
    if (this.elements.btnTasksBack) {
      this.elements.btnTasksBack.addEventListener('click', () => this.showView('home'));
    }

    // ============ 录制控制 ============
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

    // ============ Tab 导航 ============
    this.elements.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.showView(view);
      });
    });

    // ============ 任务筛选 ============
    this.elements.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTaskFilter = btn.dataset.filter;
        this.elements.filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderTasks();
      });
    });

    // ============ 批量导出 ============
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
  
  /**
   * 绑定 IPC 通信事件监听器
   * 监听来自主进程的压缩任务进度、完成、错误等事件
   */
  bindIPC() {
    // 监听压缩进度更新
    window.electronAPI.onCompressionProgress((event, { taskId, progress }) => {
      this.updateTaskProgress(taskId, progress);
    });

    // 监听压缩任务完成
    window.electronAPI.onCompressionComplete((event, { taskId }) => {
      this.loadTasks();
    });

    // 监听压缩任务错误
    window.electronAPI.onCompressionError((event, { taskId, error }) => {
      this.showToast(`任务失败: ${error}`, true);
      this.loadTasks();
    });

    // 监听任务列表更新（新增、删除等）
    window.electronAPI.onCompressionTaskUpdated(() => {
      this.loadTasks();
    });
  }

  /**
   * 启动任务列表轮询
   * 每 5 秒刷新一次任务列表，确保 UI 与后台任务同步
   */
  startTaskPolling() {
    setInterval(() => {
      if (this.currentView === 'tasks') {
        this.loadTasks();
      }
    }, 5000);
  }
  
  /**
   * 检查初始化状态
   * 从 localStorage 读取保存路径，决定显示设置页还是主页
   */
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

  /**
   * 切换视图
   * 隐藏所有视图，显示目标视图，并加载相应数据
   * @param {string} view - 目标视图名称
   */
  showView(view) {
    // 如果离开播放器视图，停止播放并释放资源
    if (this.currentView === 'player' && view !== 'player') {
      this.stopPlayer();
    }

    this.currentView = view;

    // 更新 Tab 按钮状态
    this.elements.tabBtns.forEach(btn => {
      if (btn.dataset.view === view) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 隐藏所有视图
    const views = ['viewSetup', 'viewHome', 'viewSettings', 'viewRecording', 'viewPlayer', 'viewTasks'];
    views.forEach(v => {
      if (this.elements[v]) {
        this.elements[v].classList.add('hidden');
      }
    });

    // 显示目标视图
    const viewEl = this.elements[`view${view.charAt(0).toUpperCase() + view.slice(1)}`];
    if (viewEl) {
      viewEl.classList.remove('hidden');
    }

    // 控制顶部操作栏显示/隐藏
    if (this.elements.headerActions) {
      if (view === 'recording' || view === 'setup') {
        this.elements.headerActions.style.display = 'none';
      } else {
        this.elements.headerActions.style.display = 'flex';
      }
    }

    // 根据视图加载相应数据
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

  /**
   * 停止视频播放器
   * 暂停播放、释放 Blob URL、清除视频源
   */
  stopPlayer() {
    if (this.elements.videoPlayer) {
      this.elements.videoPlayer.pause();
      this.elements.videoPlayer.currentTime = 0;
      if (this.currentPlayerUrl) {
        URL.revokeObjectURL(this.currentPlayerUrl);
        this.currentPlayerUrl = null;
      }
      this.elements.videoPlayer.src = '';
    }
  }
  
  /**
   * 加载可用摄像头列表
   * 获取系统摄像头设备，填充到下拉选择框
   */
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

        // 设置默认摄像头
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

  /**
   * 选择设置页的保存路径
   * 调用系统文件夹选择对话框
   */
  async selectSetupPath() {
    const path = await window.electronAPI.selectSavePath();
    if (path) {
      this.savePath = path;
      this.elements.txtSetupSavePath.value = path;
      this.elements.btnSetupSave.disabled = false;
    }
  }

  /**
   * 保存设置
   * 将保存路径保存到 localStorage，跳转到主页
   */
  async saveSetup() {
    if (this.savePath) {
      localStorage.setItem('savePath', this.savePath);
      this.showView('home');
      this.loadRecordings();
    }
  }

  /**
   * 设置页选择保存路径
   * 更改保存路径并更新显示
   */
  async selectSettingsPath() {
    const path = await window.electronAPI.selectSavePath();
    if (path) {
      this.savePath = path;
      localStorage.setItem('savePath', this.savePath);
      this.loadSettings();
      this.showToast('保存路径已更新');
    }
  }

  /**
   * 加载设置信息
   * 显示当前保存路径和应用信息
   */
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

  /**
   * 开始录制流程
   * 检查保存路径，切换到录制视图，启动摄像头预览
   */
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

  /**
   * 确认返回
   * 录制中询问是否取消，否则直接返回
   */
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

  /**
   * 取消录制
   * 停止录制，关闭摄像头，重置状态，返回主页
   */
  async cancelRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.stopRecordingLogic();
    await this.stopCameraPreview();
    this.resetRecordingState();
    this.showView('home');
  }
  
  /**
   * 加载录制文件列表
   * 从主进程获取录制文件数据
   */
  async loadRecordings() {
    try {
      this.recordings = await window.electronAPI.getRecordings();
      this.selectedRecordingIds = [];
      this.updateBatchExportButton();
      this.renderRecordings();
    } catch (error) {
      console.error('Failed to load recordings:', error);
      this.renderRecordings();
    }
  }

  /**
   * 渲染录制文件列表
   * 根据数据生成录制卡片列表，并绑定事件
   */
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

    // 为每个卡片绑定事件
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

  /**
   * 创建录制卡片 HTML
   * @param {Object} recording - 录制文件数据
   * @returns {string} 卡片 HTML 字符串
   */
  createRecordingCard(recording) {
    const sizeMB = (recording.file_size / (1024 * 1024)).toFixed(2);
    const date = new Date(recording.created_at);
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

  /**
   * 处理录制文件选择
   * @param {number} id - 录制文件 ID
   * @param {boolean} isSelected - 是否选中
   */
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

  /**
   * 更新批量导出按钮状态
   * 根据选中的文件数量启用/禁用按钮
   */
  updateBatchExportButton() {
    this.elements.btnBatchExport.disabled = this.selectedRecordingIds.length === 0;
  }

  /**
   * 显示导出配置弹窗
   */
  showExportModal() {
    this.elements.modalExport.classList.remove('hidden');
  }

  /**
   * 隐藏导出配置弹窗
   */
  hideExportModal() {
    this.elements.modalExport.classList.add('hidden');
  }

  /**
   * 开始批量导出
   * 获取配置，发送到主进程执行转码
   */
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

    this.selectedRecordingIds = [];
    document.querySelectorAll('.recording-checkbox').forEach(cb => cb.checked = false);
    this.updateBatchExportButton();

    this.showView('tasks');
  }
  
  /**
   * 加载压缩任务列表
   * 从主进程获取任务数据
   */
  async loadTasks() {
    try {
      this.compressionTasks = await window.electronAPI.getCompressionTasks();
      this.renderTasks();
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  }

  /**
   * 渲染压缩任务列表
   * 根据筛选条件过滤任务，生成任务卡片
   */
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

    // 为任务卡片绑定事件
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

  /**
   * 创建任务卡片 HTML
   * @param {Object} task - 任务数据对象
   * @returns {string} 任务卡片 HTML 字符串
   */
  createTaskCard(task) {
    const statusText = {
      'pending': '等待中',
      'processing': '压缩中',
      'completed': '已完成',
      'failed': '失败'
    }[task.status] || task.status;

    // 从路径提取输出文件名，处理 Windows 和 Unix 路径分隔符
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

    // 配置摘要信息
    const configSummary = `${task.config.resolution}, ${task.config.bitrate}, ${task.config.fps}fps, ${task.config.codec === 'h265' ? 'H.265' : 'H.264'}`;
    const outputSize = task.output_size ? ` • ${(task.output_size / (1024 * 1024)).toFixed(2)} MB` : '';

    // 进度条 HTML
    let progressHtml = '';
    if (task.status === 'processing') {
      progressHtml = `
        <div class="task-progress-bar">
          <div class="task-progress-fill" style="width: ${task.progress}%" id="task-progress-${task.id}"></div>
        </div>
      `;
    }

    // 操作按钮 HTML，根据任务状态显示不同按钮
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

  /**
   * 播放压缩任务生成的视频
   * @param {Object} task - 压缩任务对象
   */
  async playTaskVideo(task) {
    try {
      const fileExists = await window.electronAPI.checkFileExists(task.output_path);
      if (!fileExists) {
        this.showToast('文件不存在', true);
        return;
      }

      const buffer = await window.electronAPI.readRecordingFile(task.output_path);
      const blob = new Blob([buffer], { type: 'video/mp4' });
      this.currentPlayerUrl = URL.createObjectURL(blob);

      const outputFilename = task.output_path
        ? task.output_path.split(/[/\\]/).pop()
        : (task.config.isMerge ? `合并视频 (${task.config.count} clips)` : task.source_filename);

      this.elements.playerTitle.textContent = outputFilename;
      this.elements.videoPlayer.src = this.currentPlayerUrl;

      // 修复视频 duration 问题
      this.elements.videoPlayer.onloadedmetadata = () => {
        if (this.elements.videoPlayer.duration === Infinity || isNaN(this.elements.videoPlayer.duration)) {
          this.elements.videoPlayer.currentTime = 1e101;
          this.elements.videoPlayer.ontimeupdate = () => {
            this.elements.videoPlayer.ontimeupdate = null;
            this.elements.videoPlayer.currentTime = 0;
          };
        }
      };

      this.showView('player');
    } catch (error) {
      console.error('Failed to play task video:', error);
      this.showToast('无法播放视频', true);
    }
  }

  /**
   * 更新任务进度
   * @param {number} taskId - 任务 ID
   * @param {number} progress - 进度百分比
   */
  updateTaskProgress(taskId, progress) {
    const bar = document.getElementById(`task-progress-${taskId}`);
    if (bar) {
      bar.style.width = `${progress}%`;
    }
  }

  /**
   * 格式化时长
   * 将秒数转换为 HH:MM:SS 格式
   * @param {number} seconds - 时长（秒）
   * @returns {string} 格式化后的时长字符串
   */
  formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * 删除压缩任务
   * @param {Object} task - 要删除的任务对象
   */
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

  /**
   * 删除录制文件
   * @param {Object} recording - 要删除的录制对象
   */
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

  /**
   * 打开文件所在位置
   * @param {string} filePath - 文件路径
   */
  async openFileLocation(filePath) {
    const success = await window.electronAPI.openFileLocation(filePath);
    if (!success) {
      this.showToast('文件不存在', true);
    }
  }

  formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  
  /**
   * 播放录制视频
   * 读取文件、创建 Blob URL、在播放器中播放
   * @param {Object} recording - 录制文件数据
   */
  async playRecording(recording) {
    try {
      const fileExists = await window.electronAPI.checkFileExists(recording.file_path);
      if (!fileExists) {
        this.showToast('文件不存在', true);
        return;
      }

      const buffer = await window.electronAPI.readRecordingFile(recording.file_path);
      const blob = new Blob([buffer], { type: 'video/webm' });
      this.currentPlayerUrl = URL.createObjectURL(blob);

      this.elements.playerTitle.textContent = recording.filename;
      this.elements.videoPlayer.src = this.currentPlayerUrl;

      // 修复 WebM 文件 duration 为 Infinity 的问题
      this.elements.videoPlayer.onloadedmetadata = () => {
        if (this.elements.videoPlayer.duration === Infinity || isNaN(this.elements.videoPlayer.duration)) {
          this.elements.videoPlayer.currentTime = 1e101;
          this.elements.videoPlayer.ontimeupdate = () => {
            this.elements.videoPlayer.ontimeupdate = null;
            this.elements.videoPlayer.currentTime = 0;
          };
        }
      };

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
  
  /**
   * 启动摄像头预览
   * 获取媒体流并显示在预览窗口
   * @param {string} deviceId - 摄像头设备 ID
   */
  async startCameraPreview(deviceId) {
    try {
      this.showToast('正在打开摄像头...');

      // 停止之前的媒体流
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
      }

      // 获取新的媒体流（视频+音频）
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: true
      });

      this.elements.videoPreview.srcObject = this.mediaStream;
      this.showToast('预览已开启');

      // 如果摄像头选项还未加载，重新加载
      const firstOption = this.elements.selectCamera.options[0];
      if (!firstOption || firstOption.textContent.startsWith('摄像头')) {
         await this.loadCameras();
      }

    } catch (error) {
      console.error('Camera preview error:', error);
      this.showToast('无法打开摄像头: ' + error.message, true);
    }
  }

  /**
   * 切换摄像头
   * 仅在录制页面且未录制时允许切换
   * @param {string} deviceId - 新摄像头设备 ID
   */
  async switchCamera(deviceId) {
    if (this.currentView === 'recording' && !this.isRecording) {
      await this.startCameraPreview(deviceId);
    }
  }

  /**
   * 停止摄像头预览
   * 关闭所有媒体轨道
   */
  async stopCameraPreview() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.elements.videoPreview.srcObject = null;
  }

  /**
   * 开始录制
   * 创建 MediaRecorder，开始收集视频数据
   */
  async startRecording() {
    if (!this.savePath) {
      this.showToast('请先设置保存路径', true);
      return;
    }

    try {
      this.showToast('正在开始录制...');

      this.recordedChunks = [];
      const cameraName = this.elements.selectCamera.options[this.elements.selectCamera.selectedIndex]?.text || '默认摄像头';

      // 创建媒体录制器，使用 WebM 格式 + VP9 编码
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      // 数据可用时收集数据块
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      // 录制停止时处理数据
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        this.currentRecordingData = {
          blob,
          cameraName,
          timestamp: Date.now()
        };
        this.stopRecordingLogic();
        this.showToast('录制完成');
        // 如果是保存操作，自动执行保存
        if (this.isSaving) {
             this.performSave();
        }
      };

      // 每 1 秒触发一次 dataavailable 事件
      this.mediaRecorder.start(1000);

      // 更新录制状态
      this.isRecording = true;
      this.isPaused = false;
      this.isSaving = false;
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

  /**
   * 暂停录制
   */
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

  /**
   * 恢复录制
   */
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

  /**
   * 停止录制逻辑
   * 更新录制状态，停止计时器
   */
  stopRecordingLogic() {
    this.isRecording = false;
    this.isPaused = false;
    this.stopTimer();
    this.updateUIState();
  }

  /**
   * 处理保存按钮点击
   * 如果正在录制，停止录制并保存
   */
  handleSaveClick() {
    if (this.isRecording) {
      this.isSaving = true;
      this.mediaRecorder.stop();
    }
  }

  /**
   * 执行保存操作
   * 将录制数据保存到磁盘，更新数据库
   */
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

  /**
   * 暂停录制
   */
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

  /**
   * 恢复录制
   */
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

  /**
   * 停止录制逻辑
   * 更新录制状态，停止计时器
   */
  stopRecordingLogic() {
    this.isRecording = false;
    this.isPaused = false;
    this.stopTimer();
    this.updateUIState();
  }

  /**
   * 处理保存按钮点击
   * 如果正在录制，停止录制并保存
   */
  handleSaveClick() {
    if (this.isRecording) {
      this.isSaving = true;
      this.mediaRecorder.stop();
    }
  }

  /**
   * 启动计时器
   * 每秒更新录制时间显示
   */
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

  /**
   * 停止计时器
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * 更新 UI 状态
   * 根据录制状态启用/禁用按钮
   */
  updateUIState() {
    const recording = this.isRecording;
    const paused = this.isPaused;

    this.elements.btnStart.disabled = recording;
    this.elements.btnPause.disabled = !recording || paused;
    this.elements.btnResume.disabled = !recording || !paused;
    this.elements.selectCamera.disabled = recording;

    if (paused) {
      this.elements.btnSave.style.display = 'block';
    } else {
      this.elements.btnSave.style.display = 'none';
    }
  }

  /**
   * 显示提示消息
   * @param {string} message - 消息内容
   * @param {boolean} isError - 是否为错误消息
   */
  showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = isError ? 'toast error' : 'toast';
    toast.textContent = message;

    this.elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  /**
   * 重置录制状态
   * 清除所有录制相关状态
   */
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