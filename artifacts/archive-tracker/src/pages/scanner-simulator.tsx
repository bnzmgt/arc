import { useState } from "react";
import { useLocation } from "wouter";
import { ScanLine, QrCode, ArrowRight, Scan, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useListBoxes } from "@workspace/api-client-react";

export default function ScannerSimulatorPage() {
  const [, navigate] = useLocation();
  const [manualCode, setManualCode] = useState("");

  const { data: boxes } = useListBoxes();

  const boxesWithTickets = (boxes ?? []).filter((b) => b.ticketCode);

  function handleScan(code: string) {
    if (!code.trim()) return;
    navigate(`/scan/${code.trim()}`);
  }

  function handlePrintLabel(code: string) {
    window.open(`/label/${code}`, "_blank");
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleScan(manualCode);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ScanLine className="w-7 h-7 text-orange-500" />
          Scanner Simulator
        </h1>
        <p className="mt-1 text-slate-500">
          Simulate scanning a QR label or print a thermal label (58&nbsp;mm) for any box below.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <QrCode className="w-5 h-5 text-slate-500" />
          <span className="font-medium text-slate-700 text-sm">
            Manual ticket code entry
          </span>
        </div>
        <form onSubmit={handleManualSubmit} className="p-4 flex gap-3">
          <div className="flex-1">
            <Label htmlFor="code" className="sr-only">
              Ticket Code
            </Label>
            <Input
              id="code"
              placeholder="e.g. ARC-TK001AAA"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="font-mono"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!manualCode.trim()}
            onClick={() => handlePrintLabel(manualCode.trim())}
          >
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button type="submit" disabled={!manualCode.trim()}>
            <Scan className="w-4 h-4 mr-2" />
            Simulate Scan
          </Button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-slate-500" />
          <span className="font-medium text-slate-700 text-sm">
            Boxes with e-tickets
          </span>
        </div>

        {boxesWithTickets.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <QrCode className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">
              No boxes have e-tickets yet. Generate one from a box detail page.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {boxesWithTickets.map((box) => (
              <li key={box.id} className="flex items-center px-4 py-3 gap-3">
                <button
                  onClick={() => handleScan(box.ticketCode!)}
                  className="flex-1 flex items-center justify-between text-left hover:bg-slate-50 rounded-lg transition-colors group min-w-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      {box.boxCode}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {box.clientName}
                    </p>
                    <p className="mt-1 font-mono text-xs text-orange-600 bg-orange-50 inline-block px-1.5 py-0.5 rounded">
                      {box.ticketCode}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 ml-3 transition-colors" />
                </button>

                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0 text-slate-600 border-slate-200 hover:bg-slate-100"
                  onClick={() => handlePrintLabel(box.ticketCode!)}
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print Label
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-slate-400 text-center">
        "Print Label" opens a 58&nbsp;mm thermal label preview in a new tab — just hit
        Print from there. "Simulate Scan" shows the same mobile view a field worker
        sees after scanning.
      </p>
    </div>
  );
}
