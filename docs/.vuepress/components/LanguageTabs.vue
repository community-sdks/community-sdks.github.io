<template>
  <div class="lang-tabs">
    <div class="label">Language:</div>
    <div class="tabs">
      <a
        v-for="l in langs"
        :key="l"
        class="tab"
        :href="`/generated/${service}/${l}/`"
      >
        {{ l.toUpperCase() }}
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  service: string;
  langs: string[];
}>();
</script>

<style scoped>
.lang-tabs {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  margin: 16px 0 20px 0;
}

.label {
  font-weight: 600;
  opacity: 0.9;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tab {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  text-decoration: none;
  font-size: 14px;
}

.tab:hover {
  border-color: var(--c-brand);
}
</style>