import { DetailedReviewResponse } from "@/common/types/models";

export function filterReviews(reviews: DetailedReviewResponse[], searchTerm: string): DetailedReviewResponse[] {
    return reviews.filter(review =>
      review.movieTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.movieData.production_companies
        .some(company => company.name.toLocaleLowerCase().includes(searchTerm.toLowerCase()))
    );
  }
  