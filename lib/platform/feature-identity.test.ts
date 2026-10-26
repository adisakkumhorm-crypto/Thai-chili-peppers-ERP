import { describe, expect, it } from "vitest"

import {
  expandFeatureIdentity,
  hasNormalizedFeatureAccess,
  normalizeAllowedFeatures,
} from "./feature-identity"

describe("feature identity compatibility", () => {
  it("preserves canonical route permissions", () => {
    expect(expandFeatureIdentity("/finance")).toEqual([
      "/finance",
    ])
  })

  it("expands legacy grouped permissions conservatively", () => {
    expect(expandFeatureIdentity("hr")).toEqual([
      "/hr",
      "/hr/payroll",
    ])

    expect(expandFeatureIdentity("finance")).toEqual([
      "/finance",
      "/purchases",
    ])

    expect(expandFeatureIdentity("settings")).toEqual([
      "/settings",
      "/team",
    ])
  })

  it("de-duplicates mixed legacy and canonical values", () => {
    expect(
      normalizeAllowedFeatures([
        "inventory",
        "/inventory",
        "finance",
        "/finance",
        "/purchases",
      ])
    ).toEqual([
      "/inventory",
      "/finance",
      "/purchases",
    ])
  })

  it("supports nested route access", () => {
    expect(
      hasNormalizedFeatureAccess(
        ["hr"],
        "/hr/payroll/preview"
      )
    ).toBe(true)
  })

  it("fails closed for unknown legacy identities", () => {
    expect(expandFeatureIdentity("unknown-feature")).toEqual([])
    expect(
      hasNormalizedFeatureAccess(
        ["unknown-feature"],
        "/finance"
      )
    ).toBe(false)
  })

  it("normalizes mixed legacy and canonical stored values safely", () => {
    const normalized = normalizeAllowedFeatures([
      "dashboard",
      "projects",
      "inventory",
      "sales",
      "hr",
      "finance",
      "settings",
      "/clients",
      "/deals",
      "/projects",
      "/inventory",
      "/products",
      "/sales",
      "/hr",
      "/hr/payroll",
      "/suppliers",
      "/purchases",
      "/finance",
      "/team",
      "/settings",
    ])

    expect(normalized).toContain("/dashboard")
    expect(normalized).toContain("/projects")
    expect(normalized).toContain("/deals")
    expect(normalized).toContain("/inventory")
    expect(normalized).toContain("/sales")
    expect(normalized).toContain("/hr")
    expect(normalized).toContain("/hr/payroll")
    expect(normalized).toContain("/finance")
    expect(normalized).toContain("/purchases")
    expect(normalized).toContain("/settings")
    expect(normalized).toContain("/team")

    expect(normalized).not.toContain("finance")
    expect(normalized).not.toContain("projects")

    expect(new Set(normalized).size).toBe(
      normalized.length
    )
  })
})
