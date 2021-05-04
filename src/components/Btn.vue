<template>
  <button @click="$emit('click')">
    <div class="prompt">
      <slot></slot>
    </div>
  </button>
</template>
<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component({})
export default class Btn extends Vue {
  //TODO: Add customizable colours. Looks like all buttons are primary color for this sprint
}
</script>
<style scoped>
button {
  font-family: 'Poppins', sans-serif;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.75px;

  color: var(--text-color);
  background-color: var(--primary-color);

  text-align: center;
  text-decoration: none;
  cursor: pointer;

  border:none;
  border-radius: 5px;

  transition-duration: 0.2s;
}

button:hover {
  filter: brightness(105%);
}

button:active {
  filter: brightness(110%);
}
.prompt {
  margin: 4px;
}
</style>