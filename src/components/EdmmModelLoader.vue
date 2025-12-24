<script setup lang="ts">
import { ref } from 'vue';
import { EdmmDeploymentModel, parseAndValidateEdmm } from '~/lib/io';

const model = ref<EdmmDeploymentModel | null>(null);
const errorMessage = ref<string | null>(null);
const loading = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }

  loading.value = true;
  errorMessage.value = null;
  model.value = null;

  try {
    const contents = await file.text();
    console.log('contents', contents);
    const result = parseAndValidateEdmm(contents);

    if (result.success && result.data) {
      model.value = result.data;
    } else {
      errorMessage.value = result.errors?.join(' | ') ?? 'Model failed to validate';
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
  }
}

onMounted(async () => {
  if (import.meta.env.VITE_APP_USE_TEST_YAML) {
    const testYaml = (await import('@/assets/edmm-models/otelshopAnsible_expected.yaml?raw')).default;
    const result = parseAndValidateEdmm(testYaml);
    if (result.success && result.data) {
      model.value = result.data;
    } else {
      errorMessage.value = result.errors?.join(' | ') ?? 'Model failed to validate';
    }
  }
});
</script>

<template>
    <label v-if="!model">
      <input
        ref="fileInputRef"
        type="file"
        accept=".yaml,.yml,.json"
        class="sr-only"
        @change="handleFileChange"
      />
      <span>Pick an EDMM YAML file</span>
    </label>

    <p v-if="loading">
      Loading model…
    </p>

    <p v-else-if="errorMessage">
      {{ errorMessage }}
    </p>

    <slot v-else-if="model" :model="model" />

    <p v-else>
      No model loaded yet.
    </p>
</template>

