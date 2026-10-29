import { PrintDocumentPage, type PrintDocumentPageProps } from "@/views/print-document-page";

export default function Page({ params }: PrintDocumentPageProps) {
  return <PrintDocumentPage params={params} />;
}
