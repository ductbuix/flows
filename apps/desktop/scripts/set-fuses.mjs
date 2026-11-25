// Flip Electron fuses on a packaged app: node scripts/set-fuses.mjs <Electron.app|binary>
import { flipFuses, FuseV1Options, FuseVersion } from "@electron/fuses"

const target = process.argv[2]
if (!target) {
  console.error("usage: set-fuses.mjs <path to packaged Electron app/binary>")
  process.exit(1)
}

await flipFuses(target, {
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
})
console.log(`fuses set on ${target}`)
