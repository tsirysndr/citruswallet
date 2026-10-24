export function PageHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <p className="eyebrow">YOUR HANDLE. YOUR WALLET.</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
