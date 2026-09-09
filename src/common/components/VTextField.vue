<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-[13px] font-medium text-white/60">{{ label }}</label>

    <div
      class="flex items-center rounded-[10px] bg-lowBackground ring-1 ring-inset ring-white/[0.12] focus-within:ring-2 focus-within:ring-primary"
      :class="{ 'gap-1 pr-1.5': revealable }"
    >
      <input
        :id="id"
        :type="resolvedType"
        :value="modelValue"
        :placeholder="placeholder"
        :required="required"
        :minlength="minlength"
        :maxlength="maxlength"
        class="min-h-[50px] min-w-0 flex-grow bg-transparent px-3.5 text-[15px] text-white placeholder-white/35 focus:outline-none"
        @input="onInput"
      />

      <!-- A reveal toggle in place of a confirm field: it catches the same
           typos without a second box to fill in and mismatch. -->
      <button
        v-if="revealable"
        type="button"
        class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg transition-colors duration-fast ease-standard hover:bg-white/10"
        :aria-label="revealed ? 'Hide password' : 'Show password'"
        :aria-pressed="revealed"
        @click="revealed = !revealed"
      >
        <mdicon
          :name="revealed ? 'eye-off-outline' : 'eye-outline'"
          :size="21"
          class="text-highlight"
        />
      </button>
    </div>

    <p v-if="hasValue(error)" class="text-sm text-red-400">{{ error }}</p>
    <p v-else-if="hasValue(hint)" class="text-xs text-white/40">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from "vue";

import { hasValue } from "../../../lib/checks/checks.js";

/**
 * The app's field: label, box, and the one line under it that is either a hint
 * or the reason the value was refused. `revealable` swaps the trailing eye in
 * for password fields, which is why the toggle lives here rather than in every
 * form that needs one.
 */
const {
  label,
  modelValue,
  type = "text",
  placeholder,
  required = false,
  minlength,
  maxlength,
  hint,
  error,
  revealable = false,
} = defineProps<{
  label: string;
  modelValue: string;
  type?: "text" | "password" | "email";
  placeholder?: string;
  required?: boolean;
  minlength?: number;
  maxlength?: number;
  hint?: string;
  error?: string;
  revealable?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:model-value", value: string): void;
}>();

const onInput = (event: Event) => {
  if (event.target instanceof HTMLInputElement) emit("update:model-value", event.target.value);
};

// Generated rather than a prop: the label only has to reach the input beside it,
// and every caller passing an id by hand is a chance to collide or forget.
const id = useId();

const revealed = ref(false);
const resolvedType = computed(() => (revealable && revealed.value ? "text" : type));
</script>
