<template>
  <div class="border-t border-white/[0.08] first:border-t-0">
    <button
      v-if="!editing"
      class="flex min-h-[56px] w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-fast ease-standard hover:bg-white/10"
      @click="startEditing"
    >
      <span class="flex min-w-0 flex-grow flex-col gap-0.5">
        <span class="text-xs text-white/50">{{ label }}</span>
        <span class="truncate text-[15px] font-medium">
          <span v-if="hasValue(prefix)" class="text-white/50">{{ prefix }}</span>
          <span :class="highlightValue ? 'text-highlight' : ''">{{ value }}</span>
        </span>
      </span>
      <mdicon name="pencil" :size="20" class="flex-shrink-0 text-white/50" />
    </button>

    <!-- Unfocused on purpose: auto-focusing throws the phone keyboard up over
         the row before the user has decided they want to type. -->
    <div v-else class="flex flex-col gap-2.5 px-4 pb-3.5 pt-3">
      <label class="text-[13px] font-medium text-white/60" :for="inputId">{{ label }}</label>
      <div class="flex items-center gap-2">
        <span v-if="hasValue(prefix)" class="flex-shrink-0 text-sm text-white/40">
          {{ prefix }}
        </span>
        <input
          :id="inputId"
          v-model="draft"
          type="text"
          :maxlength="maxlength"
          :placeholder="placeholder"
          :disabled="saving"
          class="min-h-[50px] min-w-0 flex-grow rounded-[10px] bg-background px-3.5 text-[15px] text-white placeholder-white/35 ring-1 ring-inset ring-white/[0.12] focus:outline-none focus:ring-2 focus:ring-primary"
          @input="emit('dirty')"
          @keyup.enter="save"
          @keyup.escape="cancel"
        />
      </div>
      <p v-if="hasValue(error)" class="text-sm text-red-400">{{ error }}</p>
      <div class="flex items-center justify-between gap-3">
        <span v-if="hasValue(hint)" class="flex items-center gap-1.5 text-xs text-white/40">
          <mdicon v-if="warnHint" name="alert-outline" :size="14" class="text-yellow-500" />
          <span>{{ hint }}</span>
        </span>
        <span v-else />
        <div class="flex flex-shrink-0 gap-2">
          <button
            class="min-h-[44px] rounded-md px-3.5 text-[15px] font-semibold text-white/60 ring-1 ring-inset ring-white/[0.12] transition-colors duration-fast ease-standard hover:bg-white/10"
            @click="cancel"
          >
            Cancel
          </button>
          <v-btn class="min-h-[44px] px-2" :disabled="saving" @click="save">Save</v-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

import { hasValue } from "../../../../lib/checks/checks.js";

/**
 * One settings row that swaps in place between reading a value and editing it,
 * mirroring the account panel's name editor. The parent owns `editing` so it
 * can keep the row open while a save is failing and close it on success.
 */
const {
  label,
  value,
  editing,
  inputId,
  prefix = undefined,
  hint = undefined,
  error = undefined,
  placeholder = undefined,
  maxlength = undefined,
  saving = false,
  warnHint = false,
  highlightValue = false,
} = defineProps<{
  label: string;
  value: string;
  editing: boolean;
  inputId: string;
  /** Immutable text shown before the value, e.g. the club URL's origin. */
  prefix?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  maxlength?: number;
  saving?: boolean;
  /** Marks the hint as a warning (alert glyph) rather than plain guidance. */
  warnHint?: boolean;
  highlightValue?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:editing", editing: boolean): void;
  (e: "save", value: string): void;
  (e: "dirty"): void;
}>();

const draft = ref("");

const startEditing = () => {
  draft.value = value;
  emit("dirty");
  emit("update:editing", true);
};

const cancel = () => {
  draft.value = "";
  emit("dirty");
  emit("update:editing", false);
};

const save = () => {
  emit("save", draft.value.trim());
};
</script>
