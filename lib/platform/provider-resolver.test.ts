import { describe, expect, it } from "vitest"

import {
  ProviderResolver,
  type ProviderDescriptor,
} from "./provider-resolver"

const providers: ProviderDescriptor[] = [
  {
    id: "legacy-inventory",
    kind: "legacy",
    health: "healthy",
    cutoverState: "legacy",
    capabilities: ["inventory.stock.reserve"],
  },
  {
    id: "candidate-inventory",
    kind: "internal",
    health: "healthy",
    cutoverState: "candidate",
    capabilities: ["inventory.stock.reserve"],
  },
]

describe("provider resolver", () => {
  it("routes new work to explicitly configured legacy provider", () => {
    const resolver = new ProviderResolver(
      providers,
      {
        "inventory.stock.reserve":
          "legacy-inventory",
      }
    )

    expect(
      resolver.resolve(
        "inventory.stock.reserve"
      )?.id
    ).toBe("legacy-inventory")
  })

  it("blocks candidate from receiving new work", () => {
    const resolver = new ProviderResolver(
      providers,
      {
        "inventory.stock.reserve":
          "candidate-inventory",
      }
    )

    expect(
      resolver.resolve(
        "inventory.stock.reserve"
      )
    ).toBeNull()
  })

  it("allows explicitly active provider after cutover", () => {
    const resolver = new ProviderResolver(
      [
        providers[0],
        {
          ...providers[1],
          cutoverState: "active",
        },
      ],
      {
        "inventory.stock.reserve":
          "candidate-inventory",
      }
    )

    expect(
      resolver.resolve(
        "inventory.stock.reserve"
      )?.id
    ).toBe("candidate-inventory")
  })

  it("allows draining provider only for pinned work", () => {
    const resolver = new ProviderResolver(
      [
        providers[0],
        {
          ...providers[1],
          cutoverState: "draining",
        },
      ],
      {
        "inventory.stock.reserve":
          "legacy-inventory",
      }
    )

    expect(
      resolver.resolve(
        "inventory.stock.reserve",
        "candidate-inventory"
      )?.id
    ).toBe("candidate-inventory")

    expect(
      resolver.resolve(
        "inventory.stock.reserve"
      )?.id
    ).toBe("legacy-inventory")
  })

  it("blocks candidate even when explicitly pinned", () => {
    const resolver = new ProviderResolver(
      providers,
      {}
    )

    expect(
      resolver.resolve(
        "inventory.stock.reserve",
        "candidate-inventory"
      )
    ).toBeNull()
  })

  it("fails closed when pinned provider is unavailable", () => {
    const resolver = new ProviderResolver(
      [
        {
          ...providers[0],
          health: "unavailable",
        },
      ],
      {}
    )

    expect(
      resolver.resolve(
        "inventory.stock.reserve",
        "legacy-inventory"
      )
    ).toBeNull()
  })

  it("does not silently fall back from invalid route", () => {
    const resolver = new ProviderResolver(
      providers,
      {
        "inventory.stock.reserve":
          "missing-provider",
      }
    )

    expect(
      resolver.resolve(
        "inventory.stock.reserve"
      )
    ).toBeNull()
  })

  it("rejects duplicate provider ids", () => {
    expect(
      () =>
        new ProviderResolver(
          [providers[0], providers[0]],
          {}
        )
    ).toThrow(
      "Duplicate provider id: legacy-inventory"
    )
  })
})
