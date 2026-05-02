import { CompareView } from "@/components/CompareView";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;

  return <CompareView ids={ids} />;
}
