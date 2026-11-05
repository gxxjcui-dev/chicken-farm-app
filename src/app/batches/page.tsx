import BatchManager from "@/components/BatchManager";

export const dynamic = "force-dynamic";

export default function BatchesPage() {
  return (
    <div className="space-y-5">
      <h2 className="text-base font-bold text-gray-800">🐣 批次管理</h2>
      <BatchManager />
    </div>
  );
}
