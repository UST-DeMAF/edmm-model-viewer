<script setup lang="ts">
import EdmmModelLoader from '~/components/EdmmModelLoader.vue';
import EdmmGraph from '~/components/EdmmGraph.vue';

</script>

<template>
  <EdmmModelLoader>
    <template #default="{model}">
      <EdmmGraph :model="model" />
    </template>
    </EdmmModelLoader>
</template>