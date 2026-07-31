import { AwardsData } from "../../../../lib/types/awards";
import { ClubType, WorkListSystemType, WorkType } from "../../../../lib/types/generated/db";
import { TMDBMovieData } from "../../../../lib/types/movie";
import { db } from "../../utils/database";
import { insertMovieDetails } from "../../utils/movieDetailsUpdater";
import { tmdbMovie } from "../fixtures/external";

/**
 * Arrange-phase seeding for the integration suite.
 *
 * These write rows directly rather than calling the repositories, so a test's
 * setup never depends on the code it is about to exercise — a broken
 * `ListRepository.createList` should fail the list tests, not silently make
 * their fixtures wrong too.
 */

let counter = 0;
const unique = () => `${Date.now().toString(36)}-${(counter += 1)}`;

export interface SeededClub {
  id: string;
  slug: string;
  name: string;
  type: ClubType;
  /** The club's single user-facing list ("Watch List" / "Reading List"). */
  listId: string;
  /** The `reviews` system list. */
  reviewsListId: string;
}

/**
 * Create a club with the two lists every real club is born with (one user list
 * plus the `reviews` system list) and default settings.
 */
export async function createClub(
  options: {
    name?: string;
    slug?: string;
    type?: ClubType;
    members?: { userId: string; role?: string }[];
    features?: { awards?: boolean; discussionQuestions?: boolean };
  } = {},
): Promise<SeededClub> {
  const type = options.type ?? ClubType.movie;
  const name = options.name ?? "Test Club";
  const slug = options.slug ?? `test-club-${unique()}`;

  const club = await db
    .insertInto("club")
    .values({ name, slug, type })
    .returning(["id", "slug", "name", "type"])
    .executeTakeFirstOrThrow();
  const clubId = String(club.id);

  const lists = await db
    .insertInto("work_list")
    .values([
      {
        club_id: clubId,
        title: type === ClubType.book ? "Reading List" : "Watch List",
        position: 0,
      },
      {
        club_id: clubId,
        title: "Reviews",
        system_type: WorkListSystemType.reviews,
        position: 1,
      },
    ])
    .returning(["id", "system_type"])
    .execute();

  await db
    .insertInto("club_settings")
    .values({
      club_id: clubId,
      key: "features",
      value: JSON.stringify({
        features: {
          awards: options.features?.awards ?? false,
          discussionQuestions: options.features?.discussionQuestions ?? false,
        },
      }),
    })
    .execute();

  for (const member of options.members ?? []) {
    await addMember(clubId, member.userId, member.role);
  }

  const userList = lists.find((list) => list.system_type === null);
  const reviewsList = lists.find((list) => list.system_type === WorkListSystemType.reviews);
  if (!userList || !reviewsList) {
    throw new Error("Failed to seed the club's default lists");
  }

  return {
    id: clubId,
    slug: club.slug,
    name: club.name,
    type: club.type,
    listId: String(userList.id),
    reviewsListId: String(reviewsList.id),
  };
}

export async function addMember(clubId: string, userId: string, role = "member") {
  await db.insertInto("club_member").values({ club_id: clubId, user_id: userId, role }).execute();
}

/** An extra list beyond the club's default one. */
export async function createList(clubId: string, title: string, position?: number) {
  const row = await db
    .insertInto("work_list")
    .values({ club_id: clubId, title, ...(position === undefined ? {} : { position }) })
    .returning("id")
    .executeTakeFirstOrThrow();
  return String(row.id);
}

export interface SeededWork {
  id: string;
  title: string;
  externalId: string | null;
  type: WorkType;
}

export async function createWork(
  clubId: string,
  options: {
    title?: string;
    type?: WorkType;
    externalId?: string | null;
    imageUrl?: string | null;
  } = {},
): Promise<SeededWork> {
  const type = options.type ?? WorkType.movie;
  const externalId =
    options.externalId === undefined ? String(1000 + (counter += 1)) : options.externalId;
  const title = options.title ?? `Work ${externalId ?? unique()}`;

  const row = await db
    .insertInto("work")
    .values({
      club_id: clubId,
      title,
      type,
      external_id: externalId,
      image_url: options.imageUrl ?? null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  return { id: String(row.id), title, externalId, type };
}

export async function addToList(
  listId: string,
  workId: string,
  options: { position?: number; addedBy?: string; timeAdded?: Date } = {},
) {
  await db
    .insertInto("work_list_item")
    .values({
      list_id: listId,
      work_id: workId,
      ...(options.position === undefined ? {} : { position: options.position }),
      added_by_user_id: options.addedBy ?? null,
      ...(options.timeAdded === undefined ? {} : { time_added: options.timeAdded }),
    })
    .execute();
}

/** A work on the club's `reviews` list — the precondition for scoring it. */
export async function createReviewedWork(
  club: SeededClub,
  options: {
    title?: string;
    type?: WorkType;
    externalId?: string | null;
    imageUrl?: string | null;
    timeAdded?: Date;
  } = {},
): Promise<SeededWork> {
  const work = await createWork(club.id, options);
  await addToList(club.reviewsListId, work.id, { timeAdded: options.timeAdded });
  return work;
}

export async function createReview(
  listId: string,
  workId: string,
  userId: string,
  score: number,
  createdDate?: Date,
) {
  const row = await db
    .insertInto("review")
    .values({
      list_id: listId,
      work_id: workId,
      user_id: userId,
      score,
      ...(createdDate === undefined ? {} : { created_date: createdDate }),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return String(row.id);
}

export async function createComment(options: {
  workId: string;
  clubId: string;
  userId: string;
  content: string;
  spoiler?: boolean;
}) {
  const row = await db
    .insertInto("work_comment")
    .values({
      work_id: options.workId,
      club_id: options.clubId,
      user_id: options.userId,
      content: options.content,
      spoiler: options.spoiler ?? false,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return String(row.id);
}

export async function createInvite(
  clubId: string,
  options: { token?: string; expiresAt?: Date } = {},
) {
  const token = options.token ?? `invite-${unique()}`;
  await db
    .insertInto("club_invite")
    .values({
      club_id: clubId,
      token,
      expires_at: options.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    .execute();
  return token;
}

export async function createAwards(clubId: string, year: number, data: AwardsData) {
  await db
    .insertInto("awards_temp")
    .values({ club_id: clubId, year: String(year), data: JSON.stringify(data) })
    .execute();
}

/**
 * Prime the `movie_details` cache the way a real add would, so list and review
 * payloads carry external metadata without the handler needing to call TMDB.
 */
export async function cacheMovieDetails(externalId: string, overrides?: Partial<TMDBMovieData>) {
  await insertMovieDetails(externalId, tmdbMovie(Number(externalId), overrides), db);
}

/** A user who never signs in — enough to be a club member or a review's author. */
export async function createUser(options: { name?: string; email?: string } = {}) {
  const id = unique();
  const row = await db
    .insertInto("user")
    .values({
      name: options.name ?? `User ${id}`,
      email: options.email ?? `user-${id}@movie.club`,
      emailVerified: true,
      updatedAt: new Date(),
    })
    .returning(["id", "name", "email"])
    .executeTakeFirstOrThrow();
  return { userId: String(row.id), name: row.name, email: row.email };
}

export async function createNextWork(clubId: string, workId: string) {
  await db.insertInto("next_work").values({ club_id: clubId, work_id: workId }).execute();
}
