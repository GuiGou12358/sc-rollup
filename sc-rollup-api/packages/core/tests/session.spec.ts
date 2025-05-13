import { assert, expect, test } from "vitest"
import { Session } from "../src/session"
import { Some } from "../src/types"

test("Empty session", async () => {
  const session = new Session()

  expect(session.currentIndex).toBeUndefined()
  expect(session.version).toBeUndefined()
  expect(session.values.size).toBe(0)
  expect(session.updates.size).toBe(0)
  expect(session.actions.length).toBe(0)
  expect(session.indexUpdated).toBeFalsy()
  expect(session.hasUpdates()).toBeFalsy()
})

test("Index updated", async () => {
  const session = new Session()
  session.indexUpdated = true
  expect(session.hasUpdates()).toBeTruthy()
})

test("With value", async () => {
  const session = new Session()
  session.values.set("0x1234", new Some("0x5678"))
  expect(session.hasUpdates()).toBeFalsy()
})

test("With update", async () => {
  const session = new Session()
  session.updates.set("0x1234", new Some("0x5678"))
  expect(session.hasUpdates()).toBeTruthy()
})

test("With action", async () => {
  const session = new Session()
  session.actions.push("0x0001")
  expect(session.hasUpdates()).toBeTruthy()
})
