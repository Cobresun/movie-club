<template>
  <div class="p-2">
    <add-review-prompt v-if="modalOpen" @close="closePrompt" />
    <page-header :has-back="true" back-route="ClubHome" page-name="Reviews">
      <div class="flex gap-2">
        <mdicon name="table" />
        <VToggle v-model="isGalleryView" />
        <mdicon name="image-multiple" />
      </div>
    </page-header>
    <loading-spinner v-if="loading" />
    <div v-else>
      <div
        class="flex items-center justify-center"
        :class="isGalleryView ? 'mb-4' : 'mb-0'"
      >
        <div class="relative">
          <mdicon
            name="magnify"
            class="absolute left-8 top-1/2 -translate-y-1/2 transform text-slate-200"
          />
          <input
            ref="searchInput"
            v-model="searchTerm"
            class="w-11/12 rounded-md border-2 border-slate-600 bg-background p-2 pl-12 text-base text-white outline-none focus:border-primary"
            placeholder="Search"
            @focusin="searchInputFocusIn"
            @focusout="searchInputFocusOut"
          />
          <div
            ref="searchInputSlash"
            class="absolute right-8 top-1/2 -translate-y-1/2 transform rounded-md border-2 border-slate-600 px-2 py-1"
          >
            <p name="slash" class="text-xs text-slate-200">/</p>
          </div>
        </div>
        <v-btn
          class="ml-2 flex h-11 w-11 items-center justify-center whitespace-nowrap"
          @click="openPrompt()"
        >
          <mdicon name="plus" />
        </v-btn>
      </div>
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
        :should-blur-emoji="shouldBlurScore"
        @toggle-reveal="toggleReveal"
      />
    </div>

    <!-- Emoji Picker Overlay -->
    <div
      v-if="isEmojiPickerOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      @click="closeEmojiPicker"
    >
      <div
        class="rounded-lg border border-gray-600 bg-background shadow-xl"
        @click.stop
      >
        <EmojiPicker
          :native="true"
          :hide-group-names="false"
          :hide-search="false"
          :disable-skin-tones="true"
          theme="dark"
          @select="onEmojiSelect"
        />
      </div>
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
import { useToast } from "vue-toastification";
import EmojiPicker from "vue3-emoji-picker";
import "vue3-emoji-picker/css";

import { isTrue } from "../../../../lib/checks/checks.js";
import { isDefined } from "../../../../lib/checks/checks.js";
import { WorkListType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem, Review } from "../../../../lib/types/lists";
import { filterMovies } from "../../../common/searchMovies";
import GalleryView from "../components/GalleryView.vue";
import MovieTooltip from "../components/MovieTooltip.vue";
import ReviewScore from "../components/ReviewScore.vue";
import TableView from "../components/TableView.vue";

import AverageImg from "@/assets/images/average.svg";
import VAvatar from "@/common/components/VAvatar.vue";
import VToggle from "@/common/components/VToggle.vue";
import AddReviewPrompt from "@/features/reviews/components/AddReviewPrompt.vue";
import { useIsInClub, useMembers, useClubSettings } from "@/service/useClub";
import { useDeleteListItem, useList } from "@/service/useList";
import { useUpdateReviewEmoji } from "@/service/useReviews";
import { useUser } from "@/service/useUser";

const { clubId } = defineProps<{ clubId: string }>();

const isGalleryView = ref(false);
const isEmojiPickerOpen = ref(false);
const currentReviewId = ref<string | null>(null);
const longPressTimer = ref<number | null>(null);
const isLongPress = ref(false);

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
  } else {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    isGalleryView.value = isMobile;
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

const searchTerm = ref("");
const filteredReviews = computed<DetailedReviewListItem[]>(() => {
  return filterMovies(reviews.value ?? [], searchTerm.value);
});

const searchInput = ref<HTMLInputElement | null>(null);
const searchInputSlash = ref<HTMLParagraphElement | null>(null);

const onKeyPress = (e: KeyboardEvent) => {
  if (e.key === "/") {
    if (searchInput.value === document.activeElement) {
      return;
    }
    e.preventDefault();
    searchInput.value?.focus();
  }
};

onMounted(() => {
  window.addEventListener("keypress", onKeyPress);
});

onUnmounted(() => {
  window.removeEventListener("keypress", onKeyPress);
});

const searchInputFocusIn = () => {
  searchInputSlash.value?.setAttribute("hidden", "true");
};

const searchInputFocusOut = () => {
  searchInputSlash.value?.removeAttribute("hidden");
};

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
const { mutate: updateReviewEmoji } = useUpdateReviewEmoji(clubId);

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

const getUserEmoji = (
  scores: Record<string, Review>,
  columnId: string,
): string | null => {
  // Extract user ID from column ID (format: "member_{userId}")
  const userId = columnId.replace("member_", "");
  const userReview = scores[userId];
  return userReview?.emoji ?? null;
};

const openEmojiPicker = (reviewId: string | undefined) => {
  if (isDefined(reviewId)) {
    currentReviewId.value = reviewId;
    isEmojiPickerOpen.value = true;
  }
};

const closeEmojiPicker = () => {
  isEmojiPickerOpen.value = false;
  currentReviewId.value = null;
};

const handleTouchStart = (reviewId: string | undefined) => {
  if (!isDefined(reviewId)) return;

  isLongPress.value = false;
  longPressTimer.value = window.setTimeout(() => {
    isLongPress.value = true;
    openEmojiPicker(reviewId);
  }, 500); // 500ms long press duration
};

const handleTouchEnd = () => {
  if (isDefined(longPressTimer.value)) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }
};

const handleTouchMove = () => {
  if (isDefined(longPressTimer.value)) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }
};

const onEmojiSelect = (emoji: { i: string }) => {
  if (isDefined(currentReviewId.value)) {
    updateReviewEmoji({
      reviewId: currentReviewId.value,
      emoji: emoji.i,
    });
  }
  closeEmojiPicker();
};

const toast = useToast();

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
              deleteReview(row.original.id);
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
                  void navigator.clipboard.writeText(url);
                  toast.success("Share URL copied to clipboard!");
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
        const userEmoji = getUserEmoji(
          info.row.original.scores,
          info.column.id,
        );

        return h(
          "div",
          {
            class: shouldBlur ? "cursor-pointer hover:text-xl" : "",
            onClick: shouldBlur ? () => toggleReveal(info.row.id) : undefined,
          },
          [
            // ReviewScore wrapper with relative positioning for emoji badge
            h(
              "div",
              {
                class: "relative inline-block group",
                onTouchstart:
                  info.column.id === `member_${userId.value}` &&
                  info.row.original.scores[member.id]?.id &&
                  !shouldBlur
                    ? () =>
                        handleTouchStart(
                          info.row.original.scores[member.id]?.id,
                        )
                    : undefined,
                onTouchend:
                  info.column.id === `member_${userId.value}` &&
                  info.row.original.scores[member.id]?.id &&
                  !shouldBlur
                    ? handleTouchEnd
                    : undefined,
                onTouchmove:
                  info.column.id === `member_${userId.value}` &&
                  info.row.original.scores[member.id]?.id &&
                  !shouldBlur
                    ? handleTouchMove
                    : undefined,
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
                // Floating emoji badge
                isDefined(userEmoji) && !shouldBlur
                  ? h(
                      "div",
                      {
                        class:
                          "absolute -right-5 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-lg cursor-pointer hover:bg-slate-700 transition-colors",
                        onClick: (e: Event) => {
                          e.stopPropagation();
                          // Only remove emoji on regular tap, not on long press
                          if (
                            !isLongPress.value &&
                            info.row.original.scores[member.id]?.id
                          ) {
                            updateReviewEmoji({
                              reviewId: info.row.original.scores[member.id].id,
                              emoji: null,
                            });
                          }
                          // Reset long press flag
                          isLongPress.value = false;
                        },
                      },
                      userEmoji,
                    )
                  : null,
                // Hover plus button for adding emoji (only when no emoji exists)
                info.column.id === `member_${userId.value}` &&
                info.row.original.scores[member.id]?.id &&
                !shouldBlur &&
                !isDefined(userEmoji)
                  ? h(
                      "button",
                      {
                        class:
                          "absolute -right-5 -top-2 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white hover:bg-primary/80 transition-all duration-200 delay-75 hover:delay-0",
                        onClick: (e: Event) => {
                          e.stopPropagation();
                          openEmojiPicker(
                            info.row.original.scores[member.id]?.id,
                          );
                        },
                      },
                      "+",
                    )
                  : null,
              ].filter(Boolean),
            ),
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
