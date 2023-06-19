import { values } from "faunadb";

export type Document<T> = values.Document<T>;

export type StringRecord = Record<string, string>;
