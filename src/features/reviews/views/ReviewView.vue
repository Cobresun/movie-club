<template>
  <div class="p-2">
    <add-review-prompt v-if="modalOpen" @close="closePrompt" />
    <delete-confirmation-modal
      :show="!!reviewToDelete"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
    <v-modal v-if="filterPanelOpen" size="sm" @close="closeFilterPanel">
      <ReviewFilterPanel
        :filters="filters"
        :available-genres="availableGenres"
        :available-companies="availableCompanies"
        :available-review-years="availableReviewYears"
        @close="closeFilterPanel"
        @apply="applyFilters"
        @clear="clearAllFilters"
      />
    </v-modal>
    <page-header :has-back="true" back-route="ClubHome" page-name="Reviews">
      <div class="flex gap-2">
        <mdicon name="table" />
        <VToggle v-model="isGalleryView" />
        <mdicon name="image-multiple" />
      </div>
    </page-header>
    <loading-spinner v-if="loading" />
    <div v-else>
      <div :class="isGalleryView ? 'mb-4' : 'mb-0'">
        <ReviewFilterBar
          ref="filterBarRef"
          v-model:search-text="searchTerm"
          :filter-count="activeFilterCount"
          :filter-chips="activeFilterChips"
          @toggle-panel="toggleFilterPanel"
          @remove-filter="clearFilter"
          @clear-all="clearAllFilters"
        >
          <template #actions>
            <v-btn
              class="flex h-11 w-11 items-center justify-center whitespace-nowrap"
              @click="openPrompt()"
            >
              <mdicon name="plus" />
            </v-btn>
          </template>
        </ReviewFilterBar>
      </div>
      <div v-if="showEmptyState">
        <EmptyState
          :title="
            hasSearchTerm || hasActiveFilters
              ? 'No Movies Found'
              : 'No Reviews Yet'
          "
          :description="
            hasSearchTerm || hasActiveFilters
              ? 'Try adjusting your search or filters'
              : 'Start building your club\'s movie collection by adding your first review'
          "
          :action-label="
            hasSearchTerm || hasActiveFilters ? undefined : 'Add Review'
          "
          :action-icon="hasSearchTerm || hasActiveFilters ? undefined : 'plus'"
          @action="openPrompt"
        />
      </div>
      <template v-else>
        <table-view v-if="!isGalleryView" :review-table="reviewTable" />
        <gallery-view
          v-else
          :review-table="reviewTable"
          :delete-review="deleteReview"
          :members="members"
          :revealed-movie-ids="revealedMovieIds"
          :has-rated="hasUserRated"
          :current-user-id="userId"
          :blur-scores-enabled="blurScoresEnabled === true"
          @toggle-reveal="toggleReveal"
        />
      </template>
    </div>
  </div>
</template>
<script setup lang="ts">
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useVueTable,
} from "@tanstack/vue-table";
import { DateTime } from "luxon";
import {
  computed,
  ref,
  onMounted,
  onUnmounted,
  h,
  resolveComponent,
  watch,
} from "vue";

import { isTrue } from "../../../../lib/checks/checks.js";
import { WorkListType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import { useReviewFilters } from "../../../common/composables/useReviewFilters";
import { useShare } from "../../../common/composables/useShare";
import { filterReviewsByFilters } from "../../../common/searchMovies";
import GalleryView from "../components/GalleryView.vue";
import MovieTooltip from "../components/MovieTooltip.vue";
import ReviewFilterBar from "../components/ReviewFilterBar.vue";
import ReviewFilterPanel from "../components/ReviewFilterPanel.vue";
import ReviewScore from "../components/ReviewScore.vue";
import TableView from "../components/TableView.vue";

import AverageImg from "@/assets/images/average.svg";
import DeleteConfirmationModal from "@/common/components/DeleteConfirmationModal.vue";
import EmptyState from "@/common/components/EmptyState.vue";
import VAvatar from "@/common/components/VAvatar.vue";
import VToggle from "@/common/components/VToggle.vue";
import AddReviewPrompt from "@/features/reviews/components/AddReviewPrompt.vue";
import {
  useClub,
  useIsInClub,
  useMembers,
  useClubSettings,
} from "@/service/useClub";
import { useDeleteListItem, useList } from "@/service/useList";
import { useUser } from "@/service/useUser";

const { clubId } = defineProps<{ clubId: string }>();

const isGalleryView = ref(true);

// Load club data for share functionality
const { data: club } = useClub(clubId);

// Load club settings to check if blur scores is enabled
const { data: settings, isLoading: isLoadingSettings } =
  useClubSettings(clubId);
const blurScoresEnabled = computed(
  () =>
    settings.value?.features?.blurScores === true || isLoadingSettings.value,
);

onMounted(() => {
  const savedView = localStorage.getItem("isGalleryView");
  if (savedView !== null) {
    isGalleryView.value = savedView === "true";
  }
});

watch(isGalleryView, (newVal) => {
  localStorage.setItem("isGalleryView", newVal.toString());
});

const { isLoading: loadingReviews, data: reviews } = useList(
  clubId,
  WorkListType.reviews,
);
const { isLoading: loadingMembers, data: membersResponse } = useMembers(clubId);

const loading = computed(() => loadingReviews.value || loadingMembers.value);

const modalOpen = ref(false);
const openPrompt = () => {
  modalOpen.value = true;
};
const closePrompt = () => {
  modalOpen.value = false;
};

const reviewToDelete = ref<string | null>(null);
const cancelDelete = () => {
  reviewToDelete.value = null;
};
const confirmDelete = () => {
  if (reviewToDelete.value) {
    deleteReview(reviewToDelete.value);
    reviewToDelete.value = null;
  }
};

// Filter state
const {
  filters,
  activeFilterCount,
  activeFilterChips,
  clearFilter,
  clearAllFilters,
  applyFilters,
} = useReviewFilters();

const searchTerm = ref("");
const filteredReviews = computed<DetailedReviewListItem[]>(() => {
  return filterReviewsByFilters(reviews.value ?? [], filters, searchTerm.value);
});

// Extract available filter options from reviews data
const availableGenres = computed(() => {
  const genres = new Set<string>();
  reviews.value?.forEach((r) =>
    r.externalData?.genres.forEach((g) => genres.add(g)),
  );
  return Array.from(genres).sort();
});

const availableCompanies = computed(() => {
  const companies = new Set<string>();
  reviews.value?.forEach((r) =>
    r.externalData?.production_companies.forEach((c) => companies.add(c)),
  );
  return Array.from(companies).sort();
});

const availableReviewYears = computed(() => {
  const years = new Set<number>();
  reviews.value?.forEach((r) =>
    years.add(new Date(r.createdDate).getFullYear()),
  );
  return Array.from(years).sort((a, b) => b - a);
});

const hasSearchTerm = computed(() => searchTerm.value.trim().length > 0);
const hasActiveFilters = computed(() => activeFilterCount.value > 0);
const showEmptyState = computed(
  () => !loading.value && filteredReviews.value.length === 0,
);

// Filter panel state
const filterPanelOpen = ref(false);
const toggleFilterPanel = () => {
  filterPanelOpen.value = !filterPanelOpen.value;
};
const closeFilterPanel = () => {
  filterPanelOpen.value = false;
};

// Search input keyboard shortcut
const filterBarRef = ref<{ focus: () => void } | null>(null);

const onKeyPress = (e: KeyboardEvent) => {
  if (e.key === "/") {
    if (document.activeElement?.tagName === "INPUT") {
      return;
    }
    e.preventDefault();
    filterBarRef.value?.focus();
  }
};

onMounted(() => {
  window.addEventListener("keypress", onKeyPress);
});

onUnmounted(() => {
  window.removeEventListener("keypress", onKeyPress);
});

const columnHelper = createColumnHelper<DetailedReviewListItem>();

const members = computed(() => membersResponse.value ?? []);
const isUserInClub = useIsInClub(clubId);

const commonColumnVisibility = computed(() => ({
  edit: isUserInClub.value,
  imageUrl: false,
  title: true,
  createdDate: true,
  score_average: true,
  ...members.value.reduce<Record<string, boolean>>((acc, member) => {
    acc[`member_${member.id}`] = true;
    return acc;
  }, {}),
}));

const galleryColumnVisibility = {
  edit: false,
  imageUrl: true,
};

const editingTable = ref(false);

const { mutate: deleteReview } = useDeleteListItem(
  clubId,
  WorkListType.reviews,
);

const mdicon = resolveComponent("mdicon");
const { data: currentUser } = useUser();
const userId = computed(() => currentUser.value?.id);

const revealedMovieIds = ref<Set<string>>(new Set());
const hasUserRated = computed(() => {
  if (userId.value === undefined) return () => false;

  return (movieId: string) => {
    const review = filteredReviews.value?.find(
      (review) => review.id === movieId,
    );
    return Boolean(review?.scores[userId.value ?? ""]?.score !== undefined);
  };
});

const toggleReveal = (movieId: string) => {
  if (revealedMovieIds.value.has(movieId)) {
    revealedMovieIds.value.delete(movieId);
  } else {
    revealedMovieIds.value.add(movieId);
  }
  revealedMovieIds.value = new Set(revealedMovieIds.value);
};

const shouldBlurScore = (rowId: string, columnId: string) => {
  if (!blurScoresEnabled.value) {
    return false;
  }

  if (hasUserRated.value(rowId) || revealedMovieIds.value.has(rowId)) {
    return false;
  }

  if (columnId === `member_${userId.value}`) {
    return false;
  }

  return columnId.startsWith("member_") || columnId === "score_average";
};

const { share } = useShare();

const columns = computed(() => [
  columnHelper.accessor("imageUrl", {
    header: "Poster",
  }),
  columnHelper.display({
    id: "edit",
    header: () =>
      h(mdicon, {
        name: "pencil",
        class: "cursor-pointer hover:text-primary transition-colors",
        onClick: () => (editingTable.value = !editingTable.value),
      }),
    cell: ({ row }) =>
      editingTable.value
        ? h(mdicon, {
            name: "delete",
            class: "cursor-pointer hover:text-primary transition-colors",
            onClick: () => {
              reviewToDelete.value = row.original.id;
            },
          })
        : h(
            "div",
            {
              class:
                "opacity-0 group-hover:opacity-100 transition-opacity duration-100 space-x-4",
            },
            [
              h(mdicon, {
                name: "share",
                class: "cursor-pointer hover:text-primary transition-colors",
                onClick: () => {
                  const url = `${window.location.origin}/share/club/${clubId}/review/${row.original.id}`;
                  const title = row.original.title;
                  const clubName = club.value?.clubName ?? "Movie Club";
                  void share({
                    url,
                    title: `${title} - ${clubName} Review`,
                    text: `${clubName}'s review of ${title}`,
                  });
                },
              }),
            ],
          ),
  }),
  columnHelper.accessor("title", {
    header: "Title",
    cell: (info) =>
      h(MovieTooltip, {
        title: info.getValue(),
        imageUrl: info.row.original.imageUrl,
        movie: info.row.original.externalData,
      }),
    meta: {
      class: "font-bold align-middle",
    },
  }),
  columnHelper.accessor("createdDate", {
    header: "Date Reviewed",
    cell: (info) => DateTime.fromISO(info.getValue()).toLocaleString(),
  }),
  ...members.value.map((member) =>
    columnHelper.accessor((row) => row.scores[member.id]?.score, {
      id: `member_${member.id}`,
      header: (context) => {
        let size: number | undefined;
        if (typeof context.meta?.size === "string") {
          size = context.meta.size === "sm" ? 28 : undefined;
        }

        if (isTrue(context.meta?.showName)) {
          return h("div", { class: "flex items-center gap-2" }, [
            h(VAvatar, {
              src: member.image,
              name: member.name,
              size,
            }),
            h("span", member.name),
          ]);
        } else {
          return h(VAvatar, {
            src: member.image,
            name: member.name,
            size,
          });
        }
      },
      cell: (info) => {
        const value = info.getValue();
        const score =
          value === undefined ? undefined : Math.round(value * 100) / 100;
        let size: string | undefined;
        if (typeof info.meta?.size === "string") {
          size = info.meta.size;
        }

        const shouldBlur = shouldBlurScore(info.row.id, info.column.id);

        return h(
          "div",
          {
            class: shouldBlur ? "cursor-pointer hover:text-xl" : "",
            onClick: shouldBlur ? () => toggleReveal(info.row.id) : undefined,
          },
          [
            h(ReviewScore, {
              workId: info.row.original.id,
              memberId: member.id,
              score,
              reviewId: info.row.original.scores[member.id]?.id,
              size,
              class: shouldBlur ? "filter blur cursor-pointer" : "",
            }),
          ],
        );
      },
      sortUndefined: "last",
    }),
  ),
  columnHelper.accessor((row) => row.scores.average?.score, {
    id: "score_average",
    header: (context) => {
      let size = "w-16";
      if (typeof context.meta?.size === "string") {
        size = context.meta.size === "sm" ? "w-7 h-7" : "w-16";
      }

      if (isTrue(context.meta?.showName)) {
        return h("div", { class: "flex item-center gap-2" }, [
          h("img", { src: AverageImg, class: `${size} max-w-none` }),
          h("span", "Average"),
        ]);
      } else {
        return h("img", { src: AverageImg, class: `${size} max-w-none` });
      }
    },
    cell: (info) => {
      const review = info.getValue();
      if (review === undefined) {
        return "";
      }

      const shouldBlur = shouldBlurScore(info.row.id, info.column.id);

      return h(
        "div",
        {
          class: shouldBlur
            ? "font-bold text-lg text-primary filter blur cursor-pointer"
            : "font-bold text-lg text-primary",
          onClick: shouldBlur ? () => toggleReveal(info.row.id) : undefined,
        },
        Math.round(review * 100) / 100,
      );
    },
    sortUndefined: "last",
  }),
]);

const reviewTable = useVueTable({
  get columns() {
    return columns.value;
  },
  get data() {
    return filteredReviews.value ?? [];
  },
  state: {
    get columnVisibility() {
      return {
        ...commonColumnVisibility.value,
        ...(isGalleryView.value ? galleryColumnVisibility : {}),
      };
    },
  },
  getCoreRowModel: getCoreRowModel<DetailedReviewListItem>(),
  getSortedRowModel: getSortedRowModel<DetailedReviewListItem>(),
  getRowId: (row) => row.id,
});
</script>
