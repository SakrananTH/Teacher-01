import { createBrowserRouter } from "react-router";
import { MainLayout } from "./layouts/MainLayout";
import { Home } from "./pages/Home";
import { Attendance } from "./pages/Attendance";
import { Savings } from "./pages/Savings";
import { Students } from "./pages/Students";
import { Login } from "./pages/Login";
import { Assignments } from "./pages/Assignments";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/",
    Component: MainLayout,
    children: [
      { index: true, Component: Home },
      { path: "attendance", Component: Attendance },
      { path: "savings", Component: Savings },
      { path: "students", Component: Students },
      { path: "assignments", Component: Assignments },
    ],
  },
]);
