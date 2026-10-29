import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerPatientPlanPrint } from "@/lib/printPatientPlan";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

/** Vista previa imprimible con scroll (cierra el modal del plan mientras está abierta). */
export function PatientPlanPrintPreviewDialog({ open, onOpenChange, children }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="patient-plan-print-dialog max-w-4xl w-[calc(100vw-2rem)] max-h-[95vh] p-0 gap-0 flex flex-col overflow-hidden"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Vista previa del plan para imprimir</DialogTitle>
        <div className="no-print shrink-0 flex flex-wrap gap-2 p-3 border-b bg-background justify-center">
          <Button type="button" onClick={() => triggerPatientPlanPrint()}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir o guardar como PDF
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar vista previa
          </Button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
