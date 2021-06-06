/* eslint-disable @typescript-eslint/no-var-requires */
const faunadb = require('faunadb')

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET })
const q = faunadb.query

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 400,
            body: 'You are not using a http POST method for this endpoint.',
            headers: {
                'Allow': 'POST'
            }
        }
    }

    let body = event.queryStringParameters
    if (body.name === "" || !body.movieId) {
        return {
            statusCode: 400,
            body: 'No movieId specified. Please specify a movieId.'
        }
    } else if (!body.user) {
        return {
            statusCode: 400,
            body: 'No user specified. Please specify a user.'
        }
    } else if (!body.score) {
        return {
            statusCode: 400,
            body: 'No score specified. Please specify a score.'
        }
    }

    try {
        // Gets existing scores in the review
        const getReviewScoresQuery = await faunaClient.query(
            q.Map(
                q.Paginate(
                    q.Match(
                        q.Index("reviews_by_movieId"),
                        parseInt(body.movieId)
                    )
                ),
                q.Lambda(
                    "X",
                    q.Get(
                        q.Var("X")
                    )
                )
            )
        )

        // Updates existing scores with new review
        let scores = getReviewScoresQuery.data[0].data.scores
        scores[body.user] = parseFloat(body.score)

        if (scores['average'] === undefined) {
            // If no existing average, set the average to the current review's score
            scores['average'] = parseFloat(body.score)
        } else {
            const numberOfScores = Object.keys(scores).length - 1
            scores['average'] = 0

            Object.keys(scores)
                .filter(user => user !== 'average')
                .map(user => scores.average += scores[user])

            scores['average'] = scores['average']/numberOfScores
        }

        const updateReviewScoresQuery = await faunaClient.query(
            q.Update(
                q.Select(
                    "ref",
                    q.Get(
                        q.Match(
                            q.Index("reviews_by_movieId"),
                            parseInt(body.movieId)
                        )
                    )
                ),
                {
                    data: { scores: scores }
                }
            )
        )

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateReviewScoresQuery.data)
        }
    } catch (err) {
        console.error(err)
        return { statusCode: 500, body: JSON.stringify({ error: err.message}) }
    }
}
