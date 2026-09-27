import { hasValue, isDefined } from "../../../lib/checks/checks.js";
import { SharedReviewResponse } from "../../../lib/types/lists";
import ClubRepository from "../repositories/ClubRepository";
import ListRepository from "../repositories/ListRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import UserRepository from "../repositories/UserRepository";
import WorkCommentRepository from "../repositories/WorkCommentRepository";
import { getExternalDataForWorks } from "../utils/providers";

class SharedReviewService {
  /**
   * Fetches all data needed for a shared review including:
   * - Review scores from all members
   * - Club member information
   * - Work/movie details with external data
   * - Club name
   *
   * @param clubId - The ID of the club
   * @param workId - The ID of the work/movie
   * @returns Shared review data if work exists, null otherwise
   */
  async getSharedReviewData(clubId: string, workId: string): Promise<SharedReviewResponse | null> {
    const [reviews, members, workDetails, club, comments] = await Promise.all([
      ReviewRepository.getReviewsByWorkId(clubId, workId),
      UserRepository.getMembersByClubId(clubId),
      ListRepository.getWorkDetails(workId),
      ClubRepository.getById(clubId),
      WorkCommentRepository.getByWorkAndClub(workId, clubId),
    ]);

    if (!workDetails || !club) {
      return null;
    }

    const externalData = hasValue(workDetails.external_id)
      ? (
          await getExternalDataForWorks([
            { externalId: workDetails.external_id, type: workDetails.type },
          ])
        ).get(workDetails.external_id)
      : undefined;

    const work = {
      id: workDetails.id,
      title: workDetails.title,
      type: workDetails.type,
      imageUrl: workDetails.image_url ?? undefined,
      externalId: workDetails.external_id ?? undefined,
      externalData,
    };

    return {
      // The work is left-joined to its reviews, so an unscored work reads back
      // as one all-null row.
      reviews: reviews.flatMap((review) =>
        isDefined(review.user_id) && isDefined(review.score) && isDefined(review.created_date)
          ? [
              {
                user_id: review.user_id,
                score: parseFloat(review.score),
                created_date: review.created_date.toISOString(),
              },
            ]
          : [],
      ),
      // This payload is public, so members carry only what the page shows.
      members: members.map((member) => ({
        id: member.id,
        name: member.name,
        image: member.image ?? undefined,
      })),
      comments,
      work,
      clubName: club.name ?? "Movie Club",
    };
  }
}

export default new SharedReviewService();
