// Build the search index when the server starts, so the first keystroke is as fast as the rest.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { search } = await import("./lib/search");
    search("அ");
  }
}
