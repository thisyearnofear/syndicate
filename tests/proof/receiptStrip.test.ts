import {
  resolveReceiptStatus,
  shortHash,
} from "@/components/proof/ReceiptStrip";
import { toOperatorTimeline } from "@/components/operators/OperatorRunTimeline";

describe("resolveReceiptStatus", () => {
  it("never claims verified without a tx hash", () => {
    expect(resolveReceiptStatus("verified", null)).toBe("absorbed");
    expect(resolveReceiptStatus("verified", undefined)).toBe("absorbed");
    expect(resolveReceiptStatus("verified", "")).toBe("absorbed");
  });

  it("keeps verified when a hash is present", () => {
    expect(resolveReceiptStatus("verified", "0xabc")).toBe("verified");
  });

  it("preserves pending and absorbed", () => {
    expect(resolveReceiptStatus("pending", null)).toBe("pending");
    expect(resolveReceiptStatus("absorbed", "0xabc")).toBe("absorbed");
  });
});

describe("shortHash", () => {
  it("truncates long hashes", () => {
    const hash = "0x0123456789abcdef0123456789abcdef01234567";
    expect(shortHash(hash)).toBe("0x01234567…234567");
  });
});

describe("toOperatorTimeline", () => {
  it("collapses execute + complete into one receipted node", () => {
    const nodes = toOperatorTimeline([
      {
        id: "1",
        kind: "execute",
        label: "float check → buyTickets",
        createdAt: 1,
      },
      {
        id: "2",
        kind: "complete",
        label: "float check → buyTickets",
        txHash: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        chain: "base",
        createdAt: 2,
      },
    ]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe("complete");
    expect(nodes[0].txHash).toMatch(/^0xdead/);
  });
});
