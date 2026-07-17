<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      v-if="includeAll"
      class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all"
      :class="
        !isDefined(modelValue)
          ? 'bg-primary text-white shadow-md shadow-primary/25'
          : 'bg-background/60 text-gray-400 hover:bg-gray-600/60 hover:text-white'
      "
      @click="emit('update:modelValue', undefined)"
    >
      All
    </button>
    <button
      v-for="member in members"
      :key="member.id"
      class="inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-medium transition-all"
      :class="
        modelValue === member.id
          ? 'bg-primary text-white shadow-md shadow-primary/25'
          : 'bg-background/60 text-gray-400 hover:bg-gray-600/60 hover:text-white'
      "
      @click="emit('update:modelValue', member.id)"
    >
      <v-avatar :src="member.image" :name="member.name" :size="24" />
      {{ member.name }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { isDefined } from "../../../../lib/checks/checks.js";

import VAvatar from "@/common/components/VAvatar.vue";

/** The subset of Member every caller has (some pass computed entries, not
 * full club members). */
interface ChipMember {
  id: string;
  name: string;
  image?: string;
}

withDefaults(
  defineProps<{
    members: ChipMember[];
    modelValue: string | undefined;
    /** Show the "All" chip that clears the selection. */
    includeAll?: boolean;
  }>(),
  { includeAll: true },
);

const emit = defineEmits<{
  (e: "update:modelValue", memberId: string | undefined): void;
}>();
</script>
