<template>
  <Listbox as="div" class="relative" :model-value="selectedId" @update:model-value="onSelect">
    <slot />
    <ListboxOptions
      class="bg-background absolute top-full left-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-gray-700 py-1 shadow-lg focus:outline-hidden"
    >
      <ListboxOption
        v-for="member in members"
        :key="member.id"
        v-slot="{ active, selected }"
        :value="member.id"
        as="template"
      >
        <li
          class="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm text-gray-200"
          :class="{ 'bg-lowBackground': active }"
        >
          <VAvatar :src="member.image" :name="member.name" :size="20" aria-hidden="true" />
          <span class="flex-1 truncate">{{ member.name }}</span>
          <mdicon v-if="selected" name="check" size="16" />
        </li>
      </ListboxOption>
      <ListboxOption
        v-if="isDefined(addedByMember)"
        v-slot="{ active }"
        :value="null"
        as="template"
      >
        <li
          class="flex cursor-pointer items-center gap-2 border-t border-gray-700 px-4 py-2 text-sm text-gray-400"
          :class="{ 'bg-lowBackground': active }"
        >
          <mdicon name="account-off-outline" size="20" aria-hidden="true" />
          <span class="flex-1 truncate">No one</span>
        </li>
      </ListboxOption>
    </ListboxOptions>
  </Listbox>
</template>

<script setup lang="ts">
import { Listbox, ListboxOption, ListboxOptions } from "@headlessui/vue";
import { computed } from "vue";

import { isDefined } from "../../../lib/checks/checks.js";
import { Member } from "../../../lib/types/club";
import VAvatar from "@/common/components/VAvatar.vue";

const props = defineProps<{
  members: Member[];
  addedByMember?: Member;
}>();

const emit = defineEmits<{
  (e: "change", userId: string | undefined): void;
}>();

// Headless UI treats an undefined model value as uncontrolled, so "no one"
// is null inside the listbox and undefined everywhere else.
const selectedId = computed(() => props.addedByMember?.id ?? null);

const onSelect = (value: string | null) => {
  const userId = value ?? undefined;
  if (userId !== props.addedByMember?.id) {
    emit("change", userId);
  }
};
</script>
