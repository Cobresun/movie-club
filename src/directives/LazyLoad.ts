// Images start hidden (.lazy-fade in tailwind.css) and fade in once they have
// loaded. A failed load is revealed too, so the alt text still shows — but
// only once the real URL is in place: clearing `src` to park it fires an error
// event of its own.
const markLoaded = (event: Event) => {
  const img = event.currentTarget;
  if (img instanceof HTMLImageElement && img.dataset.loaded === "true") {
    img.classList.add("lazy-loaded");
  }
};

// How far outside the viewport an image starts loading, as a share of the
// viewport's own size. With no margin a poster only began downloading once it
// was already on screen, so scrolling a list was a row of blanks filling in
// behind the reader. A screenful of lead time has them there on arrival.
const LOAD_AHEAD = "100% 0px";

const observers = new WeakMap<HTMLImageElement, IntersectionObserver>();

export default {
  beforeMount(el: HTMLImageElement) {
    el.dataset.src = el.src;
    el.dataset.loaded = "false";
    el.src = "";
    // Decode off the main thread: a grid of posters arriving together should
    // not hold up scrolling.
    el.decoding = "async";
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
          observer.disconnect();
          observers.delete(el);
        }
      });
    }

    const options = {
      root: null,
      rootMargin: LOAD_AHEAD,
      threshold: 0,
    };
    const observer = new IntersectionObserver(handleIntersect, options);
    observers.set(el, observer);
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
    // An image removed before it ever came near the viewport still has a live
    // observer holding on to it.
    observers.get(el)?.disconnect();
    observers.delete(el);
    el.removeEventListener("load", markLoaded);
    el.removeEventListener("error", markLoaded);
  },
};
