import { type ClubPreview, DEFAULT_CLUB_SETTINGS } from "../../../lib/types/club";
import { ClubType } from "../../../lib/types/generated/db";

const club: ClubPreview = {
  clubId: "1",
  clubName: "Test club",
  slug: "test-club",
  slugUpdatedAt: undefined,
  type: ClubType.MOVIE,
  reviewsListId: "reviews",
  settings: DEFAULT_CLUB_SETTINGS,
};

export default club;
