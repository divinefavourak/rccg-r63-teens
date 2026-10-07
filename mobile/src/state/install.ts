/**
 * Putting the web app on a Home Screen.
 *
 * Nothing to do in the app itself: it is installed already. `install.web.ts`
 * is the version the browser gets.
 */

/** How this browser installs the web app, or null when there is nothing to offer. */
export type InstallWay =
  /** iPhone and iPad: only by hand, through the Share menu. */
  | 'share-menu'
  /** Android and desktop Chrome: the browser has a dialog the page can open. */
  | 'dialog'
  | null;

/** Start the parts of the web app that run outside a page. */
export function startWebApp(): void {}

export function useInstall(): { way: InstallWay; install: () => Promise<void> } {
  return { way: null, install: async () => {} };
}
