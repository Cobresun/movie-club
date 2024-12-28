import { ref, watch } from "vue";
import type { Ref } from "vue";

const DEFAULT_ROTATE_ITERATIONS = 6;

export function useAnimateRandom<T>(list: Ref<T[]>) {
  const rotateReps = ref(DEFAULT_ROTATE_ITERATIONS);
  const isAnimating = ref(false);
  const animateInterval = ref<number | undefined>();
  const selectedValueRef = ref<Ref<T | undefined>>();
  const rotatedList = ref<T[]>(list.value) as Ref<T[]>;

  watch(list, () => {
    rotatedList.value = list.value;
  });

  const animateRotate = () => {
    if (
      rotateReps.value > 0 ||
      rotatedList.value[0] !== selectedValueRef.value?.value
    ) {
      rotatedList.value.unshift(
        rotatedList.value[rotatedList.value.length - 1],
      );
      rotatedList.value.pop();
      rotateReps.value -= 1;
    } else {
      window.clearInterval(animateInterval.value);
      isAnimating.value = false;
    }
  };

  const animate = (selected: Ref<T | undefined>) => {
    selectedValueRef.value = selected;
    rotateReps.value = DEFAULT_ROTATE_ITERATIONS;
    animateInterval.value = window.setInterval(animateRotate, 300);
    isAnimating.value = true;
  };

  const cancel = () => {
    window.clearInterval(animateInterval.value);
    isAnimating.value = false;
    rotatedList.value = list.value;
  };

  return { isAnimating, animate, cancel, list: rotatedList };
}
