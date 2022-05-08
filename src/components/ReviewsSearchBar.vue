<template>
  <input
    :value="modelValue"
    placeholder="Search"
    @input="$emit('updateSearch', $event.target.value)"
  />
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'vue-property-decorator'

@Component({
  components: { },
})

export default class ReviewsSearchBar extends Vue {
    @Prop() modelValue = ""
}
</script>

<style scoped>
input {
    padding: 6px;
    border: 1em black;
    font-size: 17px;
    width: 50%;
    border-radius: 4px;
}
</style>
