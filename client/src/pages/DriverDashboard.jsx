import { useApiData } from "../hooks/useApiData.js";
import StatusBadge from "../components/StatusBadge.jsx";
import EtaDisplay from "../components/EtaDisplay.jsx";
import StatusActions from "../components/StatusActions.jsx";
import { ErrorState, Loading } from "../components/StatusMessages.jsx";
import { formatDateTime } from "../utils/format.js";

export default function DriverDashboard() {
  const { data: bookings, error, loading, reload } = useApiData("/bookings/assigned", { pollMs: 10000 });

  return (
    <section id="driver" className="active">
      <h1>Driver Dashboard</h1>
      <div className="card">
        <h3>Your Current Assignments</h3>
        <ErrorState error={error} onRetry={reload} />
        {loading && <Loading />}
        {bookings && (
          <div className="table-wrap">
            <table id="driver-requests-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Pickup</th>
                  <th>Destination</th>
                  <th>When</th>
                  <th>Patient</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={7}>No assignments yet.</td>
                  </tr>
                )}
                {bookings.map((r) => (
                  <tr key={`${r.id}-${r.updatedAt}`}>
                    <td>
                      {r.bookingId}
                      {r.ambulance && <div className="small">{r.ambulance.code}</div>}
                    </td>
                    <td>{r.pickup}</td>
                    <td>{r.destination}</td>
                    <td className="small">{formatDateTime(r.scheduledFor)}</td>
                    <td>
                      {r.user?.name || "-"}
                      {r.user?.phone && <div className="small">{r.user.phone}</div>}
                    </td>
                    <td>
                      <StatusBadge status={r.status} /> <EtaDisplay booking={r} compact />
                    </td>
                    <td>
                      <StatusActions booking={r} onChanged={reload} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
