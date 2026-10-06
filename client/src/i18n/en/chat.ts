/** The room chat's own words; what the server announces is in notices.ts. */
export const chat = {
  /** The viewer's own lines are marked. */
  you: (name: string) => `${name} (you)`,
};
