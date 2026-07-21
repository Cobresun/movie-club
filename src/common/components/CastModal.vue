<template>
  <Teleport to="body">
    <v-modal size="lg" z-index="60" @close="emit('close')">
      <div class="flex h-full flex-col gap-4 text-left">
        <h2 class="shrink-0 text-xl font-bold">Cast</h2>
        <!-- Bounded scroll area: VModal's desktop panel is fixed-height with no
             internal scroll, so a long cast would otherwise overflow. -->
        <div class="min-h-0 flex-1 overflow-y-auto">
          <ul class="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5">
            <li
              v-for="(actor, index) in actors"
              :key="`${actor.name}-${index}`"
              class="flex flex-col items-center gap-2 text-center"
            >
              <CastAvatar :name="actor.name" :profile-path="actor.profilePath" :size="72" />
              <span class="line-clamp-2 text-xs text-gray-300">
                {{ actor.name }}
              </span>
              <span
                v-if="hasValue(actor.character)"
                class="line-clamp-2 text-[0.7rem] text-gray-500"
              >
                {{ actor.character }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </v-modal>
  </Teleport>
</template>

<script setup lang="ts">
import { hasValue } from "../../../lib/checks/checks";
import CastAvatar from "./CastAvatar.vue";

defineProps<{
  actors: {
    name: string;
    character: string | null;
    profilePath: string | null;
  }[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();
</script>
