/** Stub so the utilityProcess host can load createEngine without playwright. */
module.exports = {
  chromium: {
    launchPersistentContext() {
      return Promise.reject(
        new Error("playwright-core is not available in the desktop host")
      )
    },
  },
}
