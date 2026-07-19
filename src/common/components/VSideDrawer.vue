<template>
  <div>
    <v-backdrop :z-index="backdropZIndex" @close="handleClose" />

    <Transition name="slide-in-right" appear @after-leave="onTransitionEnd">
      <div
        v-if="isVisible"
        class="fixed inset-y-0 right-0 z-50 w-[35vw] max-w-full bg-background will-change-transform md:border-l md:border-gray-700 md:shadow-xl"
        @click.stop
      >
        <div class="relative h-full overflow-y-auto px-4 pt-8">
          <!-- `closing` flips as soon as dismissal starts (the drawer stays
               mounted while the leave transition plays), so slot content can
               cancel deferred work instead of janking the slide-out. -->
          <slot :closing="!isVisible" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

type ZIndex = "40" | "50" | "60";

const props = withDefaults(defineProps<{ zIndex?: ZIndex }>(), {
  zIndex: "50",
});

const emit = defineEmits<{
  (e: "close"): void;
}>();

const backdropZIndex = computed<ZIndex>(() =>
  props.zIndex === "60" ? "50" : props.zIndex === "50" ? "40" : "40",
);

const isVisible = ref(true);

const handleClose = () => {
  isVisible.value = false;
};

const onTransitionEnd = () => {
  emit("close");
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && isVisible.value) {
    handleClose();
  }
};

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
});
</script>

<style scoped>
.slide-in-right-enter-active,
.slide-in-right-leave-active {
  transition: transform var(--motion-slow) var(--ease-emphasized);
}

.slide-in-right-enter-from,
.slide-in-right-leave-to {
  transform: translateX(100%);
}

.slide-in-right-enter-to,
.slide-in-right-leave-from {
  transform: translateX(0);
}
</style>
