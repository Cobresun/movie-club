import { ClubPreview } from "../../../lib/types/club";
import { ClubType } from "../../../lib/types/generated/db";

const club: ClubPreview = {
  clubId: "1",
  clubName: "Test club",
  slug: "test-club",
  slugUpdatedAt: undefined,
  type: ClubType.movie,
};

export default club;
