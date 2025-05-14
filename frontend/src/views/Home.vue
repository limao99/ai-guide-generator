<template>
  <div class="bg-white shadow rounded-lg p-6">
    <h2 class="text-2xl font-bold text-gray-900 mb-4">欢迎使用屏幕捕获与AI指南生成器</h2>
    
    <div class="prose max-w-none">
      <p class="mb-4">这个应用程序可以帮助您：</p>
      <ul class="list-disc pl-5 mb-4">
        <li>捕获屏幕截图记录工作流程</li>
        <li>使用AI自动生成每一步的描述</li>
        <li>将截图和描述整合为完整的分步指南</li>
        <li>支持多种语言的指南生成</li>
      </ul>
      
      <p class="mb-6">开始使用非常简单，只需点击下方的"开始捕获"按钮！</p>
    </div>
    
    <div class="mt-6 flex justify-center">
      <router-link to="/capture" class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
        开始捕获
      </router-link>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Home'
}
</script> 