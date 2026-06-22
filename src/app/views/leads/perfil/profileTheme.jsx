export const PROFILE_PANEL_STYLES = {
   borderRadius: "20px",
   background: "#ffffff",
   border: "1px solid #d9dde3",
   boxShadow: "0 14px 32px rgba(15, 23, 42, 0.06)",
   overflow: "hidden",
};

export const PROFILE_THEME_STYLES = `
   .lead-profile-shell {
      padding: 0;
   }

   .lead-profile-panel {
      padding: 16px;
   }

   .lead-profile-hero {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e5e7eb;
   }

   .lead-profile-eyebrow {
      display: inline-block;
      margin-bottom: 4px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #4b5563;
   }

   .lead-profile-page-title {
      margin-bottom: 4px;
      font-size: 18px;
      font-weight: 700;
      line-height: 1.15;
      letter-spacing: -0.02em;
      color: #111827;
   }

   .lead-profile-page-copy {
      max-width: 620px;
      margin: 0;
      font-size: 12px;
      line-height: 1.45;
      color: #4b5563;
   }

   .lead-profile-section {
      margin-top: 12px;
      padding: 14px;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      background: #ffffff;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
   }

   .lead-profile-section-head {
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid #eceff3;
   }

   .lead-profile-kicker {
      display: inline-block;
      margin-bottom: 4px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #6b7280;
   }

   .lead-profile-section-title {
      margin: 0 0 4px;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.01em;
      color: #111827;
   }

   .lead-profile-section-copy {
      margin: 0;
      max-width: 620px;
      font-size: 11px;
      line-height: 1.45;
      color: #4b5563;
   }

   .lead-profile-shell .row {
      --bs-gutter-x: 0.75rem;
      --bs-gutter-y: 0.75rem;
   }

   .lead-profile-card {
      height: 100%;
      padding: 11px 13px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #fbfbfc;
   }

   .lead-profile-label {
      margin: 0 0 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: #6b7280;
   }

   .lead-profile-value {
      margin: 0;
      font-size: 13px;
      line-height: 1.35;
      color: #111827;
      white-space: pre-wrap;
      word-break: break-word;
   }

   .lead-profile-value.is-empty {
      color: #9ca3af;
      font-style: italic;
   }

   .lead-profile-table-wrap {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
      background: #ffffff;
   }

   .lead-profile-table {
      width: 100%;
      margin: 0;
      font-size: 13px;
      color: #111827;
   }

   .lead-profile-table thead th {
      padding: 11px 13px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #6b7280;
      background: #f8fafc;
      border-bottom: 1px solid #e5e7eb;
      white-space: nowrap;
   }

   .lead-profile-table tbody td {
      padding: 12px 13px;
      vertical-align: middle;
      border-bottom: 1px solid #edf0f2;
   }

   .lead-profile-table tbody tr:last-child td {
      border-bottom: none;
   }

   .lead-profile-table tbody tr.is-clickable {
      cursor: pointer;
      transition: background-color 0.15s ease;
   }

   .lead-profile-table tbody tr.is-clickable:hover {
      background: #f8fafc;
   }

   .lead-profile-empty {
      padding: 16px;
      border: 1px dashed #d1d5db;
      border-radius: 12px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      background: #fbfbfc;
   }

   .lead-profile-timeline {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
   }

   .lead-profile-timeline-card {
      position: relative;
      min-height: 100%;
      padding: 14px;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
      overflow: hidden;
   }

   .lead-profile-timeline-card::after {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      background: #111827;
      opacity: 0.08;
   }

   .lead-profile-timeline-title {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 700;
      color: #111827;
   }

   .lead-profile-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      margin-bottom: 8px;
      font-size: 11px;
      color: #6b7280;
   }

   .lead-profile-note {
      margin: 0;
      font-size: 12px;
      line-height: 1.5;
      color: #374151;
      white-space: pre-wrap;
   }

   .lead-profile-sidebar {
      border: 1px solid #d9dde3;
      border-radius: 20px;
      background: #ffffff;
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.06);
      overflow: hidden;
   }

   .lead-profile-sidebar-body {
      padding: 18px 18px 14px;
   }

   .lead-profile-avatar {
      width: 86px;
      height: 86px;
      border-radius: 999px;
      object-fit: cover;
      border: 4px solid #f8fafc;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
   }

   .lead-profile-sidebar-name {
      margin: 10px 0 4px;
      font-size: 18px;
      font-weight: 700;
      color: #111827;
   }

   .lead-profile-sidebar-copy {
      margin: 0;
      font-size: 12px;
      color: #6b7280;
   }

   .lead-profile-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      margin-top: 14px;
   }

   .lead-profile-actions .btn {
      border-radius: 10px;
      font-size: 12px;
   }

   .lead-profile-nav {
      border-top: 1px solid #edf0f2;
      padding: 8px 0;
   }

   .lead-profile-nav .nav-link {
      border: none;
      border-radius: 0;
      padding: 12px 18px;
      font-size: 13px;
      color: #334155;
      background: transparent;
      transition: background-color 0.15s ease, color 0.15s ease;
   }

   .lead-profile-nav .nav-link.active {
      background: #eef5ff;
      color: #0f172a;
      box-shadow: inset 3px 0 0 #0f172a;
   }

   .lead-profile-nav .nav-link:hover {
      background: #f8fafc;
   }

   .lead-profile-header-card {
      margin-bottom: 16px;
      border-radius: 20px;
      border: 1px solid #d9dde3;
      background: #1f242b;
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
      overflow: hidden;
   }

   .lead-profile-header-body {
      padding: 20px 22px;
   }

   .lead-profile-header-name {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
   }

   .lead-profile-header-copy {
      margin: 0;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.72);
   }

   .lead-profile-main-panel {
      border: 1px solid #d9dde3;
      border-radius: 20px;
      background: #ffffff;
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.06);
      padding: 12px;
   }

   @media (max-width: 991px) {
      .lead-profile-panel {
         padding: 12px;
      }

      .lead-profile-hero {
         flex-direction: column;
      }

      .lead-profile-main-panel {
         padding: 8px;
      }
   }
`;

export const getDisplayText = (value) => {
   if (value === null || value === undefined || value === "" || value === "null" || value === "--") {
      return "N/A";
   }

   return value;
};

export const ProfileSection = ({ eyebrow, title, description, children, className = "" }) => (
   <section className={`lead-profile-section ${className}`.trim()}>
      <div className="lead-profile-section-head">
         {eyebrow ? <span className="lead-profile-kicker">{eyebrow}</span> : null}
         <h5 className="lead-profile-section-title">{title}</h5>
         {description ? <p className="lead-profile-section-copy">{description}</p> : null}
      </div>
      {children}
   </section>
);

export const ProfileEmptyState = ({ message }) => <div className="lead-profile-empty">{message}</div>;
