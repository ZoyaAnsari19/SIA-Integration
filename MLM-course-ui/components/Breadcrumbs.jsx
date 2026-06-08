import Link from 'next/link';

export default function Breadcrumbs({ items }) {
  return (
    <div className="breadcrumbs">
      <div className="container">
        <div className="breadcrumbs-content">
          {items.map((item, index) => (
            <span key={item.label}>
              {index > 0 && <span className="breadcrumb-separator">›</span>}
              {item.href ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span>{item.label}</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}


