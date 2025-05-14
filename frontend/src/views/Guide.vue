<template>
  <div class="bg-white shadow rounded-lg p-6">
    <h2 class="text-xl font-bold text-gray-900 mb-4">我的指南列表</h2>
    
    <div v-if="guides.length === 0" class="text-center py-8">
      <p class="text-gray-600">您还没有保存任何指南。</p>
      <router-link to="/capture" class="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        开始创建指南
      </router-link>
    </div>
    
    <div v-else>
      <div class="divide-y">
        <div v-for="(guide, index) in guides" :key="index" class="py-4">
          <div class="flex justify-between items-center">
            <div>
              <h3 class="text-lg font-medium">{{ guide.title }}</h3>
              <p class="text-sm text-gray-600">创建于: {{ formatDate(guide.createdAt) }}</p>
              <p class="text-sm text-gray-600">{{ guide.stepsCount }}个步骤</p>
            </div>
            <div class="flex space-x-2">
              <button @click="openGuide(guide.path)" class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                查看
              </button>
              <button @click="deleteGuide(index)" class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm">
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Guide',
  data() {
    return {
      guides: [
        {
          title: '如何使用Microsoft Word',
          path: '/path/to/guide1.html',
          createdAt: new Date('2023-04-10T14:30:00'),
          stepsCount: 8
        },
        {
          title: '网站导航流程',
          path: '/path/to/guide2.html',
          createdAt: new Date('2023-04-15T09:45:00'),
          stepsCount: 5
        }
      ]
    }
  },
  methods: {
    formatDate(date) {
      return new Date(date).toLocaleString();
    },
    
    openGuide(path) {
      // 在实际应用中，这将打开保存的指南文件
      alert(`打开指南: ${path}`);
    },
    
    deleteGuide(index) {
      if (confirm('确定要删除这个指南吗？')) {
        this.guides.splice(index, 1);
      }
    }
  }
}
</script> 