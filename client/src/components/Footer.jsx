export default function Footer() {
  return (
    <footer>
      &copy; <span id="year">{new Date().getFullYear()}</span> Ambulance Service Management - All Rights Reserved
    </footer>
  );
}
