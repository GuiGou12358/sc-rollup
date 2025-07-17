import { expect, test } from "vitest"
import { Vrf } from "../src/vrf"
import { hexToU8a } from "@polkadot/util"

// random seed
const seed = hexToU8a(
  "0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
)

test("test preconditions", async () => {
  let vrf = Vrf.getFromSeed(seed)

  expect(() => vrf.getRandomNumber(hexToU8a("0x00"), 0, 0)).toThrowError()
  expect(() => vrf.getRandomNumber(hexToU8a("0x00"), -1, 1)).toThrowError()
  expect(() =>
    vrf.getRandomNumber(hexToU8a("0x00"), 0, 4294967297),
  ).toThrowError()
  expect(() => vrf.getRandomNumber(hexToU8a("0x"), 0, 10)).toThrowError()
  expect(vrf.getRandomNumber(hexToU8a("0x00"), 0, 4294967296) >= 0)
})

test("same input = same output", async () => {
  let vrf = Vrf.getFromSeed(seed)

  expect(vrf.getRandomNumber(hexToU8a("0x00"), 0, 1000)).toBe(
    vrf.getRandomNumber(hexToU8a("0x00"), 0, 1000),
  )
  expect(vrf.getRandomNumber(hexToU8a("0x01"), 0, 1000)).toBe(
    vrf.getRandomNumber(hexToU8a("0x01"), 0, 1000),
  )
  expect(vrf.getRandomNumber(hexToU8a("0x02"), 0, 1000)).toBe(
    vrf.getRandomNumber(hexToU8a("0x02"), 0, 1000),
  )
})

test("test verify method", async () => {
  let vrf = Vrf.getFromSeed(seed)

  let random = vrf.getRandomNumber(hexToU8a("0x00"), 0, 1000)
  expect(vrf.verify(hexToU8a("0x00"), 0, 1000, random)).toBe(true)
  // different salt
  expect(vrf.verify(hexToU8a("0x01"), 0, 1000, random)).toBe(false)
  // different max value
  expect(vrf.verify(hexToU8a("0x00"), 0, 999, random)).toBe(false)
  // different min value
  expect(vrf.verify(hexToU8a("0x00"), 1, 1000, random)).toBe(false)
})

test("test distribution", async () => {
  let vrf = Vrf.getFromSeed(seed)

  const times = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

  for (let i = 0; i < 10000; i++) {
    const r = vrf.getRandomNumber(hexToU8a(i.toString(16)), 1, 10)
    expect(r >= 1)
    expect(r < 10)
    times[r] = times[r] + 1
  }
  console.log(times)

  for (let i = 1; i <= 10; i++) {
    expect(times[i] >= 950)
    expect(times[i] <= 1050)
  }
  expect(times[0]).toBe(0)
  expect(times[11]).toBe(0)
})
