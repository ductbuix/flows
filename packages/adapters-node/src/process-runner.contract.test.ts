import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach } from "vitest"
import { describeProcessRunnerContract } from "@workspace/core/testing/process-runner.contract"
import { createFakeProcessRunner } from "@workspace/core/testing"
import { createNodeProcessRunner } from "./process-runner.ts"

const temps: string[] = []

afterEach(() => {
  while (temps.length > 0) {
    rmSync(temps.pop()!, { recursive: true, force: true })
  }
})

describeProcessRunnerContract("ProcessRunner", [
  [
    "fake",
    () => {
      const fake = createFakeProcessRunner()
      fake.on("/bin/echo", (spec) => ({
        stdout: `${spec.args?.[0] ?? ""}\n`,
        exitCode: 0,
      }))
      fake.on("/bin/sh", (spec) => {
        const script = spec.args?.[1] ?? ""
        if (script.includes("sleep")) {
          return new Promise(() => {
            /* hang until abort */
          })
        }
        const fail = /echo ([^>&]*) >&2; exit (\d+)/.exec(script)
        if (fail) {
          return { stderr: fail[1]!.trim(), exitCode: Number(fail[2]) }
        }
        return { exitCode: 0 }
      })
      return {
        runner: fake,
        sandboxRoot: "/tmp/flowapp-fake-sandbox",
        echoSpec: (text) => ({ command: "/bin/echo", args: [text] }),
        exitSpec: (code, stderr = "") => ({
          command: "/bin/sh",
          args: ["-c", `echo ${stderr} >&2; exit ${code}`],
        }),
        hangSpec: () => ({
          command: "/bin/sh",
          args: ["-c", "sleep 60"],
        }),
      }
    },
  ],
  [
    "node",
    () => {
      const root = mkdtempSync(join(tmpdir(), "flowapp-proc-"))
      temps.push(root)
      mkdirSync(root, { recursive: true })
      // Workflows live at <home>/workflows/<id>; secrets at <home>/secrets.
      const home = mkdtempSync(join(tmpdir(), "flowapp-proc-home-"))
      temps.push(home)
      const wf = join(home, "workflows", "w1")
      mkdirSync(wf, { recursive: true })
      return {
        runner: createNodeProcessRunner(),
        sandboxRoot: wf,
        echoSpec: (text) => ({
          command: "/bin/echo",
          args: [text],
          cwd: root,
        }),
        exitSpec: (code, stderr = "boom") => ({
          command: "/bin/sh",
          args: ["-c", `printf '%s' '${stderr}' >&2; exit ${code}`],
          cwd: root,
        }),
        hangSpec: () => ({
          command: "/bin/sh",
          args: ["-c", "sleep 60"],
          cwd: root,
        }),
      }
    },
  ],
])
