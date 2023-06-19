export interface Header {
  value: string;
  style?: string;
  title?: string;
  sortable?: boolean;
  includeHeader?: boolean;
  centerHeader?: boolean;
}

export type DateObject = {
  "@ts": string;
};
