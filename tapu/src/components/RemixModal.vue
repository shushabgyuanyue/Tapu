<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ target: any }>();
const emit = defineEmits<{ close: []; submit: [file: File] }>();

const remixFile = ref<File | null>(null);
const remixPreview = ref('');

const onFileSelect = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file && file.type.startsWith('image/')) {
    remixFile.value = file;
    remixPreview.value = URL.createObjectURL(file);
  }
};

const handleClose = () => {
  if (remixPreview.value) URL.revokeObjectURL(remixPreview.value);
  emit('close');
};

const handleSubmit = () => {
  alert('二创功能即将上线，敬请期待！');
  handleClose();
};
</script>

<template>
  <div class="remix-mask" @click.self="handleClose">
    <div class="remix-modal">
      <div class="remix-header">
        <h3>二创 · 换成你的角色</h3>
        <button @click="handleClose" class="remix-close">&times;</button>
      </div>
      <div class="remix-body">
        <p class="remix-desc">
          上传一张你的角色图片，AI 将生成一段以你的角色为主角的视频。
        </p>
        <div class="remix-source" v-if="target">
          <img v-if="target.poster_url" :src="target.poster_url" class="remix-thumb" />
          <div v-else class="remix-thumb remix-thumb-empty"></div>
          <div class="remix-source-info">
            <span class="remix-source-label">原始视频</span>
            <span class="remix-source-title">{{ target.title }}</span>
          </div>
        </div>
        <div class="remix-upload">
          <label class="remix-upload-area" :class="{ 'has-file': remixFile }">
            <template v-if="!remixFile">
              <span class="remix-upload-icon">&#x1F415;</span>
              <span class="remix-upload-text">上传你的角色图片</span>
              <span class="remix-upload-hint">支持 PNG/JPG，建议正面透明背景</span>
            </template>
            <template v-else>
              <img :src="remixPreview" class="remix-preview-img" />
              <span class="remix-upload-change">点击更换</span>
            </template>
            <input type="file" accept="image/*" @change="onFileSelect" hidden />
          </label>
        </div>
        <button class="remix-submit" :disabled="!remixFile" @click="handleSubmit">生成二创视频</button>
        <p class="remix-notice">功能即将上线，当前仅预览界面</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.remix-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 20px;
}
.remix-modal {
  background: #fff; border-radius: 20px; width: 100%; max-width: 400px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15); overflow: hidden;
}
.remix-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 18px 22px; border-bottom: 1px solid #f0f0f0;
}
.remix-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
.remix-close { background: none; border: none; font-size: 24px; color: #999; cursor: pointer; }
.remix-body { padding: 20px 22px 24px; }
.remix-desc { font-size: 13px; color: #888; line-height: 1.6; margin: 0 0 16px; }
.remix-source {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; background: #f9f9f9; border-radius: 10px; margin-bottom: 16px;
}
.remix-thumb { width: 40px; height: 56px; border-radius: 6px; object-fit: cover; }
.remix-thumb-empty { background: linear-gradient(135deg, #f3e8ff, #e0d4ff); }
.remix-source-info { display: flex; flex-direction: column; }
.remix-source-label { font-size: 11px; color: #aaa; }
.remix-source-title { font-size: 13px; font-weight: 500; }
.remix-upload { margin-bottom: 16px; }
.remix-upload-area {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  border: 2px dashed #e0e0e0; border-radius: 14px;
  padding: 32px 20px; cursor: pointer; transition: all 0.15s; text-align: center;
}
.remix-upload-area:hover { border-color: #7c4dff; background: #faf8ff; }
.remix-upload-area.has-file { border-style: solid; padding: 12px; }
.remix-upload-icon { font-size: 36px; margin-bottom: 8px; }
.remix-upload-text { font-size: 14px; font-weight: 500; color: #333; }
.remix-upload-hint { font-size: 11px; color: #aaa; margin-top: 4px; }
.remix-preview-img { width: 100%; max-height: 200px; object-fit: contain; border-radius: 8px; }
.remix-upload-change { font-size: 12px; color: #7c4dff; margin-top: 6px; }
.remix-submit {
  width: 100%; padding: 12px; border: none; border-radius: 10px;
  background: linear-gradient(135deg, #7c4dff, #651fff); color: #fff;
  font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.15s;
}
.remix-submit:disabled { opacity: 0.4; cursor: not-allowed; }
.remix-notice { font-size: 11px; color: #bbb; text-align: center; margin: 10px 0 0; }
</style>
