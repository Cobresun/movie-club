<template>
  <div v-if="isDefined(mode)" class="px-4 pt-3">
    <section
      aria-labelledby="install-app-heading"
      class="flex items-center gap-3 rounded-xl bg-lowBackground p-3"
    >
      <img src="/apple-touch-icon.png" alt="" class="h-10 w-10 shrink-0 rounded-lg" />
      <div class="min-w-0 flex-grow">
        <h2 id="install-app-heading" class="text-sm font-semibold">
          Add Movie Club to your home screen
        </h2>
        <p v-if="mode === 'ios'" class="text-xs text-white/70">
          Tap
          <mdicon name="export-variant" :size="14" class="inline-block align-text-bottom" />
          Share, then Add to Home Screen.
        </p>
        <p v-else class="text-xs text-white/70">Open it like any other app, one tap away.</p>
      </div>
      <v-btn v-if="mode === 'prompt'" class="min-h-[44px] shrink-0" @click="installApp">
        Install
      </v-btn>
      <button
        class="flex h-[44px] w-[44px] shrink-0 items-center justify-center text-white/60 transition-colors duration-fast ease-standard hover:text-white"
        aria-label="Dismiss"
        @click="dismiss"
      >
        <mdicon name="close" :size="20" />
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { isDefined } from "../../../lib/checks/checks.js";
import { useInstallPrompt } from "../composables/useInstallPrompt";

const { mode, install, dismiss } = useInstallPrompt();

const installApp = () => {
  install().catch(console.error);
};
</script>
