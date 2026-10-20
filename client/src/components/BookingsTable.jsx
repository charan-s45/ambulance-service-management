import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge.jsx";
import EtaDisplay from "./EtaDisplay.jsx";
import { formatDateTime } from "../utils/format.js";

// The user's own bookings (used on My Bookings and the User Dashboard).
export default function BookingsTable({ bookings }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Pickup</th>
            <th>Destination</th>
            <th>When</th>
            <th>Status</th>
            <th>Ambulance</th>
            <th>Driver</th>
            <th>Feedback</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id}>
              <td>{b.bookingId}</td>
              <td>{b.pickup}</td>
              <td>{b.destination}</td>
              <td className="small">{formatDateTime(b.scheduledFor)}</td>
              <td>
                <StatusBadge status={b.status} /> <EtaDisplay booking={b} compact />
              </td>
              <td>{b.ambulance ? b.ambulance.vehicle : "-"}</td>
              <td>
                {b.driver ? (
                  <>
                    {b.driver.name}
                    {b.driver.phone && <div className="small">{b.driver.phone}</div>}
                  </>
                ) : (
                  "-"
                )}
              </td>
              <td>
                {b.feedback ? (
                  `${b.feedback.rating}/5`
                ) : b.status === "completed" ? (
                  <Link className="btn small-btn" to={`/feedback/${b.id}`}>
                    Give Feedback
                  </Link>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
