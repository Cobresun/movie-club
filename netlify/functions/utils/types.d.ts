import { values } from "faunadb";

export type QueryResponse<T> = {
    data: values.Document<T>[]
}