import { Member } from "@/common/types/models"
import { Handler, HandlerEvent } from "@netlify/functions"
import { getFaunaClient } from "./utils/fauna"
import { badRequest, ok } from "./utils/responses"
import { QueryListResponse } from "./utils/types"

const { faunaClient, q } = getFaunaClient();

/**
 * 
 * GET /member/:email -> returns data for the member by email
 * 
 */
 
 const handler: Handler = async function(event: HandlerEvent) {
    if (event.httpMethod === 'GET') {
        const pathArray = event.path.split("/")
        const emailIndex = pathArray.indexOf('member') + 1
        const email = pathArray[emailIndex]

        const req: QueryListResponse<Member[]> = await faunaClient.query(
            q.Map(
                q.Paginate(
                    q.Match(
                        q.Index("members_by_email"),
                        email
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

        const responseBody = req.data[0].data

        return ok(JSON.stringify(responseBody))
    } else {
        return badRequest("You are not using a http GET method for this endpoint.")
    }
}

export { handler }
