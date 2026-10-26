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
})
