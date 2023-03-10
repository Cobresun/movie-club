import faunadb from "faunadb";

const q = faunadb.query;

export function getFaunaClient() {
  const faunaClient = new faunadb.Client({
    secret: process.env.FAUNADB_SERVER_SECRET ?? "",
  });
  return {
    faunaClient,
    q,
  };
}

export const getClubDocument = (clubId: number) => {
  return q.Get(q.Match(q.Index("club_by_clubId"), clubId));
};

export const getClubRef = (clubId: number) => {
  return q.Select("ref", getClubDocument(clubId));
};

export const getClubProperty = (
  clubId: number,
  ...path: (string | number)[]
) => {
  return q.Select(["data", ...path], getClubDocument(clubId));
};
