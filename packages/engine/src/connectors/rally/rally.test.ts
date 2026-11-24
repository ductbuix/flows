import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http"
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { connectionSchema } from "../../connection-model.ts"
import { pullEntity, resolveScopeEntity } from "../../library.ts"
import { libraryEntityDir } from "../../paths.ts"
import { writeCookies } from "../../secrets.ts"
import { clearConnectors, registerConnector } from "../registry.ts"
import { createRallyConnector, rallyConnector } from "./index.ts"
import { COMMENT_MD, ITEM_JSON, writePulledItem } from "./files.ts"
import {
  installTestConnectionStore,
  resetTestConnectionStore,
} from "../../test-connections.ts"

const dirs: string[] = []
let server: Server | undefined
let baseUrl = ""
let expireUser = false
const published: Array<{ method: string; path: string; body: string }> = []

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (c) => chunks.push(c as Buffer))
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(text),
  })
  res.end(text)
}

function storyBody() {
  return {
    HierarchicalRequirement: {
      ObjectID: 42,
      FormattedID: "US42",
      Name: "Payments checkout",
      Description: "<p>As a user I can pay.</p>",
      ScheduleState: "Defined",
      _objectVersion: "7",
      _ref: "/hierarchicalrequirement/42",
      _typeName: "HierarchicalRequirement",
    },
  }
}

async function startStub(): Promise<string> {
  published.length = 0
  expireUser = false
  server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1")
      const path = url.pathname
      const method = req.method ?? "GET"
      const cookie = req.headers.cookie ?? ""
      if (!cookie.includes("ZSESSIONID=good")) {
        send(res, 401, {
          OperationResult: { Errors: ["Not authorized"] },
        })
        return
      }
      if (method === "GET" && path === "/slm/webservice/v2.0/user") {
        if (expireUser) {
          send(res, 401, {
            OperationResult: { Errors: ["Not authorized"] },
          })
          return
        }
        send(res, 200, { User: { DisplayName: "Test User" } })
        return
      }
      if (
        method === "GET" &&
        path === "/slm/webservice/v2.0/hierarchicalrequirement/US42"
      ) {
        send(res, 200, storyBody())
        return
      }
      if (
        method === "GET" &&
        path === "/slm/webservice/v2.0/hierarchicalrequirement/42"
      ) {
        send(res, 200, storyBody())
        return
      }
      if (method === "GET" && path === "/slm/webservice/v2.0/defect/DE1") {
        send(res, 200, {
          Defect: {
            ObjectID: 9,
            FormattedID: "DE1",
            Name: "Null pointer",
            Description: "Boom",
            ScheduleState: "In-Progress",
            _objectVersion: "3",
            _ref: "/defect/9",
          },
        })
        return
      }
      if (
        method === "GET" &&
        path === "/slm/webservice/v2.0/security/authorize"
      ) {
        send(res, 200, {
          OperationResult: { Errors: [], SecurityToken: "tok-1" },
        })
        return
      }
      if (
        method === "PUT" &&
        path.startsWith("/slm/webservice/v2.0/hierarchicalrequirement/42")
      ) {
        const body = await readBody(req)
        published.push({ method, path: `${path}?${url.searchParams}`, body })
        send(res, 200, { HierarchicalRequirement: { ObjectID: 42 } })
        return
      }
      if (
        method === "POST" &&
        path.startsWith("/slm/webservice/v2.0/conversationpost/create")
      ) {
        const body = await readBody(req)
        published.push({ method, path: `${path}?${url.searchParams}`, body })
        send(res, 200, {
          CreateResult: { Errors: [], Object: { ObjectID: 1 } },
        })
        return
      }
      send(res, 404, { OperationResult: { Errors: ["not found"] } })
    })()
  })
  await new Promise<void>((resolve) => {
    server!.listen(0, "127.0.0.1", () => resolve())
  })
  const addr = server.address()
  if (!addr || typeof addr === "string") throw new Error("no address")
  baseUrl = `http://127.0.0.1:${addr.port}`
  return baseUrl
}

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

function seedCookies(home: string, id: string): void {
  writeCookies(home, id, [
    {
      name: "ZSESSIONID",
      value: "good",
      domain: "127.0.0.1",
      path: "/",
    },
  ])
}

afterEach(async () => {
  clearConnectors()
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((err) => (err ? reject(err) : resolve()))
    })
    server = undefined
  }
})

beforeEach(async () => {
  await startStub()
  registerConnector(createRallyConnector())
})

describe("rally connector", () => {
  beforeEach(() => installTestConnectionStore())
  afterEach(() => resetTestConnectionStore())
  it("describe lists story, defect and cookies sign-in", () => {
    const desc = rallyConnector.describe()
    expect(desc.id).toBe("rally")
    expect(desc.entityKinds).toEqual(["story", "defect"])
    expect(desc.scopeFields).toContain("workspace")
    expect(desc.scopeFields).toContain("project")
    expect(desc.signInMethods).toEqual(["cookies"])
  })

  it("resolveScopeEntity uses workspace/project", () => {
    const connection = connectionSchema.parse({
      id: "rally-payments",
      connector: "rally",
      name: "Payments Rally",
      scope: {
        workspace: "ws1",
        project: "proj1",
        url: baseUrl,
      },
      signIn: "cookies",
      refresh: "1h",
    })
    expect(resolveScopeEntity(connection)).toEqual({
      kind: "story",
      entityId: "ws1/proj1",
      title: "Payments Rally",
    })
  })

  it("check detects missing and expired cookies", async () => {
    const home = tempDir("flowapp-rally-check-")
    const connection = connectionSchema.parse({
      id: "rally-payments",
      connector: "rally",
      name: "Payments Rally",
      scope: { workspace: "ws1", project: "p1", url: baseUrl },
      signIn: "cookies",
      refresh: "never",
    })
    const connector = createRallyConnector()
    expect(await connector.check(connection, home)).toEqual({
      ok: false,
      message: "not signed in",
    })
    seedCookies(home, "rally-payments")
    expect(await connector.check(connection, home)).toEqual({
      ok: true,
      message: "rally sign-in ok",
    })
    expireUser = true
    expect(await connector.check(connection, home)).toEqual({
      ok: false,
      message: "cookies expired",
    })
  })

  it("pull writes item.json and item.md for a story", async () => {
    const home = tempDir("flowapp-rally-pull-")
    const connection = connectionSchema.parse({
      id: "rally-payments",
      connector: "rally",
      name: "Payments Rally",
      scope: { workspace: "ws1", project: "p1", url: baseUrl },
      signIn: "cookies",
      refresh: "never",
    })
    seedCookies(home, "rally-payments")
    const pulled = await pullEntity({
      home,
      connection,
      kind: "story",
      entityId: "US42",
      title: "Payments checkout",
      force: true,
    })
    expect(pulled.revision).toBe("7")
    const revDir = join(
      libraryEntityDir(home, "rally-payments", "story", "US42"),
      pulled.revision
    )
    expect(existsSync(join(revDir, ITEM_JSON))).toBe(true)
    const md = readFileSync(join(revDir, "item.md"), "utf8")
    expect(md).toContain("# Payments checkout")
    expect(md).toContain("FormattedID: US42")
    expect(md).toContain("As a user I can pay.")
  })

  it("diff and publish support a comment and a field change", async () => {
    const home = tempDir("flowapp-rally-pub-")
    const connection = connectionSchema.parse({
      id: "rally-payments",
      connector: "rally",
      name: "Payments Rally",
      scope: { workspace: "ws1", project: "p1", url: baseUrl },
      signIn: "cookies",
      refresh: "never",
    })
    seedCookies(home, "rally-payments")
    const connector = createRallyConnector()
    const baseDir = join(home, "base")
    const workDir = join(home, "work")
    mkdirSync(baseDir, { recursive: true })
    mkdirSync(workDir, { recursive: true })
    const object = {
      ObjectID: 42,
      FormattedID: "US42",
      Name: "Payments checkout",
      ScheduleState: "Defined",
      _ref: "/hierarchicalrequirement/42",
      _typeName: "HierarchicalRequirement",
    }
    writePulledItem(baseDir, object)
    writePulledItem(workDir, { ...object, ScheduleState: "In-Progress" })
    writeFileSync(join(workDir, COMMENT_MD), "Shipped the happy path.\n")

    const changeSet = await connector.diff({
      connection,
      workCopyDir: workDir,
      baseDir,
    })
    expect(changeSet.ops.map((o) => o.op).sort()).toEqual(["comment", "field"])
    const publishedResult = await connector.publish(connection, changeSet, home)
    expect(publishedResult.status).toBe("applied")
    expect(published.some((p) => p.method === "PUT")).toBe(true)
    expect(published.some((p) => p.method === "POST")).toBe(true)
    const put = published.find((p) => p.method === "PUT")
    expect(put?.body).toContain("In-Progress")
    const post = published.find((p) => p.method === "POST")
    expect(post?.body).toContain("Shipped the happy path.")
  })
})
