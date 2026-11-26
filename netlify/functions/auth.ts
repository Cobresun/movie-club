import { auth } from "./utils/auth";
import { toNetlifyHandler } from "./utils/authHandler";

const handler = toNetlifyHandler(auth);

export { handler };
