import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { FlashBanner } from "./components/StatusMessages.jsx";
import Home from "./pages/Home.jsx";
import { About, Contact, NotFound, Services } from "./pages/StaticPages.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import BookAmbulance from "./pages/BookAmbulance.jsx";
import BookingConfirmation from "./pages/BookingConfirmation.jsx";
import BookingHistory from "./pages/BookingHistory.jsx";
import UserDashboard from "./pages/UserDashboard.jsx";
import Feedback from "./pages/Feedback.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import DriverDashboard from "./pages/DriverDashboard.jsx";

// Each old <section id="..."> is now a route.
export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <FlashBanner />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<AuthPage />} />
          {/* Visible to everyone (as before); submitting requires a User login. */}
          <Route path="/book" element={<BookAmbulance />} />
          <Route
            path="/bookings/:id/confirmation"
            element={
              <ProtectedRoute roles={["user"]}>
                <BookingConfirmation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={["user"]}>
                <UserDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-bookings"
            element={
              <ProtectedRoute roles={["user"]}>
                <BookingHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/feedback/:bookingId"
            element={
              <ProtectedRoute roles={["user"]}>
                <Feedback />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver"
            element={
              <ProtectedRoute roles={["driver"]}>
                <DriverDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
