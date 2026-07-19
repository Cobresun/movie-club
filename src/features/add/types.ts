/** Emitted up the /add component tree once a work has been added to a list. */
export interface AddedPayload {
  clubSlug: string;
  clubName: string;
  listId: string;
  isReviews: boolean;
  title: string;
}
