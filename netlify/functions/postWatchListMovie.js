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
    if (!body.user) {
        return response(400, {
            message: 'No user specified. Please specify a user.'
        });
    }
    if (!body.movieTitle) {
        return response(400, {
            message: 'No movieTitle specified. Please specify a movieTitle.'
        });
    }

    try {
        const req = await faunaClient.query(
            q.Create(
                q.Collection("watchList"),
                {
                    data: {
                        "movieId": parseInt(body.movieId),
                        "movieTitle": body.movieTitle,
                        "timeAdded": q.Now(),
                        "addedBy": body.user
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