import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function NavBar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const linkCls = ({ isActive }) =>
    `px-3 py-1.5 rounded-md text-sm tracking-tight transition ${
      isActive ? "bg-white/10 text-white" : "text-white/70 hover:text-white hover:bg-white/5"
    }`;

  return (
    <nav
      data-testid="navbar"
      className="fixed top-0 inset-x-0 z-50 pointer-events-auto"
    >
      <div className="mx-auto max-w-7xl mt-3 px-3">
        <div className="glass rounded-2xl px-4 py-2.5 flex items-center justify-between">
          <Link to="/" data-testid="nav-logo" className="flex items-center gap-2">
            <span className="block w-2.5 h-2.5 rounded-full bg-[#FF5F6D]" />
            <span className="block w-2.5 h-2.5 rounded-full bg-[#00FFCC] -ml-2.5" />
            <span className="font-[Unbounded] text-base tracking-tight font-bold ml-2">
              JOB<span className="text-[#FF5F6D]">·</span>CITY
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <NavLink to="/jobs-city" data-testid="nav-jobs-city" className={linkCls}>
              Jobs City
            </NavLink>
            <NavLink to="/applicants-city" data-testid="nav-applicants-city" className={linkCls}>
              Applicants City
            </NavLink>
            {user && user !== false && (
              <>
                <NavLink
                  to="/applicants-city?navigate=me"
                  data-testid="nav-profile"
                  className={({ isActive }) =>
                    `${linkCls({ isActive: false })} ${
                      location.pathname === "/applicants-city" && location.search.includes("navigate=me")
                        ? "bg-white/10 text-white"
                        : ""
                    }`
                  }
                >
                  My Tower
                </NavLink>
                <NavLink to="/profile" data-testid="nav-edit-profile" className={linkCls}>
                  Edit profile
                </NavLink>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user && user !== false ? (
              <>
                <span data-testid="nav-user-email" className="hidden sm:inline font-mono text-xs text-white/50">
                  {user.email}
                </span>
                <Button
                  data-testid="nav-logout-btn"
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="text-white/80"
                >
                  Sign out
                </Button>
              </>
            ) : user === false ? (
              <>
                <Link to="/login" data-testid="nav-login-link">
                  <Button variant="ghost" size="sm" className="text-white/80">
                    Sign in
                  </Button>
                </Link>
                <Link to="/register" data-testid="nav-register-link">
                  <Button size="sm" className="btn-applicants rounded-full px-4">
                    Join
                  </Button>
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
