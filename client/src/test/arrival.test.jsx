import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ArrivalMessage, { arrivalMessage } from "../components/ArrivalMessage.jsx";
import { minutesRemaining } from "../utils/format.js";

const NOW = new Date(2026, 9, 20, 10, 0).getTime();
const soon = new Date(NOW + 5 * 60000).toISOString();
const base = {
  pickup: "Oak Ave",
  scheduledFor: soon,
  ambulance: { code: "A101", vehicle: "Ambulance A101" },
  driver: { name: "Ramesh", phone: "555-0101" },
};

describe("arrival message for the patient", () => {
  it("new: request received, assigning", () => {
    const m = arrivalMessage({ ...base, status: "new", ambulance: null, driver: null, eta: {} }, NOW);
    expect(m.title).toBe("Request received");
    expect(m.text).toMatch(/assigning an ambulance/);
  });

  it("pending with the default estimate says it is an estimate", () => {
    const m = arrivalMessage(
      { ...base, status: "pending", eta: { minutes: 15, source: "default_estimate", updatedAt: new Date(NOW).toISOString() } },
      NOW,
    );
    expect(`${m.title} ${m.text}`).toBe(
      "Ambulance A101 has been assigned! Driver Ramesh will arrive in about 15 minutes (estimate).",
    );
  });

  it("pending with a dispatcher ETA counts down", () => {
    const setAt = new Date(NOW - 3 * 60000).toISOString(); // entered 3 min ago
    const m = arrivalMessage({ ...base, status: "pending", eta: { minutes: 10, source: "dispatcher", updatedAt: setAt } }, NOW);
    expect(m.text).toBe("Driver Ramesh will arrive in about 7 minutes.");
  });

  it("pending for a booking scheduled tomorrow shows the pickup time, not a countdown", () => {
    const tomorrow = new Date(NOW + 24 * 3600000);
    const m = arrivalMessage(
      { ...base, scheduledFor: tomorrow.toISOString(), status: "pending", eta: { minutes: 15, source: "default_estimate" } },
      NOW,
    );
    expect(m.text).toMatch(/will pick you up as scheduled on 2026-10-21 10:00/);
  });

  it("en route: minutes left and clock time; 'any moment' when overdue", () => {
    const eta = { minutes: 12, source: "driver", updatedAt: new Date(NOW).toISOString() };
    const m = arrivalMessage({ ...base, status: "enroute", eta }, NOW);
    expect(m.title).toBe("Ambulance A101 is on the way!");
    expect(m.text).toBe("Driver Ramesh is on the way and will arrive in about 12 minutes (around 10:12).");
    const late = arrivalMessage({ ...base, status: "enroute", eta }, NOW + 20 * 60000);
    expect(late.text).toBe("Driver Ramesh should be arriving any moment now.");
  });

  it("arrived", () => {
    const m = arrivalMessage({ ...base, status: "arrived", eta: {} }, NOW);
    expect(m.title).toBe("Your ambulance has arrived!");
    expect(m.text).toMatch(/Oak Ave/);
  });

  it("renders the banner with a call-driver link", () => {
    render(<ArrivalMessage booking={{ ...base, status: "arrived", eta: {} }} />);
    expect(screen.getByText("Your ambulance has arrived!")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Call driver: 555-0101/ }).getAttribute("href")).toBe("tel:555-0101");
  });

  it("minutesRemaining ignores the default estimate", () => {
    expect(minutesRemaining({ minutes: 15, source: "default_estimate", updatedAt: new Date(NOW).toISOString() }, NOW)).toBeNull();
    expect(minutesRemaining({ minutes: 15, source: "driver", updatedAt: new Date(NOW).toISOString() }, NOW + 60000)).toBe(14);
  });
});
