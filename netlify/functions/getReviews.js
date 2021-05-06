// eslint-disable-next-line @typescript-eslint/no-var-requires
const faunadb = require('faunadb')

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET })
const q = faunadb.query

exports.handler = async function(event, context) {
    try {
        const req = await faunaClient.query(
            q.Map(
                q.Paginate(
                    q.Match(
                        q.Index("all_reviews")
                    )
                ), 
                q.Lambda(
                    "attr", 
                    q.Get(
                        q.Var("attr")
                    )
                )
            )
        )

        let scrapedReviews = []
        req.data.forEach(review => {
            scrapedReviews.push(review.data)
        });

        return { statusCode: 200, body: JSON.stringify(scrapedReviews) }
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message}) }
    }
}
