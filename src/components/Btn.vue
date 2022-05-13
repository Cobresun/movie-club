<template>
  <button 
    @click="$emit('click')" 
    class="font-bold text-base text-text tracking-wide bg-primary text-center cursor-pointer rounded-md duration-150 filter hover:brightness-110 active:brightness-105"
  >
    <div class="flex my-1 mx-2">
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