export function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <a
      className="brand"
      href="#/documents"
      onClick={onClick}
      aria-label="OblivionDoc — реестр документов"
    >
      <svg viewBox="0 0 36 38" aria-hidden="true">
        <path d="M9 9V3h16l6 6v23h-6M5 9h15l6 6v20H5z" />
        <path d="M20 9v7h6M10 22h10M10 27h7" />
      </svg>
      <span>
        Oblivion<span>Doc</span>
      </span>
    </a>
  );
}
