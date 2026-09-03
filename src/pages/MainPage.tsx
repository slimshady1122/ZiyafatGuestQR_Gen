import { Link } from "react-router-dom";
import styles from "./MainPage.module.css";

function ScanIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 18V10a2 2 0 0 1 2-2h8M30 8h8a2 2 0 0 1 2 2v8M40 30v8a2 2 0 0 1-2 2h-8M18 40h-8a2 2 0 0 1-2-2v-8" />
      <path d="M16 16h6v6h-6zM26 16h6v6h-6zM16 26h6v6h-6zM27 27h4M27 32h5M34 27h-1" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="16" r="7" />
      <path d="M11 40c1.5-7 6-11 13-11s11.5 4 13 11M35 25l3 3 6-7" />
    </svg>
  );
}

export default function MainPage() {
  return (
    <main className={styles.page}>
      <div className={styles.stars} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.mark}>Z2</div>
        <span className={styles.headerLabel}>Guest experience</span>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>Welcome to</p>
        <h1>
          Ziyafat <span>2</span>
          <strong>Inauguration</strong>
        </h1>
        <div className={styles.rule} />
        <p className={styles.subtitle}>A seamless entrance begins here.</p>
      </section>

      <section className={styles.choices} aria-label="Choose an area">
        <Link to="/scan" className={`${styles.choice} ${styles.scannerChoice}`}>
          <div className={styles.icon}>
            <ScanIcon />
          </div>
          <div>
            <p className={styles.choiceKicker}>For the entrance</p>
            <h2>Door Keeper</h2>
            <p className={styles.choiceText}>
              Scan guest invitations and welcome your guests.
            </p>
          </div>
          <span className={styles.arrow} aria-hidden="true">
            &#8594;
          </span>
        </Link>

        <Link to="/login" className={`${styles.choice} ${styles.adminChoice}`}>
          <div className={styles.icon}>
            <AdminIcon />
          </div>
          <div>
            <p className={styles.choiceKicker}>For the team</p>
            <h2>Admin</h2>
            <p className={styles.choiceText}>
              Manage your guest list and invitation codes.
            </p>
          </div>
          <span className={styles.arrow} aria-hidden="true">
            &#8594;
          </span>
        </Link>
      </section>

      <footer className={styles.footer}>
        Ziyafat 2 <span>/</span> 2024
      </footer>
    </main>
  );
}
