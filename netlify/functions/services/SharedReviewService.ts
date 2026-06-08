import ClubRepository from "../repositories/ClubRepository.js";
import ListRepository from "../repositories/ListRepository.js";
import ReviewRepository from "../repositories/ReviewRepository.js";
import UserRepository from "../repositories/UserRepository.js";
import WorkCommentRepository from "../repositories/WorkCommentRepository.js";
import { overviewToExternalData } from "../utils/workDetailsMapper.js";

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
  async getSharedReviewData(clubId: string, workId: string) {
    const [reviews, members, workDetails, club, comments] = await Promise.all([
      ReviewRepository.getReviewsByWorkId(clubId, workId),
      UserRepository.getMembersByClubId(clubId),
      ListRepository.getWorkDetails(workId),
      ClubRepository.getById(clubId),
      WorkCommentRepository.getByWorkAndClub(workId, clubId),
    ]);

    if (!workDetails) {
      return null;
    }

    const work = {
      id: workDetails.id,
      title: workDetails.title,
      type: workDetails.type,
      imageUrl: workDetails.image_url ?? undefined,
      externalId: workDetails.external_id ?? undefined,
      externalData: overviewToExternalData(workDetails),
    };

    return {
      reviews,
      members,
      comments,
      work,
      clubName: club?.name ?? "Movie Club",
    };
  }
}

export default new SharedReviewService();
