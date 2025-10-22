import React from "react";

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer bg-dark text-light py-4 mt-5">
      <div className="container text-center">
        <p className="mb-2">
          🌐 Stay updated with the latest job opportunities across Israel and beyond.
        </p>
        <p className="mb-2">
          💡 Explore, learn, and grow your career with curated positions for Juniors, Entry-Level, and Internships.
        </p>
        <p className="mb-2">
          ✉️ Contact us: <a href="mailto:info@jobsite.com" className="text-light">info@jobsite.com</a>
        </p>
        <hr className="border-light" />
        <p className="mb-0">&copy; {currentYear} Danial Trody. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default Footer;
