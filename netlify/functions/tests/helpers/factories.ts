import { AwardsStep, ClubAwards } from "../../../../lib/types/awards";
import { ClubType, WorkListSystemType, WorkType } from "../../../../lib/types/generated/db";
import { DetailedWorkListItem } from "../../../../lib/types/lists";
import { handler as clubHandler } from "../../club/index";
import { db } from "../../utils/database";
import { TestSession } from "./auth";
import { requester } from "./http";

/**
 * Arrange-phase seeding for the integration suite.
 *
 * Everything here drives the same endpoints a client uses, so a fixture cannot
 * describe a state the app is incapable of producing, and a bug in the write
 * path shows up as a failing test rather than as a fixture quietly papering
 * over it.
 *
 * One exception is marked below — expiring an invite has no endpoint at all —
 * and it is the only direct database write left in the suite.
 */

const api = requester(clubHandler);

let counter = 0;
const unique = () => `${Date.now().toString(36)}-${(counter += 1)}`;

/** Throw with the response body when a fixture's own request fails. */
function assertOk(what: string, response: { statusCode: number; raw?: string }) {
  if (response.statusCode >= 400) {
    throw new Error(`${what} failed: ${response.statusCode} ${response.raw ?? ""}`);
  }
}

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

interface ListSummary {
  id: string;
  title: string;
  systemType: WorkListSystemType | null;
  itemCount: number;
}

/**
 * Create a club through `POST /api/club`, so it is born with exactly the lists
 * and settings a real club gets.
 *
 * `owner` is the session that creates it. By default the owner is also its
 * first member (and therefore its admin); pass `members` to change that — an
 * empty array leaves the club with no members at all.
 */
export async function createClub(
  owner: TestSession,
  options: {
    name?: string;
    type?: ClubType;
    members?: TestSession[];
    features?: { awards?: boolean; discussionQuestions?: boolean };
  } = {},
): Promise<SeededClub> {
  const name = options.name ?? `Test Club ${unique()}`;
  const members = options.members ?? [owner];

  const created = await api.post<{ clubId: string; slug: string }>("/api/club", {
    body: {
      name,
      type: options.type ?? ClubType.movie,
      members: members.map((member) => member.email),
    },
    as: owner,
  });
  assertOk(`Creating club "${name}"`, created);

  const slug = created.body.slug;
  const lists = await api.get<ListSummary[]>(`/api/club/${slug}/list`);
  assertOk(`Reading lists for "${slug}"`, lists);

  // `reviews-id` and the settings write are both member-only. A club seeded
  // with no members still needs its reviews list id, so the owner joins for
  // the two reads and leaves again — cheaper than exposing the id another way.
  const seededWithoutMembers = members.length === 0;
  if (seededWithoutMembers) await joinClub({ slug }, owner);
  const member = members[0] ?? owner;

  const reviews = await api.get<{ id: string }>(`/api/club/${slug}/list/reviews-id`, {
    as: member,
  });
  assertOk(`Reading the reviews list id for "${slug}"`, reviews);

  if (options.features) {
    const updated = await api.post(`/api/club/${slug}/settings`, {
      body: { features: options.features },
      as: member,
    });
    assertOk(`Enabling features on "${slug}"`, updated);
  }

  if (seededWithoutMembers) await leaveClub({ slug }, owner);

  return {
    id: created.body.clubId,
    slug,
    name,
    type: options.type ?? ClubType.movie,
    listId: lists.body[0].id,
    reviewsListId: reviews.body.id,
  };
}

/** Join a club as `session` — the same route the invite-less join link uses. */
export async function joinClub(club: { slug: string }, session: TestSession) {
  const joined = await api.get(`/api/club/${club.slug}/members/join`, { as: session });
  assertOk(`${session.email} joining "${club.slug}"`, joined);
}

export async function leaveClub(club: { slug: string }, session: TestSession) {
  const left = await api.delete(`/api/club/${club.slug}/members/self`, { as: session });
  assertOk(`${session.email} leaving "${club.slug}"`, left);
}

/** Add a list beyond the club's default one. */
export async function createList(club: SeededClub, session: TestSession, title: string) {
  const created = await api.post<ListSummary>(`/api/club/${club.slug}/list`, {
    body: { title },
    as: session,
  });
  assertOk(`Creating list "${title}"`, created);
  return created.body.id;
}

export interface SeededWork {
  id: string;
  title: string;
  externalId: string | undefined;
  type: WorkType;
  /** The list the work was added to. */
  listId: string;
}

/**
 * Add a work to a list. The endpoint answers with no body, so the work is read
 * back off the list — which also proves the add landed.
 */
export async function addWork(
  club: SeededClub,
  session: TestSession,
  options: {
    listId?: string;
    title?: string;
    type?: WorkType;
    /** `null` adds a work with no external id, so it carries no metadata. */
    externalId?: string | null;
    imageUrl?: string;
    addedDate?: Date;
  } = {},
): Promise<SeededWork> {
  const listId = options.listId ?? club.listId;
  const type = options.type ?? WorkType.movie;
  const externalId =
    options.externalId === null ? undefined : (options.externalId ?? String(1000 + (counter += 1)));
  const title = options.title ?? `Work ${externalId ?? unique()}`;

  const added = await api.post(`/api/club/${club.slug}/list/${listId}/items`, {
    body: {
      type,
      title,
      ...(externalId === undefined ? {} : { externalId }),
      ...(options.imageUrl === undefined ? {} : { imageUrl: options.imageUrl }),
    },
    as: session,
  });
  assertOk(`Adding "${title}" to list ${listId}`, added);

  const items = await api.get<DetailedWorkListItem[]>(`/api/club/${club.slug}/list/${listId}`);
  assertOk(`Reading list ${listId}`, items);
  const item = items.body.findLast((candidate) => candidate.title === title);
  if (!item) {
    throw new Error(`Added "${title}" to list ${listId} but it is not on the list`);
  }

  if (options.addedDate) {
    await setAddedDate(club, session, listId, item.id, options.addedDate);
  }

  return { id: item.id, title, externalId, type, listId };
}

export async function setAddedDate(
  club: SeededClub,
  session: TestSession,
  listId: string,
  workId: string,
  addedDate: Date,
) {
  const updated = await api.put(
    `/api/club/${club.slug}/list/${listId}/items/${workId}/added-date`,
    { body: { addedDate: addedDate.toISOString() }, as: session },
  );
  assertOk(`Setting the added date of work ${workId}`, updated);
}

/** A work on the club's `reviews` list — the precondition for scoring it. */
export function addReviewedWork(
  club: SeededClub,
  session: TestSession,
  options: Parameters<typeof addWork>[2] = {},
): Promise<SeededWork> {
  return addWork(club, session, { ...options, listId: club.reviewsListId });
}

export async function scoreWork(
  club: SeededClub,
  session: TestSession,
  workId: string,
  score: number,
) {
  const scored = await api.post(`/api/club/${club.slug}/reviews`, {
    body: { workId, score },
    as: session,
  });
  assertOk(`${session.email} scoring work ${workId}`, scored);
}

export async function addComment(
  club: SeededClub,
  session: TestSession,
  workId: string,
  content: string,
  spoiler = false,
) {
  const added = await api.post(`/api/club/${club.slug}/reviews/${workId}/comments`, {
    body: { content, spoiler },
    as: session,
  });
  assertOk(`${session.email} commenting on work ${workId}`, added);

  const comments = await api.get<{ id: string; content: string }[]>(
    `/api/club/${club.slug}/reviews/${workId}/comments`,
    { as: session },
  );
  const comment = comments.body.findLast((candidate) => candidate.content === content);
  if (!comment) {
    throw new Error(`Added a comment to work ${workId} but it is not on the work`);
  }
  return comment.id;
}

export async function setNextWork(club: SeededClub, session: TestSession, workId: string) {
  const set = await api.put(`/api/club/${club.slug}/nextWork`, { body: { workId }, as: session });
  assertOk(`Setting the next work of "${club.slug}"`, set);
}

export async function createInvite(club: SeededClub, session: TestSession) {
  const created = await api.post<{ token: string }>(`/api/club/${club.slug}/invite`, {
    as: session,
  });
  assertOk(`Creating an invite for "${club.slug}"`, created);
  return created.body.token;
}

/** Open an awards year through `POST /awards`; it starts on the categories step. */
export async function createAwardsYear(
  club: SeededClub,
  session: TestSession,
  year: number,
  categories: string[] = [],
) {
  const created = await api.post(`/api/club/${club.slug}/awards`, {
    body: { year, categories },
    as: session,
  });
  assertOk(`Opening ${year} awards for "${club.slug}"`, created);
}

/** Walk an awards year one step at a time, the only way the step endpoint moves. */
export async function setAwardsStep(
  club: SeededClub,
  session: TestSession,
  year: number,
  step: AwardsStep,
) {
  const current = await api.get<ClubAwards>(`/api/club/${club.slug}/awards/${year}`);
  assertOk(`Reading ${year} awards for "${club.slug}"`, current);

  let at = current.body.step;
  while (at !== step) {
    at += Math.sign(step - at);
    const moved = await api.put(`/api/club/${club.slug}/awards/${year}/step`, {
      body: { step: at },
      as: session,
    });
    assertOk(`Moving ${year} awards to step ${at}`, moved);
  }
}

export async function nominate(
  club: SeededClub,
  session: TestSession,
  year: number,
  awardTitle: string,
  movieId: number,
) {
  const nominated = await api.post(`/api/club/${club.slug}/awards/${year}/nomination`, {
    body: { awardTitle, movieId },
    as: session,
  });
  assertOk(`${session.email} nominating ${movieId} for "${awardTitle}"`, nominated);
}

export async function rankAward(
  club: SeededClub,
  session: TestSession,
  year: number,
  awardTitle: string,
  movies: number[],
) {
  const ranked = await api.post(`/api/club/${club.slug}/awards/${year}/ranking`, {
    body: { awardTitle, movies },
    as: session,
  });
  assertOk(`${session.email} ranking "${awardTitle}"`, ranked);
}

// --- The one state no endpoint can produce -------------------------------

/**
 * Backdate an invite so it is already expired.
 *
 * `POST /invite` always issues a 24-hour token and nothing can shorten it, so
 * the expiry branches are unreachable through the API. Direct write, kept to
 * this one column.
 */
export async function expireInvite(token: string) {
  await db
    .updateTable("club_invite")
    .set({ expires_at: new Date(Date.now() - 60_000) })
    .where("token", "=", token)
    .execute();
}
