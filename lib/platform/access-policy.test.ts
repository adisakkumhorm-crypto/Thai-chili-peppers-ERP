import { describe, expect, it } from "vitest"

import {
  hasUniversalFeatureAccess,
} from "./access-policy"

describe("feature access policy", () => {
  it("allows membership owner", () => {
    expect(
      hasUniversalFeatureAccess({
        membershipRole: "owner",
        employeeRole: "staff",
      })
    ).toBe(true)
  })

  it("allows membership admin", () => {
    expect(
      hasUniversalFeatureAccess({
        membershipRole: "admin",
        employeeRole: "staff",
      })
    ).toBe(true)
  })

  it("allows employee admin", () => {
    expect(
      hasUniversalFeatureAccess({
        membershipRole: "member",
        employeeRole: "admin",
      })
    ).toBe(true)
  })

  it("does not make executive a global bypass", () => {
    expect(
      hasUniversalFeatureAccess({
        membershipRole: "member",
        employeeRole: "executive",
      })
    ).toBe(false)
  })

  it("does not allow ordinary employee roles", () => {
    expect(
      hasUniversalFeatureAccess({
        membershipRole: "member",
        employeeRole: "manager",
      })
    ).toBe(false)
  })
})
