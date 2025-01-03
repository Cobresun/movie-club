export default {
  beforeMount(el: HTMLImageElement) {
    el.dataset.src = el.src;
    el.dataset.loaded = "false";
    el.src = "";
  },

  mounted(el: HTMLImageElement) {
    function handleIntersect(
      entries: IntersectionObserverEntry[],
      observer: IntersectionObserver,
    ) {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          el.src = el.dataset.src ?? "";
          el.dataset.loaded = "true";
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
};
