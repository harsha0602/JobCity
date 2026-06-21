/**
 * Regression test for the "clicking a job tower throws an error" bug.
 *
 * Bug: an auto-commit (a8e48e8) replaced the tested <JobDetailPopup> with an
 * inline <CompanySidePanel> that referenced <Button> WITHOUT importing it.
 * CompanySidePanel returns null until a company is selected, so the app
 * compiled and rendered fine — until you clicked a tower, at which point the
 * panel mounted, hit the undefined `Button`, and React threw
 * "Button is not defined", tearing down the scene.
 *
 * Fix: restore the tested, non-modal <JobDetailPopup>. This test drives the
 * exact crash path: render the page, click a tower, assert the popup mounts.
 */
import { render, screen, fireEvent } from "@testing-library/react";

// Stub the 3D scene so we can fire a tower click without WebGL/three.js.
// The stub exposes a button that calls onCompanyClick with a realistic company.
jest.mock("@/components/three/JobsCityScene", () => ({
  __esModule: true,
  default: ({ onCompanyClick }) => (
    <button
      data-testid="fake-tower"
      onClick={() =>
        onCompanyClick({
          id: "co_acme",
          name: "Acme",
          city: "austin",
          state: "TX",
          color: "#FFB24C",
          floors: 3,
          x: 0,
          z: 0,
        })
      }
    >
      tower
    </button>
  ),
}));

// buildingTex imports three.js + uses <canvas>; keep it out of jsdom.
jest.mock("@/lib/buildingTex", () => ({ floorsToHeight: () => 5 }));

// sonner is ESM and isn't transpiled by Jest's transformIgnorePatterns.
jest.mock("sonner", () => ({
  toast: { info: jest.fn(), error: jest.fn(), success: jest.fn() },
}));

// API: selecting a company fetches its jobs. react-scripts' Jest config sets
// `resetMocks: true`, which wipes a factory implementation before each test, so
// the resolved value is set in beforeEach (after the reset), not in the factory.
jest.mock("@/lib/api", () => ({ api: { get: jest.fn() } }));

import { api } from "@/lib/api";
import JobsCity from "@/pages/JobsCity";

beforeEach(() => {
  api.get.mockResolvedValue({
    data: {
      items: [
        {
          job_id: 10,
          title: "Frontend Engineer",
          company_name: "Acme",
          city: "Austin",
          state: "TX",
          remote: true,
        },
      ],
    },
  });
});

test("clicking a tower opens the company popup without crashing", async () => {
  render(<JobsCity />);

  fireEvent.click(screen.getByTestId("fake-tower"));

  // Regression: this previously threw "Button is not defined" on mount.
  expect(await screen.findByTestId("job-detail-popup")).toBeInTheDocument();
  expect(screen.getByText("Acme")).toBeInTheDocument();
  // The fetched job renders inside the popup.
  expect(await screen.findByTestId("job-row-10")).toBeInTheDocument();
  // And we actually queried the API for the selected company's jobs.
  expect(api.get).toHaveBeenCalledWith(
    "/jobs",
    expect.objectContaining({
      params: expect.objectContaining({ company_id: "co_acme", city: "austin", state: "TX" }),
    })
  );
});
