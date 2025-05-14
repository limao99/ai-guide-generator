const { app, BrowserWindow, ipcMain, dialog, protocol, desktopCapturer, globalShortcut, screen, Tray } = require('electron');
const path = require('path');
const fs = require('fs');
const screenshot = require('screenshot-desktop');
const Store = require('electron-store');
const url = require('url');
const { spawn } = require('child_process');
const axios = require('axios');
const FormData = require('form-data');
let prompt;
try {
  prompt = require('electron-prompt');
} catch (e) {
  console.log('electron-prompt模块未安装，将使用模拟数据');
}

// 设置中文显示
app.commandLine.appendSwitch('lang', 'zh-CN');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// 禁用硬件加速以减少GPU相关错误
app.disableHardwareAcceleration();

// 清除缓存
app.commandLine.appendSwitch('disable-http-cache');

// 初始化存储
const store = new Store();

let mainWindow;
let controlPanelWindow; // 控制面板窗口
let isRecording = false;
let recordingStream = null;
let voiceRecorder = null;
let tempVoiceFile = null;
let minimizeOnRecording = true; // 默认在录制时最小化窗口
let countdownWindow = null;
let tray = null; // 任务栏图标

// 创建浏览器窗口
function createWindow() {
  console.log('创建Electron窗口...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png') // 如果有图标的话
  });

  // 清除缓存
  mainWindow.webContents.session.clearCache();
  
  // 尝试连接到不同的开发服务器端口
  const tryPorts = [3000, 3001, 5173, 8080];
  let currentPortIndex = 0;
  
  const tryLoadURL = () => {
    const port = tryPorts[currentPortIndex];
    const url = `http://localhost:${port}`;
    console.log(`尝试加载URL: ${url}`);
    
    mainWindow.loadURL(url).catch(err => {
      console.error(`端口 ${port} 连接失败:`, err);
      currentPortIndex++;
      if (currentPortIndex < tryPorts.length) {
        console.log(`尝试下一个端口...`);
        tryLoadURL();
      } else {
        console.error('所有端口尝试均失败');
        mainWindow.loadURL('about:blank');
        mainWindow.webContents.executeJavaScript(`
          document.body.innerHTML = '<div style="padding: 20px; font-family: Arial; text-align: center;"><h2>连接到开发服务器失败</h2><p>请确保Vite服务器正在运行</p><p><button onclick="window.location.reload()">重试</button></p></div>';
        `);
      }
    });
  };
  
  tryLoadURL();
  
  // 打开开发工具
  mainWindow.webContents.openDevTools();
  
  // 处理加载失败的情况
  mainWindow.webContents.on('did-fail-load', () => {
    console.log('加载失败，尝试显示错误页面');
    mainWindow.loadURL('about:blank');
    mainWindow.webContents.executeJavaScript(`
      document.body.innerHTML = '<div style="padding: 20px; font-family: Arial; text-align: center;"><h2>连接到开发服务器失败</h2><p>请确保Vite服务器正在运行</p><p><button onclick="window.location.reload()">重试</button></p></div>';
    `);
  });

  // 当窗口关闭时触发
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// 创建小型控制面板
function createControlPanel() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  
  controlPanelWindow = new BrowserWindow({
    width: 40,
    height: 120,
    x: 0,
    y: Math.floor(height / 2) - 60,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // 加载控制面板HTML
  controlPanelWindow.loadURL(`data:text/html;charset=utf-8,
    <html>
    <head>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: transparent;
          overflow: hidden;
          font-family: Arial, sans-serif;
        }
        .control-panel {
          width: 40px;
          height: 120px;
          background-color: rgba(30, 30, 30, 0.7);
          border-radius: 0 8px 8px 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          transition: width 0.3s;
        }
        .control-panel:hover {
          width: 120px;
        }
        .btn {
          width: 100%;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: white;
          position: relative;
          overflow: hidden;
          transition: background-color 0.2s;
        }
        .btn:hover {
          background-color: rgba(60, 60, 60, 0.8);
        }
        .btn .icon {
          min-width: 40px;
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn .label {
          white-space: nowrap;
          font-size: 12px;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .control-panel:hover .btn .label {
          opacity: 1;
        }
        .start {
          background-color: rgba(39, 110, 241, 0.8);
        }
        .start:hover {
          background-color: rgba(39, 110, 241, 1);
        }
        .stop {
          background-color: rgba(220, 53, 69, 0.8);
        }
        .stop:hover {
          background-color: rgba(220, 53, 69, 1);
        }
        .restore {
          background-color: rgba(50, 50, 50, 0.8);
        }
        .restore:hover {
          background-color: rgba(70, 70, 70, 1);
        }
      </style>
    </head>
    <body>
      <div class="control-panel">
        <div class="btn start" id="startBtn">
          <div class="icon">▶</div>
          <div class="label">开始</div>
        </div>
        <div class="btn stop" id="stopBtn">
          <div class="icon">■</div>
          <div class="label">停止</div>
        </div>
        <div class="btn restore" id="restoreBtn">
          <div class="icon">↗</div>
          <div class="label">恢复窗口</div>
        </div>
      </div>
      <script>
        document.getElementById('startBtn').addEventListener('click', () => {
          window.electronAPI.sendToMain('control-panel-action', 'start');
        });
        document.getElementById('stopBtn').addEventListener('click', () => {
          window.electronAPI.sendToMain('control-panel-action', 'stop');
        });
        document.getElementById('restoreBtn').addEventListener('click', () => {
          window.electronAPI.sendToMain('control-panel-action', 'restore');
        });
      </script>
    </body>
    </html>
  `);

  // 绑定事件
  ipcMain.on('control-panel-action', (event, action) => {
    if (action === 'start' && !isRecording) {
      if (mainWindow) {
        mainWindow.webContents.send('trigger-start-recording');
      }
    } else if (action === 'stop' && isRecording) {
      if (mainWindow) {
        mainWindow.webContents.send('trigger-stop-recording');
      }
    } else if (action === 'restore') {
      if (mainWindow) {
        mainWindow.show();
      }
    }
  });

  controlPanelWindow.on('closed', () => {
    controlPanelWindow = null;
  });
}

// 当Electron完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
  console.log('Electron应用已准备就绪');
  
  // 注册自定义协议处理截图文件
  protocol.registerFileProtocol('screenshot', (request, callback) => {
    // 移除URL中的查询参数（如时间戳）
    let filePath = request.url.replace('screenshot://', '');
    const queryIndex = filePath.indexOf('?');
    if (queryIndex > -1) {
      filePath = filePath.substring(0, queryIndex);
    }
    
    console.log('正在加载截图:', filePath);
    
    try {
      // 检查文件是否存在
      if (fs.existsSync(filePath)) {
        callback({ path: filePath });
      } else {
        console.error('截图文件不存在:', filePath);
        callback({ error: -2 });
      }
    } catch (error) {
      console.error('加载截图失败:', error);
      callback({ error: -2 });
    }
  });
  
  createWindow();

  app.on('activate', function () {
    if (mainWindow === null) createWindow();
  });
});

// 当所有窗口关闭时退出应用
app.on('window-all-closed', function () {
  // 确保停止所有录制
  if (isRecording) {
    isRecording = false;
    if (recordingStream) {
      recordingStream = null;
    }
  }
  
  if (voiceRecorder) {
    // voiceRecorder.kill();
    voiceRecorder = null;
  }
  
  if (controlPanelWindow) {
    controlPanelWindow.close();
    controlPanelWindow = null;
  }
  
  if (process.platform !== 'darwin') app.quit();
});

// 获取应用的截图目录
const getScreenshotsDir = () => {
  const screenshotsDir = path.join(app.getPath('userData'), 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  return screenshotsDir;
};

// 获取语音录制目录
const getVoiceRecordingsDir = () => {
  const voiceDir = path.join(app.getPath('userData'), 'voice_recordings');
  if (!fs.existsSync(voiceDir)) {
    fs.mkdirSync(voiceDir, { recursive: true });
  }
  return voiceDir;
};

// 屏幕截图功能
ipcMain.handle('take-screenshot', async () => {
  try {
    const screenshotsDir = getScreenshotsDir();
    const filename = `screenshot-${Date.now()}.png`;
    const imagePath = path.join(screenshotsDir, filename);
    
    // 获取可用显示器列表
    const displays = screen.getAllDisplays();
    console.log(`系统有 ${displays.length} 个显示器`);
    
    // 获取主窗口位置
    const bounds = mainWindow ? mainWindow.getBounds() : null;
    console.log(`主窗口位置: x=${bounds?.x || 0}, y=${bounds?.y || 0}`);
    
    // 获取当前活跃窗口所在的显示器
    let currentScreen = screen.getPrimaryDisplay();
    
    if (mainWindow) {
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      
      for (const display of displays) {
        // 检查窗口中心点是否在此显示器内
        if (centerX >= display.bounds.x && 
            centerX <= display.bounds.x + display.bounds.width &&
            centerY >= display.bounds.y && 
            centerY <= display.bounds.y + display.bounds.height) {
          currentScreen = display;
          break;
        }
      }
    }
    
    console.log('将使用显示器:', currentScreen.id, '分辨率:', currentScreen.size.width, 'x', currentScreen.size.height);
    console.log('显示器位置:', currentScreen.bounds.x, currentScreen.bounds.y);
    
    // 截取整个屏幕，后续可考虑只截取应用窗口
    const imgBuffer = await screenshot();
    fs.writeFileSync(imagePath, imgBuffer);
    
    // 返回一个可通过自定义协议访问的URL
    const screenshotUrl = `screenshot://${imagePath}`;
    console.log('截图已保存:', imagePath);
    
    return {
      success: true,
      path: imagePath,
      url: screenshotUrl
    };
  } catch (error) {
    console.error('截图失败:', error);
    return { success: false, error: error.message };
  }
});

// 在指定位置截图 - 改进版本，实现点击选中功能
ipcMain.handle('take-screenshot-at-position', async (event, { x, y }) => {
  try {
    console.log('开始截图，点击位置:', x, y);
    
    // 确保窗口已经最小化
    if (minimizeOnRecording && mainWindow && !mainWindow.isMinimized()) {
      mainWindow.minimize();
      // 添加延迟确保窗口已完全最小化
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const screenshotsDir = getScreenshotsDir();
    const filename = `screenshot-${Date.now()}.png`;
    const imagePath = path.join(screenshotsDir, filename);
    
    console.log('截图将保存到:', imagePath);
    
    // 找到点击位置所在的显示器
    const displays = screen.getAllDisplays();
    let targetDisplay = null;
    
    for (const display of displays) {
      // 检查点击位置是否在此显示器内
      if (x >= display.bounds.x && 
          x <= display.bounds.x + display.bounds.width &&
          y >= display.bounds.y && 
          y <= display.bounds.y + display.bounds.height) {
        targetDisplay = display;
        break;
      }
    }
    
    // 如果没有找到匹配的显示器，使用主显示器
    if (!targetDisplay) {
      targetDisplay = screen.getPrimaryDisplay();
      console.log('未找到点击位置所在显示器，使用主显示器');
    }
    
    console.log(`捕获显示器: id=${targetDisplay.id}, 位置=(${targetDisplay.bounds.x},${targetDisplay.bounds.y}), 大小=${targetDisplay.size.width}x${targetDisplay.size.height}`);
    
    // 获取点击位置在显示器上的相对坐标
    const relativeX = x - targetDisplay.bounds.x;
    const relativeY = y - targetDisplay.bounds.y;
    
    // 使用desktopCapturer获取屏幕源
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: targetDisplay.size // 使用完整分辨率
    });
    
    // 找到当前显示器的屏幕源
    let matchingSource = null;
    for (const source of sources) {
      if (source.display_id && source.display_id === targetDisplay.id.toString()) {
        matchingSource = source;
        break;
      }
    }
    
    // 如果没有找到匹配的源，尝试使用尺寸匹配
    if (!matchingSource) {
      for (const source of sources) {
        if (source.thumbnail.getSize().width === targetDisplay.size.width &&
            source.thumbnail.getSize().height === targetDisplay.size.height) {
          matchingSource = source;
          break;
        }
      }
    }
    
    // 如果仍未找到，使用第一个源
    if (!matchingSource && sources.length > 0) {
      matchingSource = sources[0];
    }
    
    if (!matchingSource) {
      throw new Error('找不到匹配的屏幕源');
    }
    
    // 使用第三方库处理截图
    const nativeImage = matchingSource.thumbnail;
    const imageBuffer = nativeImage.toPNG();
    
    // 定义需要截取的区域尺寸（点击周围的矩形区域）
    const cropWidth = 500;   // 截图宽度
    const cropHeight = 400;  // 截图高度
    
    // 计算截图区域的左上角，确保不超出屏幕边界
    let cropX = Math.max(0, relativeX - cropWidth / 2);
    let cropY = Math.max(0, relativeY - cropHeight / 2);
    
    // 确保右边和下边不超出屏幕
    if (cropX + cropWidth > targetDisplay.size.width) {
      cropX = targetDisplay.size.width - cropWidth;
    }
    if (cropY + cropHeight > targetDisplay.size.height) {
      cropY = targetDisplay.size.height - cropHeight;
    }
    
    // 确保坐标不为负
    cropX = Math.max(0, cropX);
    cropY = Math.max(0, cropY);
    
    console.log(`截取区域: x=${cropX}, y=${cropY}, 宽=${cropWidth}, 高=${cropHeight}`);
    
    // 使用sharp库裁剪图像 (需要先安装: npm install sharp)
    // 使用临时文件存储原始截图
    const tempImagePath = path.join(screenshotsDir, `temp-${Date.now()}.png`);
    fs.writeFileSync(tempImagePath, imageBuffer);
    
    try {
      // 动态导入sharp库
      const sharp = require('sharp');
      
      // 裁剪图像
      await sharp(tempImagePath)
        .extract({ left: Math.round(cropX), top: Math.round(cropY), width: cropWidth, height: cropHeight })
        .toFile(imagePath);
      
      // 删除临时文件
      fs.unlinkSync(tempImagePath);
      
      console.log('裁剪图像成功');
    } catch (sharpError) {
      console.error('裁剪图像失败:', sharpError);
      // 如果裁剪失败，使用原始截图
      fs.copyFileSync(tempImagePath, imagePath);
      
      // 删除临时文件
      try { fs.unlinkSync(tempImagePath); } catch (e) {}
    }
    
    // 返回一个可通过自定义协议访问的URL
    const screenshotUrl = `screenshot://${imagePath}`;
    
    return {
      success: true,
      path: imagePath,
      url: screenshotUrl,
      position: { x, y },
      displayInfo: {
        id: targetDisplay.id,
        bounds: targetDisplay.bounds,
        size: targetDisplay.size,
        relativePosition: { x: relativeX, y: relativeY },
        cropRegion: { 
          x: cropX, 
          y: cropY, 
          width: cropWidth, 
          height: cropHeight 
        }
      }
    };
  } catch (error) {
    console.error('截图失败:', error);
    return { success: false, error: error.message };
  }
});

// 开始屏幕录制
ipcMain.handle('start-screen-recording', async () => {
  if (isRecording) {
    return { success: false, error: '已经在录制中' };
  }
  
  try {
    // 在当前屏幕上显示倒计时
    await showCountdown();
    
    isRecording = true;
    
    // 当开始录制时，显示控制面板而不是最小化窗口
    if (minimizeOnRecording && mainWindow) {
      if (!controlPanelWindow) {
        createControlPanel();
      }
      mainWindow.hide();
    }
    
    console.log('开始屏幕录制');
    
    return { success: true };
  } catch (error) {
    isRecording = false;
    console.error('开始屏幕录制失败:', error);
    return { success: false, error: error.message };
  }
});

// 添加倒计时显示功能
async function showCountdown() {
  return new Promise((resolve) => {
    // 获取活跃窗口所在的显示器
    const displays = screen.getAllDisplays();
    let targetDisplay = screen.getPrimaryDisplay();
    
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      
      for (const display of displays) {
        if (centerX >= display.bounds.x && 
            centerX <= display.bounds.x + display.bounds.width &&
            centerY >= display.bounds.y && 
            centerY <= display.bounds.y + display.bounds.height) {
          targetDisplay = display;
          break;
        }
      }
    }
    
    // 创建一个全屏倒计时窗口
    countdownWindow = new BrowserWindow({
      x: targetDisplay.bounds.x,
      y: targetDisplay.bounds.y,
      width: targetDisplay.size.width,
      height: targetDisplay.size.height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      fullscreen: true, // 强制全屏显示
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    // 加载倒计时HTML
    countdownWindow.loadURL('about:blank');
    countdownWindow.webContents.once('did-finish-load', () => {
      countdownWindow.webContents.insertCSS(`
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        body {
          display: flex;
          justify-content: center;
          align-items: center;
          background-color: rgba(0, 0, 0, 0.7);
          font-family: Arial, sans-serif;
          color: white;
        }
        .countdown-container {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
        }
        .countdown {
          font-size: 200px;
          font-weight: bold;
          text-shadow: 0 0 20px rgba(0, 0, 0, 0.8);
          animation: pulse 1s infinite alternate;
        }
        @keyframes pulse {
          from { transform: scale(0.8); }
          to { transform: scale(1.2); }
        }
      `);
      
      let count = 3;
      
      const updateCountdown = () => {
        countdownWindow.webContents.executeJavaScript(`
          document.body.innerHTML = '<div class="countdown-container"><div class="countdown">${count}</div></div>';
        `);
        
        count--;
        
        if (count >= 0) {
          setTimeout(updateCountdown, 1000);
        } else {
          // 倒计时结束，关闭窗口并继续
          countdownWindow.close();
          countdownWindow = null;
          resolve();
        }
      };
      
      updateCountdown();
    });
    
    countdownWindow.show();
  });
}

// 停止录制
ipcMain.handle('stop-screen-recording', () => {
  if (!isRecording) {
    return { success: false, error: '没有正在进行的录制' };
  }
  
  try {
    isRecording = false;
    console.log('停止屏幕录制');
    
    // 显示主窗口
    if (mainWindow) {
      mainWindow.show();
    }
    
    return { success: true };
  } catch (error) {
    console.error('停止录制失败:', error);
    return { success: false, error: error.message };
  }
});

// 开始语音录制
ipcMain.handle('start-voice-recording', async () => {
  try {
    const voiceDir = getVoiceRecordingsDir();
    tempVoiceFile = path.join(voiceDir, `voice-${Date.now()}.wav`);
    
    // 在实际应用中，这里应该使用第三方库进行录音
    // 例如，我们可以使用 node-microphone 或者其他录音库
    
    /* 
    实际录音代码示例，需要安装相应的NPM包：
    
    // 设置录音参数
    const audioConfig = {
      sampleRate: 16000,
      channelCount: 1,
      bitsPerSample: 16,
      fileType: 'wav'
    };
    
    // 启动录音
    recorder = new AudioRecorder(audioConfig);
    const audioStream = recorder.startRecording();
    
    // 将音频流保存到文件
    const fileStream = fs.createWriteStream(tempVoiceFile);
    audioStream.pipe(fileStream);
    
    // 处理可能的错误
    audioStream.on('error', (err) => {
      console.error('录音错误：', err);
    });
    */
    
    console.log('开始语音录制到:', tempVoiceFile);
    
    // 因为这只是一个演示，我们只是记录一下文件路径，没有实际录音
    // 在真实应用中，这里应该返回真实的录音状态
    
    return { success: true };
  } catch (error) {
    console.error('开始语音录制失败:', error);
    tempVoiceFile = null;
    return { success: false, error: error.message };
  }
});

// 停止语音录制
ipcMain.handle('stop-voice-recording', async () => {
  try {
    // 检查录音状态
    if (!tempVoiceFile) {
      console.error('没有正在进行的录音');
      return { success: false, error: '没有正在进行的录音' };
    }
    
    console.log('停止语音录制');
    console.log('录音文件路径:', tempVoiceFile);
    
    // 调用后端API进行语音识别
    try {
      // 创建FormData对象发送到后端进行语音识别
      const formData = new FormData();
      
      // 在实际应用中应该添加真实的录音文件
      // 这里我们使用时间戳作为占位符，实际应用中应替换为真实录音文件
      formData.append('timestamp', Date.now().toString());
      
      console.log('正在发送语音文件到后端API...');
      
      // 调用后端语音识别API
      const response = await axios.post('http://localhost:8080/api/speech-to-text', formData, {
        headers: {
          ...formData.getHeaders(),
          'Content-Type': 'multipart/form-data'
        },
        timeout: 15000 // 15秒超时
      });
      
      if (response.data && response.data.text) {
        console.log('语音识别成功:', response.data.text);
        return {
          success: true,
          path: tempVoiceFile,
          text: response.data.text
        };
      } else {
        throw new Error('语音识别服务返回无效响应');
      }
    } catch (apiError) {
      console.error('语音识别API调用失败:', apiError.message);
      
      // 使用用户输入对话框作为备选方案
      if (mainWindow) {
        try {
          // 无论是否有electron-prompt，都使用内置对话框
          const { BrowserWindow, ipcMain } = require('electron');
          const inputWindow = new BrowserWindow({
            parent: mainWindow,
            modal: true,
            width: 500,
            height: 250,
            webPreferences: {
              nodeIntegration: true,
              contextIsolation: false
            }
          });
          
          // 创建一个简单的HTML表单
          inputWindow.loadURL('data:text/html,' + encodeURIComponent(`
            <html>
            <head>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  padding: 20px;
                  display: flex;
                  flex-direction: column;
                  height: 100vh;
                  margin: 0;
                  box-sizing: border-box;
                }
                h3 {
                  margin-top: 0;
                  color: #333;
                }
                p {
                  margin-bottom: 15px;
                  color: #555;
                }
                textarea {
                  flex: 1;
                  padding: 8px;
                  margin-bottom: 15px;
                  border: 1px solid #ccc;
                  border-radius: 4px;
                  resize: none;
                }
                button {
                  padding: 8px 16px;
                  background: #4a86e8;
                  color: white;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                }
                button:hover {
                  background: #3a76d8;
                }
              </style>
            </head>
            <body>
              <h3>请输入语音内容</h3>
              <p>语音识别失败，请手动输入您想要描述的内容:</p>
              <textarea id="input" placeholder="请输入您的描述..."></textarea>
              <button onclick="submit()">确定</button>
              <script>
                function submit() {
                  const input = document.getElementById('input').value;
                  if (input.trim()) {
                    // 发送消息到主进程
                    window.close();
                    window.opener && window.opener.postMessage({ type: 'user-input', value: input }, '*');
                  }
                }
              </script>
            </body>
            </html>
          `));
          
          // 创建Promise等待用户输入
          return new Promise((resolve) => {
            // 设置超时
            const timeout = setTimeout(() => {
              inputWindow.close();
              resolve({
                success: true,
                path: tempVoiceFile,
                text: "请输入描述",
                isUserInput: true
              });
            }, 30000); // 30秒超时
            
            // 设置事件监听
            inputWindow.webContents.on('did-finish-load', () => {
              inputWindow.show();
              inputWindow.focus();
            });
            
            // 监听窗口关闭
            inputWindow.on('closed', () => {
              clearTimeout(timeout);
              // 如果直接关闭窗口，返回空描述
              resolve({
                success: true,
                path: tempVoiceFile,
                text: "请输入描述",
                isUserInput: true
              });
            });
            
            // 使用ipc监听来自渲染进程的消息
            ipcMain.once('user-voice-input', (event, text) => {
              clearTimeout(timeout);
              inputWindow.close();
              resolve({
                success: true,
                path: tempVoiceFile,
                text: text,
                isUserInput: true
              });
            });
          });
        } catch (dialogError) {
          console.error('显示输入对话框失败:', dialogError);
          return {
            success: true,
            path: tempVoiceFile,
            text: "请输入描述",
            isUserInput: true
          };
        }
      }
      
      // 如果对话框也失败，返回基本提示
      return {
        success: true,
        path: tempVoiceFile,
        text: "请输入描述",
        isUserInput: true
      };
    }
  } catch (error) {
    console.error('停止语音录制失败:', error);
    return { success: false, error: error.message };
  } finally {
    tempVoiceFile = null;
  }
});

// 取消语音录制
ipcMain.handle('cancel-voice-recording', async () => {
  try {
    console.log('取消语音录制');
    
    return { success: true };
  } catch (error) {
    console.error('取消语音录制失败:', error);
    return { success: false, error: error.message };
  } finally {
    tempVoiceFile = null;
  }
});

// 生成 AI 描述
ipcMain.handle('generate-ai-description', async (event, { imagePath, voiceText, language, previousDescriptions }) => {
  try {
    console.log('为截图生成 AI 描述:', imagePath);
    console.log('语音文本:', voiceText);
    console.log('语言:', language);
    
    // 创建FormData对象发送到后端
    const formData = new FormData();
    formData.append('image', fs.createReadStream(imagePath));
    formData.append('voiceText', voiceText || '');
    formData.append('language', language || 'zh');
    
    if (previousDescriptions && previousDescriptions.length > 0) {
      formData.append('context', JSON.stringify(previousDescriptions));
    }
    
    // 发送请求到后端API
    try {
      console.log('正在发送请求到后端API...');
      const response = await axios.post('http://localhost:8080/api/analysis/image', formData, {
        headers: {
          ...formData.getHeaders(),
          'Content-Type': 'multipart/form-data'
        },
        timeout: 60000 // 60秒超时
      });
      
      console.log('成功接收到API响应:', response.status);
      
      if (response.data && response.data.description) {
        return {
          success: true,
          description: response.data.description
        };
      } else {
        throw new Error('无效的API响应格式');
      }
    } catch (apiError) {
      console.error('API调用失败:', apiError);
      
      // 如果API调用失败，返回一个简单的通知，不使用模拟数据
      return {
        success: false,
        error: '无法生成AI描述，请检查后端服务是否正常运行',
        description: `无法通过AI分析此图像。请确保后端服务正常运行，或者手动添加描述。错误信息: ${apiError.message}`
      };
    }
  } catch (error) {
    console.error('生成 AI 描述失败:', error);
    return { 
      success: false, 
      error: error.message,
      description: '生成描述时发生错误，请手动添加描述。'
    };
  }
});

// 获取所有截图
ipcMain.handle('get-screenshots', async () => {
  try {
    const screenshotsDir = getScreenshotsDir();
    const files = fs.readdirSync(screenshotsDir);
    
    const screenshots = files
      .filter(file => file.endsWith('.png'))
      .map(file => {
        const filePath = path.join(screenshotsDir, file);
        const stats = fs.statSync(filePath);
        return {
          path: filePath,
          url: `screenshot://${filePath}`,
          filename: file,
          timestamp: stats.mtime
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return { success: true, screenshots };
  } catch (error) {
    console.error('获取截图失败:', error);
    return { success: false, error: error.message };
  }
});

// 保存指南文档
ipcMain.handle('save-guide', async (event, { title, content }) => {
  try {
    const options = {
      title: '保存指南',
      defaultPath: path.join(app.getPath('documents'), `${title || 'guide'}.html`),
      filters: [
        { name: 'HTML文件', extensions: ['html'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    };
    
    const { filePath } = await dialog.showSaveDialog(options);
    if (filePath) {
      fs.writeFileSync(filePath, content);
      return { success: true, path: filePath };
    }
    return { success: false, error: '用户取消了保存' };
  } catch (error) {
    console.error('保存指南失败:', error);
    return { success: false, error: error.message };
  }
});

// 设置是否在录制时最小化窗口
ipcMain.handle('set-minimize-on-recording', async (event, shouldMinimize) => {
  minimizeOnRecording = !!shouldMinimize;
  return { success: true, minimizeOnRecording };
}); 