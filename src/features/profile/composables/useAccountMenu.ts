import { ref } from "vue";

/**
 * Open state for the account menu.
 *
 * Module scope rather than component state because the two things that drive it
 * share no component tree: the nav bar renders the menu, while the legacy
 * `/profile` route guard opens it on its way to redirecting home.
 */
const isOpen = ref(false);

export const useAccountMenu = () => isOpen;

export const openAccountMenu = () => {
  isOpen.value = true;
};

export const closeAccountMenu = () => {
  isOpen.value = false;
};
