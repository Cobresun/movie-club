import { values } from "faunadb";

export type QueryListResponse<T> = {
  data: values.Document<T>[];
};

export type QueryResponse<T> = {
  data: T;
};

export type StringRecord = Record<string, string>;
