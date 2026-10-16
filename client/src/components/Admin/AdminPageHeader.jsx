const AdminPageHeader = ({
  eyebrow = 'ADMIN PORTAL',
  title,
  description,
  leading,
  actions,
  className = '',
}) => (
  <header
    className={`flex flex-col lg:flex-row lg:items-center justify-between gap-6 ${className}`}
    style={{ paddingTop: 26, paddingBottom: 20 }}
  >
    <div className="flex min-w-0 items-start gap-3 sm:gap-4">
      {leading}
      <div className="min-w-0">
        <p
          style={{
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            color: '#A9784E',
            fontSize: '0.74rem',
            fontWeight: 700,
            marginBottom: 8,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {eyebrow}
        </p>
        <h1
          className="sm:text-[2.15rem]"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '1.7rem',
            fontWeight: 700,
            color: '#241512',
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            style={{
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
              fontSize: '0.88rem',
              color: '#8A7A68',
              marginTop: 8,
              maxWidth: 460,
            }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-3 flex-shrink-0">{actions}</div>}
  </header>
);

export default AdminPageHeader;
