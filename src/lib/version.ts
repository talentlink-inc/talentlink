// Computed once at build time in next.config.ts (see the comment there for
// why it has to happen there and not here) and inlined via the `env` config
// option — this just reads the baked-in value back out.
export const APP_VERSION = process.env.APP_VERSION ?? "dev";
