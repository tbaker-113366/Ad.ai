import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "ad-ai" });

/** Event names. Keep in one place so jobs and senders agree. */
export const EVENTS = {
  healthcheck: "system/healthcheck.requested",
} as const;
