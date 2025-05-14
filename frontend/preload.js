const { contextBridge, ipcRenderer } = require('electron');

// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('electronAPI', {
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  takeScreenshotAtPosition: (position) => ipcRenderer.invoke('take-screenshot-at-position', position),
  getScreenshots: () => ipcRenderer.invoke('get-screenshots'),
  saveGuide: (data) => ipcRenderer.invoke('save-guide', data),
  startScreenRecording: () => ipcRenderer.invoke('start-screen-recording'),
  stopScreenRecording: () => ipcRenderer.invoke('stop-screen-recording'),
  startVoiceRecording: () => ipcRenderer.invoke('start-voice-recording'),
  stopVoiceRecording: () => ipcRenderer.invoke('stop-voice-recording'),
  cancelVoiceRecording: () => ipcRenderer.invoke('cancel-voice-recording'),
  generateAIDescription: (data) => ipcRenderer.invoke('generate-ai-description', data),
  setMinimizeOnRecording: (shouldMinimize) => ipcRenderer.invoke('set-minimize-on-recording', shouldMinimize),
  sendToMain: (channel, data) => ipcRenderer.send(channel, data),
  onTriggerStartRecording: (callback) => ipcRenderer.on('trigger-start-recording', callback),
  onTriggerStopRecording: (callback) => ipcRenderer.on('trigger-stop-recording', callback)
}); 