<template>
  <router-view :key="String($route.params.clubSlug)" />
</template>

<script setup lang="ts"></script>
