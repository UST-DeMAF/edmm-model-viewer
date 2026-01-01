<script setup lang="ts">
import TransformDialog from '@/components/dialogs/TransformDialog.vue'

const emit = defineEmits<{
  (e: 'transformationComplete', payload: { id: string, name: string }): void
}>()

function handleTransformationComplete(payload: { id: string, name: string }) {
  emit('transformationComplete', payload)
}
</script>

<template>
  <TransformDialog @transformation-complete="handleTransformationComplete" />
</template>
