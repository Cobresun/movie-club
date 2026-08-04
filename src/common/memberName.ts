/**
 * Members are stored with their full name, but compact UI (score chips, chart
 * labels) only has room for the part that identifies them at a glance.
 */
export function firstName(name: string): string {
  return name.split(" ")[0];
}
