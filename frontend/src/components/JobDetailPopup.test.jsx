/**
 * Regression test for the Jobs City interaction bug.
 *
 * Bug: clicking a company opened a modal Radix <Sheet> whose overlay
 * (`fixed inset-0`) captured all pointer events and froze the 3D map
 * (no orbit/pan/zoom) while open, and read as a dimmed "side view" instead
 * of a popup. The fix replaces it with this NON-MODAL floating popup that
 * never renders a full-screen, pointer-blocking overlay — so the map stays
 * interactive, matching Applicants City.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import JobDetailPopup from "@/components/JobDetailPopup";
// react-router-dom is stubbed for Jest via moduleNameMapper in craco.config.js
// (the v7 ESM build can't be resolved by Jest 27).

const company = { id: 1, name: "Acme", city: "austin", state: "TX", color: "#FFB24C", floors: 2 };
const jobs = [
  { job_id: 10, title: "Frontend Engineer", company_name: "Acme", city: "Austin", state: "TX", remote: true },
  { job_id: 11, title: "Backend Engineer", company_name: "Acme", city: "Austin", state: "TX", remote: false },
];

function renderPopup(props = {}) {
  return render(
    <JobDetailPopup company={company} jobs={jobs} onClose={() => {}} {...props} />
  );
}

test("renders nothing when no company is selected", () => {
  const { container } = render(
    <JobDetailPopup company={null} onClose={() => {}} />
  );
  expect(container).toBeEmptyDOMElement();
});

test("shows the selected company and its jobs", () => {
  renderPopup();
  expect(screen.getByText("Acme")).toBeInTheDocument();
  expect(screen.getByTestId("job-row-10")).toBeInTheDocument();
  expect(screen.getByTestId("job-row-11")).toBeInTheDocument();
});

test("is non-modal: no full-screen pointer-blocking overlay is rendered", () => {
  const { container } = renderPopup();
  const panel = screen.getByTestId("job-detail-popup");

  // The panel itself must accept pointer events (it's interactive)...
  expect(panel.className).toContain("pointer-events-auto");
  // ...but must NOT be a full-screen overlay that covers (and freezes) the map.
  expect(panel.className).not.toContain("inset-0");

  // No element in the tree may be a full-screen `fixed inset-0` overlay.
  const overlays = Array.from(container.querySelectorAll("*")).filter(
    (el) => el.className?.includes?.("inset-0") && el.className?.includes?.("fixed")
  );
  expect(overlays).toHaveLength(0);
});

test("ESC and the close button both call onClose", () => {
  const onClose = jest.fn();
  renderPopup({ onClose });

  fireEvent.keyDown(window, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByTestId("popup-close-btn"));
  expect(onClose).toHaveBeenCalledTimes(2);
});

test("filters jobs by query", () => {
  renderPopup({ query: "frontend" });
  expect(screen.getByTestId("job-row-10")).toBeInTheDocument();
  expect(screen.queryByTestId("job-row-11")).not.toBeInTheDocument();
});
