exports.handler = async function(event, context) {
    const mockWatchList = [
        {
            movieTitle: "Die Hard", 
            dateAdded: "Nov 1, 2020",
            addedBy: "Brian",
            dateReleased: "Jan 13, 1845",
            genre: "Action/Adventure"
        },
        {
            movieTitle: "2001: A Space Odyssey", 
            dateAdded: "Nov 1, 2020",
            addedBy: "Wes",
            dateReleased: "Feb 13, 1623",
            genre: "Thriller"
        },
        {
            movieTitle: "Citizen Kane", 
            dateAdded: "Nov 12, 2019",
            addedBy: "Brian",
            dateReleased: "Mar 3, 2200",
            genre: "Thriller"
        }
    ]

    return {
        statusCode: 200,
        body: JSON.stringify(mockWatchList)
    }
}
