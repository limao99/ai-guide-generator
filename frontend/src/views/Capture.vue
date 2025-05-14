<template>
  <div>
    <div class="bg-white shadow rounded-lg p-6 mb-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold text-gray-900">屏幕捕获</h2>
        <div class="flex space-x-4">
          <button 
            @click="startRecording" 
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none"
            :disabled="isRecording">
            {{ isRecording ? '正在录制...' : '开始录制' }}
          </button>
          <button 
            @click="stopRecording" 
            class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none"
            :disabled="!isRecording">
            停止录制
          </button>
          <button 
            @click="generateGuide" 
            class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none" 
            :disabled="!hasScreenshots">
            生成指南
          </button>
        </div>
      </div>
      
      <!-- 全屏倒计时由Electron主进程负责，这里不需要额外显示 -->
      
      <!-- 录音状态提示 -->
      <div v-if="isRecordingVoice" class="fixed bottom-4 right-4 z-40">
        <div class="bg-white px-3 py-2 rounded-full shadow-lg flex items-center space-x-2">
          <div class="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
          <span class="text-xs">正在录音 ({{ recordingDuration }}秒) - 请说话...</span>
        </div>
      </div>
      
      <!-- 屏幕录制提示 -->
      <div v-if="isRecording" class="fixed top-4 left-1/2 transform -translate-x-1/2 z-30 bg-white px-4 py-2 rounded-full shadow-lg flex items-center space-x-2">
        <div class="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
        <span class="text-sm">录制中 - 点击屏幕需要讲解的位置并用语音描述</span>
      </div>
      
      <div class="mb-4">
        <div class="flex items-center mb-2">
          <span class="mr-2">语言：</span>
          <select v-model="language" class="px-2 py-1 border rounded">
            <option value="zh">中文</option>
            <option value="en">英文</option>
            <option value="ja">日文</option>
            <option value="ko">韩文</option>
          </select>
        </div>
        
        <div class="flex items-center mt-3">
          <input type="checkbox" id="minimize-option" v-model="minimizeOnRecording" class="mr-2" />
          <label for="minimize-option" class="text-sm text-gray-700">录制时显示悬浮控制面板</label>
        </div>
        
        <div class="flex items-center mt-2">
          <input type="checkbox" id="auto-capture" v-model="autoCapture" class="mr-2" />
          <label for="auto-capture" class="text-sm text-gray-700">开启自动捕获（点击时自动截图）</label>
        </div>
        
        <div class="flex items-center mt-2" v-if="!autoCapture">
          <input type="checkbox" id="interval-capture" v-model="intervalCapture" class="mr-2" />
          <label for="interval-capture" class="text-sm text-gray-700">开启定时截图</label>
          
          <select v-if="intervalCapture" v-model="captureInterval" class="ml-3 px-2 py-1 border rounded text-sm">
            <option value="5">每5秒</option>
            <option value="10">每10秒</option>
            <option value="15">每15秒</option>
            <option value="30">每30秒</option>
          </select>
        </div>
        
        <div class="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
          <p class="font-semibold mb-1">使用说明:</p>
          <ol class="list-decimal pl-5 space-y-1">
            <li>点击"开始录制"按钮开始全屏倒计时</li>
            <li>倒计时结束后，自动开始录制</li>
            <li v-if="autoCapture">每次鼠标点击时自动截图并录音</li>
            <li v-else-if="intervalCapture">每隔{{captureInterval}}秒自动截图并录音</li>
            <li v-else>按下<strong>空格键</strong>或<strong>回车键</strong>拍摄当前屏幕截图</li>
            <li>截图后会自动弹出语音录制提示</li>
            <li>语音会自动记录并关联到截图</li>
            <li>完成所有操作后，点击"停止录制"</li>
            <li>点击"生成指南"导出文档</li>
          </ol>
          <p class="mt-2 font-medium text-blue-800">提示: 录制开始后显示左侧小控制面板，鼠标移上去展开, 包含开始/停止/恢复窗口按钮</p>
        </div>
      </div>
    </div>
    
    <div v-if="screenshots.length > 0" class="bg-white shadow rounded-lg p-6">
      <h3 class="text-lg font-semibold mb-4">已捕获的截图 ({{ screenshots.length }})</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="(screenshot, index) in screenshots" :key="`screenshot-${index}-${screenshot.timestamp.getTime()}`" class="border rounded p-2">
          <div class="relative">
            <img :src="screenshot.url" :alt="`Screenshot ${index + 1}`" class="w-full h-auto mb-2" @error="handleImageError(index)" />
            <!-- 添加点击位置指示器 -->
            <div v-if="screenshot.clickPosition" class="absolute pointer-indicator" :style="getClickPositionStyle(screenshot)"></div>
          </div>
          <div class="mb-2">
            <div v-if="screenshot.voiceText" class="mb-2 p-2 bg-gray-100 rounded">
              <p class="font-semibold">语音转文字:</p>
              <p>{{ screenshot.voiceText }}</p>
            </div>
            <div v-if="screenshot.aiDescription" class="mb-2 p-2 bg-blue-50 rounded">
              <p class="font-semibold">AI 生成描述:</p>
              <p>{{ screenshot.aiDescription }}</p>
            </div>
            <textarea 
              v-model="screenshot.manualDescription" 
              rows="2" 
              class="w-full p-2 border rounded" 
              placeholder="添加额外描述...">
            </textarea>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-600 text-sm">{{ formatDate(screenshot.timestamp) }}</span>
            <button @click="removeScreenshot(index)" class="text-red-600 hover:text-red-800">
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else-if="!isRecording" class="bg-white shadow rounded-lg p-6 text-center">
      <p class="text-gray-600">点击"开始录制"按钮开始全局录屏。在录制过程中点击屏幕进行截图和语音录入。</p>
    </div>
  </div>
</template>

<style scoped>
.pointer-indicator {
  width: 40px;
  height: 40px;
  border: 3px solid red;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  box-shadow: 0 0 0 3px rgba(255,0,0,0.3);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: translate(-50%, -50%) scale(0.8); }
  50% { transform: translate(-50%, -50%) scale(1.2); }
  100% { transform: translate(-50%, -50%) scale(0.8); }
}
</style>

<script>
export default {
  name: 'Capture',
  data() {
    return {
      screenshots: [],
      isRecording: false,
      language: 'zh',
      isRecordingVoice: false,
      recordingDuration: 0,
      recordingInterval: null,
      currentScreenshotIndex: null,
      globalClickListener: null,
      autoCompleteVoiceTimeout: null,
      minimizeOnRecording: true,
      autoCapture: false,
      intervalCapture: false,
      captureInterval: '10',
      captureIntervalTimer: null
    }
  },
  computed: {
    hasScreenshots() {
      return this.screenshots.length > 0;
    }
  },
  mounted() {
    // 监听来自控制面板的事件
    window.electronAPI.onTriggerStartRecording(() => {
      if (!this.isRecording) {
        this.startRecording();
      }
    });
    
    window.electronAPI.onTriggerStopRecording(() => {
      if (this.isRecording) {
        this.stopRecording();
      }
    });
  },
  methods: {
    startRecording() {
      // 直接开始录制，倒计时由Electron主进程负责
      this.isRecording = true;
      
      // 移除旧的全局点击事件监听器（如果有）
      if (this.globalClickListener) {
        window.removeEventListener('click', this.globalClickListener);
      }
      
      // 添加键盘事件监听
      if (!this.autoCapture && !this.intervalCapture) {
        window.addEventListener('keydown', this.handleKeyDown);
      }
      
      // 添加点击事件监听（如果开启了自动捕获）
      if (this.autoCapture) {
        console.log('启用自动捕获模式 - 设置全局点击监听器');
        this.globalClickListener = this.handleGlobalClick.bind(this);
        window.addEventListener('click', this.globalClickListener);
      }
      
      // 如果开启了定时捕获，设置定时器
      if (this.intervalCapture && !this.autoCapture) {
        console.log(`启用定时捕获模式 - 每${this.captureInterval}秒`);
        this.startIntervalCapture();
      }
      
      // 通知主进程开始录制
      window.electronAPI.startScreenRecording().then(result => {
        if (!result.success) {
          this.isRecording = false;
          alert(`无法开始屏幕录制: ${result.error}`);
        }
      });
      
      // 通知Electron是否最小化窗口
      window.electronAPI.setMinimizeOnRecording(this.minimizeOnRecording);
    },
    stopRecording() {
      // 停止所有捕获活动
      if (this.captureIntervalTimer) {
        clearInterval(this.captureIntervalTimer);
        this.captureIntervalTimer = null;
      }
      
      // 移除事件监听器
      window.removeEventListener('keydown', this.handleKeyDown);
      if (this.globalClickListener) {
        window.removeEventListener('click', this.globalClickListener);
        this.globalClickListener = null;
      }
      
      // 停止录音（如果正在进行）
      if (this.isRecordingVoice) {
        this.stopVoiceRecording();
      }
      
      // 通知主进程停止录制
      window.electronAPI.stopScreenRecording().then(result => {
        this.isRecording = false;
        
        if (!result.success) {
          alert(`停止录制失败: ${result.error}`);
        }
      });
    },
    // 其他方法保持不变...
  }
}
</script> 