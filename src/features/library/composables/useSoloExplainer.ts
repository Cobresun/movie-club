import { ref } from "vue";

// Persisted flag: once the user has seen (and dismissed) the one-time solo
// explainer banner, it never shows again.
const STORAGE_KEY = "soloExplainerSeen";

/**
 * One-time explainer banner state. Reads the localStorage flag once at setup
 * (localStorage is an external system, so a read-once/set-once pattern is fine —
 * no watch on reactive query data). `dismiss()` flips it permanently.
 */
export function useSoloExplainer() {
  const seen = ref(localStorage.getItem(STORAGE_KEY) === "true");

  const dismiss = () => {
    seen.value = true;
    localStorage.setItem(STORAGE_KEY, "true");
  };

  return { seen, dismiss };
}
