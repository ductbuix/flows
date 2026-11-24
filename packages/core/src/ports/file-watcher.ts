export type Disposable = { dispose(): void }

export type FileWatchChange = { path: string }

/** Filesystem changes matching globs; notifications are debounced (DES-041). */
export interface FileWatcher {
  watch(
    globs: readonly string[],
    onChange: (change: FileWatchChange) => void
  ): Disposable
}
