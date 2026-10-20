import { formatDateTime } from "../../utils/format.js";

export function UsersTable({ users }) {
  if (users.length === 0) return <p className="small">No users yet.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Phone</th>
            <th>Registered</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{u.phone || "-"}</td>
              <td className="small">{formatDateTime(u.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FeedbackTable({ feedback }) {
  if (feedback.length === 0) return <p className="small">No feedback submitted yet.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Booking</th>
            <th>User</th>
            <th>Rating</th>
            <th>Comments</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {feedback.map((f) => (
            <tr key={f.id}>
              <td>{f.bookingId || "-"}</td>
              <td>{f.user ? f.user.name : "(deleted user)"}</td>
              <td>{f.rating}/5</td>
              <td>{f.comments || <span className="small">(no comments)</span>}</td>
              <td className="small">{formatDateTime(f.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
