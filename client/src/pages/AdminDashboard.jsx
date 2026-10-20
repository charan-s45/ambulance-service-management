import { useCallback } from "react";
import { useApiData } from "../hooks/useApiData.js";
import { ErrorState, Loading } from "../components/StatusMessages.jsx";
import RequestsTable from "../components/admin/RequestsTable.jsx";
import AmbulancesPanel from "../components/admin/AmbulancesPanel.jsx";
import DriversPanel from "../components/admin/DriversPanel.jsx";
import { FeedbackTable, UsersTable } from "../components/admin/ListTables.jsx";

const POLL = 10000;

export default function AdminDashboard() {
  const stats = useApiData("/stats/admin", { pollMs: POLL });
  const bookings = useApiData("/bookings", { pollMs: POLL });
  const ambulances = useApiData("/ambulances", { pollMs: POLL });
  const drivers = useApiData("/drivers", { pollMs: POLL });
  const users = useApiData("/users", { pollMs: 30000 });
  const feedback = useApiData("/feedback", { pollMs: 30000 });

  const { reload: reloadStats } = stats;
  const { reload: reloadBookings } = bookings;
  const { reload: reloadAmbulances } = ambulances;
  const { reload: reloadDrivers } = drivers;
  const { reload: reloadUsers } = users;
  const { reload: reloadFeedback } = feedback;

  // After any change, refresh everything an action could have affected.
  const refreshOps = useCallback(
    () => Promise.all([reloadStats(), reloadBookings(), reloadAmbulances(), reloadDrivers()]),
    [reloadStats, reloadBookings, reloadAmbulances, reloadDrivers],
  );
  const refreshDrivers = useCallback(
    () => Promise.all([refreshOps(), reloadUsers()]),
    [refreshOps, reloadUsers],
  );

  const s = stats.data;

  return (
    <section id="admin" className="active">
      <h1>Admin Dashboard — Manage Requests</h1>

      <div className="card">
        <strong>Overview</strong>
        <ErrorState error={stats.error} onRetry={reloadStats} />
        {s ? (
          <div style={{ marginTop: 8 }} className="small">
            Active Requests: <span id="admin-active">{s.activeRequests}</span> &nbsp;•&nbsp; Awaiting assignment:{" "}
            {s.newRequests} &nbsp;•&nbsp; Available Ambulances: <span id="admin-available">{s.availableAmbulances}</span>{" "}
            &nbsp;•&nbsp; Total Drivers: <span id="admin-drivers">{s.totalDrivers}</span> ({s.availableDrivers} available)
            &nbsp;•&nbsp; Completed: {s.completedBookings} / {s.totalBookings} &nbsp;•&nbsp; Registered users:{" "}
            {s.totalUsers} &nbsp;•&nbsp; Average rating: {s.averageRating ?? "-"}
            {s.feedbackCount ? ` (${s.feedbackCount} reviews)` : ""}
          </div>
        ) : (
          stats.loading && <Loading />
        )}
      </div>

      <div className="card">
        <h3>Requests</h3>
        <ErrorState error={bookings.error} onRetry={reloadBookings} />
        {bookings.loading && <Loading />}
        {bookings.data && (
          <RequestsTable
            bookings={bookings.data}
            ambulances={ambulances.data || []}
            drivers={drivers.data || []}
            onChanged={refreshOps}
          />
        )}
      </div>

      <div className="card">
        <h3>Ambulances</h3>
        <ErrorState error={ambulances.error} onRetry={reloadAmbulances} />
        {ambulances.loading && <Loading />}
        {ambulances.data && <AmbulancesPanel ambulances={ambulances.data} onChanged={refreshOps} />}
      </div>

      <div className="card">
        <h3>Drivers</h3>
        <ErrorState error={drivers.error} onRetry={reloadDrivers} />
        {drivers.loading && <Loading />}
        {drivers.data && <DriversPanel drivers={drivers.data} onChanged={refreshDrivers} />}
      </div>

      <div className="card">
        <h3>Feedback</h3>
        <ErrorState error={feedback.error} onRetry={reloadFeedback} />
        {feedback.loading && <Loading />}
        {feedback.data && <FeedbackTable feedback={feedback.data} />}
      </div>

      <div className="card">
        <h3>Registered Users</h3>
        <ErrorState error={users.error} onRetry={reloadUsers} />
        {users.loading && <Loading />}
        {users.data && <UsersTable users={users.data} />}
      </div>
    </section>
  );
}
