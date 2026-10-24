export const HOME_PATH = "/chat";

// Only same-site paths are allowed after sign-in, so a crafted ?next= link can't redirect off-site.
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return HOME_PATH;
  }
  return value;
}
