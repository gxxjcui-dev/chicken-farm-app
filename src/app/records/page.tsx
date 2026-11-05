import RecordForms from "@/components/RecordForms";

export const dynamic = "force-dynamic";

export default function RecordsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-gray-800">📝 每日录入</h2>
      <RecordForms />
    </div>
  );
}
