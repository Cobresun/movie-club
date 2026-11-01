/** One billed cast member, as cached from TMDB's credits for a movie or a show. */
export interface CastMember {
  name: string;
  character: string | null;
  profilePath: string | null;
}
