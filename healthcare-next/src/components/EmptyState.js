// Every list in the app (no appointments, no records, no pending requests)
// uses this instead of a bare blank div — a deliberate icon + one-line
// explanation + optional primary CTA.
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-12 px-6">
      {Icon && (
        <div className="rounded-full bg-brand-pale p-3">
          <Icon className="h-6 w-6 text-brand" />
        </div>
      )}
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-gray-500 max-w-sm">{description}</p>}
      {action}
    </div>
  );
}
