import { describe, expect, it } from "vitest"

import {
  canAssignEmployeeRole,
  canAssignMembershipRole,
  canManageAccessTarget,
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

describe("access grant policy", () => {
  it("lets only owner create membership universal authority", () => {
    expect(canAssignMembershipRole("owner", "owner")).toBe(true)
    expect(canAssignMembershipRole("owner", "admin")).toBe(true)
    expect(canAssignMembershipRole("admin", "owner")).toBe(false)
    expect(canAssignMembershipRole("admin", "admin")).toBe(false)
    expect(canAssignMembershipRole("admin", "member")).toBe(true)
  })

  it("lets only owner create employee-admin authority", () => {
    expect(canAssignEmployeeRole("owner", "admin")).toBe(true)
    expect(canAssignEmployeeRole("admin", "admin")).toBe(false)
    expect(canAssignEmployeeRole("admin", "executive")).toBe(true)
    expect(canAssignEmployeeRole("admin", "manager")).toBe(true)
    expect(canAssignEmployeeRole("admin", "foreman")).toBe(true)
    expect(canAssignEmployeeRole("admin", "staff")).toBe(true)
  })

  it("lets admin manage ordinary members only", () => {
    expect(
      canManageAccessTarget("admin", "member", "executive")
    ).toBe(true)

    expect(
      canManageAccessTarget("admin", "member", "manager")
    ).toBe(true)

    expect(
      canManageAccessTarget("admin", "admin", "staff")
    ).toBe(false)

    expect(
      canManageAccessTarget("admin", "owner", "staff")
    ).toBe(false)

    expect(
      canManageAccessTarget("admin", "member", "admin")
    ).toBe(false)
  })

  it("keeps executive out of permission management", () => {
    expect(
      canAssignEmployeeRole("member", "executive")
    ).toBe(false)

    expect(
      canManageAccessTarget("member", "member", "staff")
    ).toBe(false)
  })

  it("fails closed for unknown roles", () => {
    expect(
      canAssignMembershipRole("admin", "super-admin")
    ).toBe(false)

    expect(
      canAssignEmployeeRole("admin", "super-admin")
    ).toBe(false)
  })
})
