// About, Services and Contact — same text as the prototype.

export function About() {
  return (
    <section id="about" className="active">
      <h1>About Us</h1>
      <div className="card">
        <p>
          Our Ambulance Service Management System is designed to provide efficient and reliable emergency medical
          services. We aim to connect patients with the nearest available ambulance quickly and safely. Our platform
          ensures smooth communication between ambulance staff, hospitals, and patients, reducing delays during
          critical situations. We focus on streamlining ambulance scheduling, patient information management, and
          service monitoring to enhance overall healthcare support. Our system allows easy requesting, dispatching,
          and managing ambulance services with minimal effort. With a user-friendly interface, hospitals and service
          providers can maintain records, track service history, and manage operations effectively. Our goal is to
          improve response times and optimize ambulance services for the well-being of our community. We are
          committed to delivering a secure, reliable, and organized solution for emergency medical care.
        </p>
      </div>
    </section>
  );
}

const SERVICES = [
  { icon: "fa-ambulance", title: "Emergency Response", text: "Rapid deployment for critical situations." },
  { icon: "fa-clock", title: "24/7 Support", text: "Our team is available anytime." },
  { icon: "fa-hospital", title: "Non-Emergency Transport", text: "Scheduled transfers and appointments." },
  { icon: "fa-heartbeat", title: "Patient Care", text: "Compassionate care during transport." },
];

export function Services() {
  return (
    <section id="services" className="active">
      <h1>Services</h1>
      <div className="services-grid">
        {SERVICES.map((s) => (
          <div className="card" key={s.title}>
            <i className={`fas ${s.icon}`}></i>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Contact() {
  return (
    <section id="contact" className="active">
      <h1>Contact Us</h1>
      <div className="card">
        <p>
          <strong>Phone:</strong> +1 (123) 456-7890
        </p>
        <p>
          <strong>Email:</strong> help@ambulanceservice.com
        </p>
        <p>
          <strong>Address:</strong> 123 Emergency Road, City
        </p>
      </div>
    </section>
  );
}

export function NotFound() {
  return (
    <section className="active">
      <h1>Page not found</h1>
      <div className="card">
        <p>The page you are looking for does not exist.</p>
      </div>
    </section>
  );
}
