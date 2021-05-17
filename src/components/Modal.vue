<template>
  <div class="mask">
    <div class="card">
      <slot></slot>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component({})
export default class Modal extends Vue {
  //TODO: Add customizable colours. Looks like all buttons are primary color for this sprint
}
</script>

<style scoped>
.mask {
  position: fixed;
  z-index: 9998;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  transition: opacity 0.3s ease;

  display: flex;
  justify-content: center;
  align-items: center;
}

.card {
  position: relative;
  background-color: var(--background-color);
  padding: 30px;
  height: 50%;
  width: 60%;
}
</style>