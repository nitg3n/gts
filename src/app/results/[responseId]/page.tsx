import { ResultsView } from "@/components/ResultsView";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ responseId: string }>;
}) {
  const { responseId } = await params;

  return <ResultsView responseId={responseId} />;
}
