exports.handler = async function(event, context) {
    const mockReviews = [
        {
            movieTitle: "Knives Out", 
            dateWatched: "Nov 1, 2020",
            scores: {
                "cole": 9,
                "brian": 10,
                "wes": 10,
                "sunny": 9.5,
                "average": 9.625
            }
        },
        {
            movieTitle: "Forrest Gump", 
            dateWatched: "Dec 13, 2020",
            scores: {
                "cole": 8.5,
                "brian": 9,
                "wes": 9.5,
                "sunny": 9,
                "average": 9
            }
        },
        {
            movieTitle: "Fight Club", 
            dateWatched: "Jan 3, 2021",
            scores: {
                "cole": 8,
                "brian": 9,
                "wes": 7.5,
                "sunny": 10,
                "average": 8.625
            }
        }
    ]

    return {
        statusCode: 200,
        body: JSON.stringify(mockReviews)
    }
}
