import faunadb from 'faunadb';

export function getFaunaClient() {
  const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET ?? "" })
  const q = faunadb.query
  return {
    faunaClient,
    q
  }
}