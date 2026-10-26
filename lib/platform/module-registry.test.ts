import { describe, expect, it } from "vitest"

import {
  getModule,
  getModuleForRoute,
} from "./module-registry"

describe("module registry", () => {
  it("maps current routes to logical owners", () => {
    expect(getModuleForRoute("/clients")?.id).toBe("crm")
    expect(getModuleForRoute("/projects/123")?.id).toBe("project")
    expect(getModuleForRoute("/inventory")?.id).toBe("inventory")
    expect(getModuleForRoute("/purchases/123")?.id).toBe("procurement")
    expect(getModuleForRoute("/finance/invoices/123")?.id).toBe("finance")
  })

  it("uses longest match for settings finance routes", () => {
    expect(getModuleForRoute("/settings")?.id).toBe("core")

    expect(
      getModuleForRoute("/settings/accounting")?.id
    ).toBe("finance")

    expect(
      getModuleForRoute("/settings/taxes/123")?.id
    ).toBe("finance")
  })

  it("keeps business modules dependent only on platform foundations", () => {
    expect(getModule("sales").dependencies).toEqual([
      "core",
      "foundation",
    ])

    expect(getModule("procurement").dependencies).toEqual([
      "core",
      "foundation",
    ])
  })
})
