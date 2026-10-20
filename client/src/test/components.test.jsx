import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge from "../components/StatusBadge.jsx";
import EtaDisplay from "../components/EtaDisplay.jsx";
import { findActiveBooking, findCompletedWithoutFeedback, toIsoFromLocal } from "../utils/format.js";

describe("StatusBadge", () => {
  it.each([
    ["new", "New"],
    ["pending", "Pending"],
    ["enroute", "En route"],
    ["arrived", "Arrived"],
    ["completed", "Completed"],
  ])("shows the original label for %s", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("escapes unknown values instead of injecting HTML", () => {
    const { container } = render(<StatusBadge status={"<img src=x onerror=alert(1)>"} />);
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("EtaDisplay", () => {
  const base = { status: "new" };

  it("labels the default estimate as not based on live location", () => {
    render(<EtaDisplay booking={{ ...base, eta: { minutes: 15, source: "default_estimate" } }} />);
    expect(screen.getByText("Estimated Arrival:")).toBeTruthy();
    expect(screen.getByText(/not based on live location/)).toBeTruthy();
  });

  it("labels a driver-reported ETA with time reported and not as GPS", () => {
    const updatedAt = new Date(2026, 0, 1, 10, 0).toISOString();
    render(<EtaDisplay booking={{ status: "enroute", eta: { minutes: 12, source: "driver", updatedAt } }} />);
    expect(screen.getByText("ETA to Pickup:")).toBeTruthy();
    expect(screen.getByText(/reported by driver at 10:00, expected around 10:12 — not live GPS/)).toBeTruthy();
  });

  it("shows pending text when no ETA and nothing after arrival", () => {
    const { rerender, container } = render(<EtaDisplay booking={{ ...base, eta: { minutes: null } }} />);
    expect(screen.getByText("ETA calculation pending...")).toBeTruthy();
    rerender(<EtaDisplay booking={{ status: "arrived", eta: { minutes: null } }} />);
    expect(container.textContent).toBe("");
  });
});

describe("format helpers", () => {
  it("finds the active booking and the one needing feedback", () => {
    const list = [
      { id: "1", status: "completed", feedback: null },
      { id: "2", status: "enroute" },
    ];
    expect(findActiveBooking(list).id).toBe("2");
    expect(findCompletedWithoutFeedback(list).id).toBe("1");
    expect(findCompletedWithoutFeedback([{ status: "completed", feedback: { rating: 5 } }])).toBeNull();
  });

  it("builds an ISO date from date + time inputs and rejects blanks", () => {
    expect(toIsoFromLocal("2030-05-01", "10:30")).toBe(new Date("2030-05-01T10:30").toISOString());
    expect(toIsoFromLocal("", "10:30")).toBeNull();
  });
});
