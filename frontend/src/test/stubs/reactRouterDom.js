/**
 * Jest stub for react-router-dom.
 *
 * react-router-dom v7 ships an ESM-only build whose `exports` map Jest 27
 * (bundled with CRA/craco) can't resolve, so importing it from a test fails
 * with "Cannot find module 'react-router-dom'". Components under test only
 * need a handful of router primitives rendered as plain DOM, so we map the
 * package to this lightweight stub via moduleNameMapper in craco.config.js.
 */
const React = require("react");

const Link = ({ to, children, ...rest }) =>
  React.createElement("a", { href: typeof to === "string" ? to : "#", ...rest }, children);

const passthrough = ({ children }) => React.createElement(React.Fragment, null, children);

module.exports = {
  Link,
  NavLink: Link,
  MemoryRouter: passthrough,
  BrowserRouter: passthrough,
  Routes: passthrough,
  Route: passthrough,
  Outlet: passthrough,
  useNavigate: () => () => {},
  useParams: () => ({}),
  useLocation: () => ({ pathname: "/", search: "", hash: "", state: null }),
  useSearchParams: () => [new URLSearchParams(), () => {}],
};
