// Images start hidden (.lazy-fade in tailwind.css) and fade in once they have
// loaded. A failed load is revealed too, so the alt text still shows — but
// only once the real URL is in place: clearing `src` to park it fires an error
// event of its own.
const markLoaded = (event: Event) => {
  const img = event.currentTarget as HTMLImageElement;
  if (img.dataset.loaded === "true") img.classList.add("lazy-loaded");
};

export default {
  beforeMount(el: HTMLImageElement) {
    el.dataset.src = el.src;
    el.dataset.loaded = "false";
    el.src = "";
    el.classList.add("lazy-fade");
    el.addEventListener("load", markLoaded);
    el.addEventListener("error", markLoaded);
  },

  mounted(el: HTMLImageElement) {
    function handleIntersect(entries: IntersectionObserverEntry[], observer: IntersectionObserver) {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const src = el.dataset.src ?? "";
          el.src = src;
          el.dataset.loaded = "true";
          // No URL means no load event will ever come to fade it in.
          if (src === "") el.classList.add("lazy-loaded");
          observer.unobserve(el);
        }
      });
    }

    const options = {
      root: null,
      threshold: 0,
    };
    const observer = new IntersectionObserver(handleIntersect, options);
    observer.observe(el);
  },
  beforeUpdate(el: HTMLImageElement) {
    if (el.dataset.loaded !== "true" && el.src !== window.location.href) {
      el.dataset.src = el.src;
      el.dataset.loaded = "false";
      el.src = "";
    }
  },
  unmounted(el: HTMLImageElement) {
    el.removeEventListener("load", markLoaded);
    el.removeEventListener("error", markLoaded);
  },
};
