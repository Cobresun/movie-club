import { type DetailedReviewListItem } from "../../../../lib/types/lists";
import { useShare } from "@/common/composables/useShare";
import { useClub, useClubSlug } from "@/service/useClub";

/** Shares the public page for one of the club's reviews. */
export function useShareReview() {
  const clubSlug = useClubSlug();
  const { data: club } = useClub(clubSlug);
  const { share } = useShare();

  return (work: Pick<DetailedReviewListItem, "id" | "title">) => {
    const clubName = club.value?.clubName ?? "Movie Club";
    void share({
      url: `${window.location.origin}/share/club/${clubSlug}/review/${work.id}`,
      title: `${work.title} - ${clubName} Review`,
      text: `${clubName}'s review of ${work.title}`,
    });
  };
}
