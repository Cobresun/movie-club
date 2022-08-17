import { DataService, DetailedReviewResponse, ReviewResponse } from "@/models";
import { useFetchCache } from "./useFetch";

export function useReview(clubId: string): DataService<ReviewResponse[]> {
  const fetch = useFetchCache<DetailedReviewResponse[]>(
    `review-${clubId}`, 
    `/api/club/${clubId}/reviews`
  );
  return {...fetch}
}

export function useDetailedReview(clubId: string): DataService<DetailedReviewResponse[]> {
  const fetch = useFetchCache<DetailedReviewResponse[]>(
    `review-d-${clubId}`, 
    `/api/club/${clubId}/reviews?detailed=true`
  );
  return {...fetch}
}