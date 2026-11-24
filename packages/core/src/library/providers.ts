import {
  DEFAULT_PROVIDERS,
  detect,
  providerToYaml,
  safeParseProviderYaml,
  type ProviderDescriptor,
  type ProviderMatch,
} from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import type { DocumentStore } from "../ports/document-store.ts"

export const PROVIDERS_GLOB = "providers/*.yaml"

const PROVIDER_PATH_RE = /^providers\/([^/]+)\.yaml$/

export function providerPath(id: string): string {
  return `providers/${id}.yaml`
}

export function providerIdFromPath(path: string): string | null {
  return PROVIDER_PATH_RE.exec(path.replace(/\\/g, "/"))?.[1] ?? null
}

export type ProviderServiceDeps = {
  docs: DocumentStore
  /** Extra presets from plugins; merged after the shipped defaults. */
  presets?: readonly ProviderDescriptor[]
}

export function createProviderService(
  deps: ProviderServiceDeps
): ProviderService {
  return new ProviderService(deps)
}

export class ProviderService {
  private readonly presets: readonly ProviderDescriptor[]

  constructor(private readonly deps: ProviderServiceDeps) {
    this.presets = [
      ...DEFAULT_PROVIDERS,
      ...(deps.presets ?? []).filter(
        (p) => !DEFAULT_PROVIDERS.some((d) => d.id === p.id)
      ),
    ]
    this.ensurePresets()
  }

  list(): ProviderDescriptor[] {
    return this.listRecords().sort((a, b) => a.id.localeCompare(b.id))
  }

  save(provider: ProviderDescriptor): void {
    const path = providerPath(provider.id)
    const text = providerToYaml(provider)
    const written = this.deps.docs.write(path, text)
    if (!written.ok) {
      throw engineError("conflict", "Could not save provider")
    }
  }

  match(url: string): ProviderMatch | null {
    return detect(url, this.list())
  }

  private ensurePresets(): void {
    for (const preset of this.presets) {
      const path = providerPath(preset.id)
      if (this.deps.docs.read(path)) continue
      this.deps.docs.write(path, providerToYaml(preset))
    }
  }

  private listRecords(): ProviderDescriptor[] {
    const out: ProviderDescriptor[] = []
    for (const path of this.deps.docs.list(PROVIDERS_GLOB)) {
      const id = providerIdFromPath(path)
      if (!id) continue
      const record = this.tryRead(id)
      if (record) out.push(record)
    }
    return out
  }

  private tryRead(id: string): ProviderDescriptor | null {
    const disk = this.deps.docs.read(providerPath(id))
    if (!disk) return null
    const parsed = safeParseProviderYaml(disk.text)
    if (!parsed.success) return null
    if (parsed.data.id !== id) return null
    return parsed.data
  }
}
