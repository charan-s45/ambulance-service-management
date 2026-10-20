import { Link } from "react-router-dom";
import { useApiData } from "../hooks/useApiData.js";
import BookingsTable from "../components/BookingsTable.jsx";
import { ErrorState, Loading } from "../components/StatusMessages.jsx";

export default function BookingHistory() {
  const { data: bookings, error, loading, reload } = useApiData("/bookings/my", { pollMs: 10000 });

  return (
    <section className="active">
      <h1>My Bookings</h1>
      <div className="card">
        <ErrorState error={error} onRetry={reload} />
        {loading && <Loading />}
        {bookings && bookings.length === 0 && (
          <p>
            You have no bookings yet. <Link to="/book">Book an ambulance</Link>.
          </p>
        )}
        {bookings && bookings.length > 0 && <BookingsTable bookings={bookings} />}
      </div>
    </section>
  );
}
