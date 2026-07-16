import { useRoute } from "wouter";
import { useGetByTicketCode } from "@workspace/api-client-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const CUSTODY_LABELS: Record<string, string> = {
  loan: "On Loan",
  ptad: "PTAD",
  project: "Project",
};

function LabelContent() {
  const [, params] = useRoute("/label/:ticketCode");
  const ticketCode = params?.ticketCode ?? "";

  const { data, isLoading, isError } = useGetByTicketCode(ticketCode);
  const box = data?.box;

  const shortUrl = `${window.location.origin}${import.meta.env.BASE_URL}q/${ticketCode}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&ecc=L&margin=1&data=${encodeURIComponent(shortUrl)}`;

  if (isLoading) {
    return (
      <div className="screen-only min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400 text-sm">Loading box data…</p>
      </div>
    );
  }

  if (isError || !box) {
    return (
      <div className="screen-only min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-700 font-semibold">Ticket not found</p>
          <p className="text-slate-400 text-sm mt-1">{ticketCode}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="screen-only bg-slate-100 min-h-screen flex flex-col items-center py-8 px-4">
        <div className="w-full max-w-xs mb-6 flex items-center justify-between gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <Button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white"
            size="sm"
          >
            <Printer className="w-4 h-4" />
            Print Label
          </Button>
        </div>

        <p className="text-xs text-slate-400 mb-4 text-center">
          Preview — actual printed size is 58&nbsp;mm wide
        </p>

        <LabelCard box={{ ...box, projectName: box.clientName }} qrUrl={qrUrl} />
      </div>

      <div className="print-only">
        <LabelCard box={{ ...box, projectName: box.clientName }} qrUrl={qrUrl} />
      </div>
    </>
  );
}

function LabelCard({
  box,
  qrUrl,
}: {
  box: {
    boxCode: string;
    projectName?: string | null;
    collectionsOwner?: string | null;
    location?: string | null;
    period?: string | null;
    itemCount?: number | null;
    inDate?: string | null;
    priority?: string | null;
    deadline?: string | null;
    custodyType?: string | null;
  };
  qrUrl: string;
}) {
  return (
    <div className="label-card">
      {/* Brand line — Arciflow left, Priority badge right */}
      <div className="label-top">
        <span className="label-logo-text">Arciflow</span>
        {box.priority && <span className="label-priority-badge">{box.priority}</span>}
      </div>

      {/* Box ID — largest element, shown once */}
      <div className="label-box-code">{box.boxCode}</div>
      <div className="label-client">{box.projectName ?? "—"}</div>
      {box.collectionsOwner && <div className="label-collections-owner">{box.collectionsOwner}</div>}

      {/* QR — full width, dominant */}
      <img src={qrUrl} alt="QR" className="label-qr" />

      {/* 2-column info: left col = Location, Ownership | right col = In Date, Deadline */}
      <div className="label-info">
        {/* Row 1: Depot PTAD (left) | In Date (right) */}
        <div className="label-info-item">
          {box.location && <>
            <span className="label-info-key">Depot PTAD</span>
            <span className="label-info-val">{box.location}</span>
          </>}
        </div>
        <div className="label-info-item">
          {box.inDate && <>
            <span className="label-info-key">In Date</span>
            <span className="label-info-val">{format(new Date(box.inDate), "d MMM yyyy")}</span>
          </>}
        </div>

        {/* Row 2: Ownership (left) | Deadline (right) */}
        <div className="label-info-item">
          {box.custodyType && <>
            <span className="label-info-key">Ownership</span>
            <span className="label-info-val">{CUSTODY_LABELS[box.custodyType] ?? box.custodyType}</span>
          </>}
        </div>
        <div className="label-info-item">
          <span className="label-info-key">Deadline</span>
          <span className="label-info-val">
            {box.deadline ? format(new Date(box.deadline), "d MMM yyyy") : "—"}
          </span>
        </div>

        {/* Row 3: Item Count (left) | Periode (right) */}
        {(box.itemCount != null || box.period) && <>
          <div className="label-info-item">
            {box.itemCount != null && <>
              <span className="label-info-key">Item Count</span>
              <span className="label-info-val">{box.itemCount}</span>
            </>}
          </div>
          <div className="label-info-item">
            {box.period && <>
              <span className="label-info-key">Periode</span>
              <span className="label-info-val">{box.period}</span>
            </>}
          </div>
        </>}
      </div>

      <div className="label-divider" />

      <div className="label-scan-hint">scan to view · arciflow</div>
    </div>
  );
}

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1 } } });

export default function LabelPrintPage() {
  return (
    <QueryClientProvider client={qc}>
      <LabelContent />
    </QueryClientProvider>
  );
}
