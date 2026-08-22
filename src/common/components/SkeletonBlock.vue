<template>
  <div class="skeleton" aria-hidden="true" />
</template>

<style scoped>
/* The one shimmer primitive: a tinted placeholder with a highlight sweeping
   across it. Size and corner radius come from the CALLER's utility classes
   (`class="h-4 w-32 rounded-full"`) — only the tint and the animation live
   here, so one block can stand in for a poster, an avatar or a line of text.

   Both layers are translucent light rather than a solid fill, so a block
   reads the same whether it sits on the page background, inside a slate card
   or on a widget shell — whatever is underneath shows through.

   The sweep is a pseudo-element rather than a background on the block itself
   so `overflow: hidden` clips it to whatever radius the caller chose. */
.skeleton {
  position: relative;
  overflow: hidden;
  background-color: rgb(148 163 184 / 0.14); /* slate-400 */
}

.skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgb(226 232 240 / 0.13) 50%, transparent 100%);
  animation: skeleton-sweep var(--motion-shimmer) var(--ease-standard) infinite;
  /* Capped stagger: composites set `--skeleton-index` on a wrapper and it
     inherits down, so a grid ripples instead of pulsing in lockstep. */
  animation-delay: calc(var(--skeleton-index, 0) * 90ms);
}

@keyframes skeleton-sweep {
  to {
    transform: translateX(100%);
  }
}
</style>
