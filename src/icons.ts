import {
  mdiAlertCircle,
  mdiAlertOutline,
  mdiArrowCollapseDown,
  mdiArrowCollapseUp,
  mdiArrowDownDropCircle,
  mdiArrowLeft,
  mdiArrowRight,
  mdiArrowUpDropCircle,
  mdiBookOpenPageVariantOutline,
  mdiCheck,
  mdiChevronDown,
  mdiChevronLeft,
  mdiChevronRight,
  mdiChevronUp,
  mdiClockOutline,
  mdiClose,
  mdiCloseCircleOutline,
  mdiCog,
  mdiContentCopy,
  mdiCreation,
  mdiDelete,
  mdiDeleteOutline,
  mdiDiceMultipleOutline,
  mdiDrag,
  mdiEmailCheck,
  mdiEyeOutline,
  mdiFilmstrip,
  mdiImageMultiple,
  mdiImageOutline,
  mdiLoading,
  mdiMagnify,
  mdiMenu,
  mdiMenuDown,
  mdiMinus,
  mdiMovie,
  mdiMovieOpenOutline,
  mdiMovieOutline,
  mdiOpenInNew,
  mdiPencil,
  mdiPencilOutline,
  mdiPlus,
  mdiSeatOutline,
  mdiSend,
  mdiShare,
  mdiShareVariant,
  mdiStar,
  mdiSwapHorizontal,
  mdiTable,
  mdiTicketOutline,
  mdiTrashCanOutline,
  mdiViewDashboard,
} from "@mdi/js";

/**
 * Curated set of Material Design Icons actually used in the app.
 *
 * mdi-vue resolves a kebab-case icon name to the matching `mdiPascalCase` key
 * (e.g. the name "arrow-left" -> `icons.mdiArrowLeft`) at runtime
 * (see node_modules/mdi-vue/src/shared.js). Importing the named exports
 * individually (instead of `import * as mdijs from "@mdi/js"`) lets the bundler
 * tree-shake the other ~7,000 icon path strings out of the bundle — that
 * wildcard import was pulling ~2.7 MB of icon data into the initial chunk.
 *
 * If you add a new `<mdicon name="...">` (or an EmptyState `action-icon`), add
 * the matching `mdiPascalCase` export here. `icons.test.ts` scans every .vue
 * template and fails if a referenced icon is missing, so a forgotten icon is
 * caught in CI rather than silently rendering mdi-vue's mdiAlert fallback.
 *
 * Beware names that reach a template only through a function/computed (e.g.
 * `:name="clubTypeIcon(club.type)"` or `copyIcon`): the static scan can't see
 * them, so a missing one renders the triangle fallback at runtime instead of
 * failing CI. Icons sourced from CLUB_TYPE_CONFIG are guarded by a dedicated
 * test, but any other dynamic icon name must be registered here by hand.
 */
export const icons = {
  mdiAlertCircle,
  mdiAlertOutline,
  mdiArrowCollapseDown,
  mdiArrowCollapseUp,
  mdiArrowDownDropCircle,
  mdiArrowLeft,
  mdiArrowRight,
  mdiArrowUpDropCircle,
  mdiBookOpenPageVariantOutline,
  mdiCheck,
  mdiChevronDown,
  mdiChevronLeft,
  mdiChevronRight,
  mdiChevronUp,
  mdiClockOutline,
  mdiClose,
  mdiCloseCircleOutline,
  mdiCog,
  mdiContentCopy,
  mdiCreation,
  mdiDelete,
  mdiDeleteOutline,
  mdiDiceMultipleOutline,
  mdiDrag,
  mdiEmailCheck,
  mdiEyeOutline,
  mdiFilmstrip,
  mdiImageMultiple,
  mdiImageOutline,
  mdiLoading,
  mdiMagnify,
  mdiMenu,
  mdiMenuDown,
  mdiMinus,
  mdiMovie,
  mdiMovieOpenOutline,
  mdiMovieOutline,
  mdiOpenInNew,
  mdiPencil,
  mdiPencilOutline,
  mdiPlus,
  mdiSeatOutline,
  mdiSend,
  mdiShare,
  mdiShareVariant,
  mdiStar,
  mdiSwapHorizontal,
  mdiTable,
  mdiTicketOutline,
  mdiTrashCanOutline,
  mdiViewDashboard,
};
