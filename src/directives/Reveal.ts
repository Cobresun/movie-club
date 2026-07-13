// Fade-and-rise an element in the first time it scrolls into view (see
// .reveal-init / .reveal-visible in tailwind.css). Elements already in the
// viewport reveal immediately on mount.
let observer: IntersectionObserver | undefined;

const getObserver = () => {
  observer ??= new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    // The huge top margin treats everything ABOVE the viewport as
    // intersecting: a fast scroll can jump past an element between observer
    // callbacks, and without this it would never fire and the element would
    // stay invisible.
    { threshold: 0.15, rootMargin: "9999px 0px 0px 0px" },
  );
  return observer;
};

export default {
  mounted(el: HTMLElement) {
    el.classList.add("reveal-init");
    getObserver().observe(el);
  },

  unmounted(el: HTMLElement) {
    getObserver().unobserve(el);
  },
};
