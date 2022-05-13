<template>
  <button 
    class="text-2xl tracking-wide p-3 duration-150 rounded-xl filter hover:brightness-105 active:brightness-110" 
    :class="`bg-${bgColor}`" 
    @click="$emit('click')"
  >
    <img :src="imgUrl" class="h-24 w-48 mb-2" />
    <div class="prompt">
      <slot></slot>
    </div>
  </button>
</template>

<script lang="ts">
  import { Component, Prop, Vue } from 'vue-property-decorator';

  @Component({})
  export default class MenuCard extends Vue {
    @Prop({default: "review.svg"}) image!: string
    @Prop({default: "primary"}) bgColor!: string
    
    get imgUrl(): string {
      return require('@/assets/menu-images/' + this.image);
    }
  }
</script>
