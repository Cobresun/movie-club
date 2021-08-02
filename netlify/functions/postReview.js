/* eslint-disable @typescript-eslint/no-var-requires */
const faunadb = require('faunadb')

const faunaClient = new faunadb.Client({ secret: process.env.FAUNADB_SERVER_SECRET })
const q = faunadb.query

exports.handler = async function(event, context) {
    if (!context.clientContext.user) {
        return response(401, {
            message: 'You are not authorized to perform this action'
        });
    }

    if (event.httpMethod !== 'POST') {
        return response(400, { 
            message: 'You are not using http POST Method for this endpoint'
        });
    }

    let body = event.queryStringParameters
    if (body.name === "" || !body.movieId) {
        return response(400, {
            message: 'No movieId specified. Please specify a movieId.'
        });
    } 

    if (!body.movieTitle) {
        return response(400, {
            message: 'No movieTitle specified. Please specify a movieTitle.'
        });
    }

    try {
        let date = new Date()
        date = date.toISOString().slice(0, 10)

        const req = await faunaClient.query(
            q.Create(
                q.Collection("reviews"),
                {
                    data: {
                        "movieId": parseInt(body.movieId),
                        "movieTitle": body.movieTitle,
                        "dateWatched": q.Date(`${date}`),
                        "scores": { }
                    }
                }
            )
        )

        return response(200, req.data);
    } catch (err) {
        console.error(err)
        return response(500, { error: err.message });
    }
}

function response(code, body) {
    return {
        statusCode: code,
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    };
}