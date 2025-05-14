<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-white shadow">
      <div class="max-w-7xl mx-auto py-4 px-4">
        <h1 class="text-2xl font-bold text-gray-900">屏幕捕获与AI指南生成器</h1>
        <nav class="mt-2">
          <div class="flex space-x-4">
            <router-link to="/" class="px-3 py-2 rounded-md text-sm font-medium" :class="$route.path === '/' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'">
              首页
            </router-link>
            <router-link to="/capture" class="px-3 py-2 rounded-md text-sm font-medium" :class="$route.path === '/capture' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'">
              屏幕捕获
            </router-link>
            <router-link to="/guide" class="px-3 py-2 rounded-md text-sm font-medium" :class="$route.path === '/guide' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'">
              查看指南
            </router-link>
          </div>
        </nav>
      </div>
    </header>

    <main class="max-w-7xl mx-auto py-6 px-4">
      <router-view />
    </main>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script> 