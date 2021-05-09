<template>
  <button @click="$emit('click')">
    <img :src="imgUrl" height="100" width="200" />
    <div class="prompt">
      <slot></slot>
    </div>
  </button>
</template>
<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

@Component({})
export default class MenuCard extends Vue {
  @Prop({default: "review.svg"}) image!: string;
  
  get imgUrl(): string {
    return require('@/assets/menu-images/' + this.image);
  }
}
</script>
<style scoped>
button {
  font-family: 'Poppins', sans-serif;
  font-weight: 400;
  font-size: 24px;
  letter-spacing: 0.75px;

  padding: 12px;

  color: var(--text-color);
  background-color: var(--primary-color);

  text-align: center;
  text-decoration: none;
  cursor: pointer;

  border:none;
  border-radius: 10px;

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
